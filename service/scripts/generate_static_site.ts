import { generateHtml } from '@notes/html-generator'
import xmlPlugin from '@prettier/plugin-xml'
import { stringify } from '@thai/funny-json'
import { createCache } from 'async-cache-dedupe'
import { $ } from 'bun'
import { readFileSync, writeFileSync } from 'fs'
import pMap from 'p-map'
import prettier from 'prettier'
import RSS from 'rss'
import { compileNote } from '../src/generateHtml'
import { PublicTree } from '../src/generatePublicTree'
import { Sitegraph } from '../src/generateSitegraph'
import { supabase } from '../src/supabase'
import { Tasks } from '../src/Tasks'
import { unwrap } from '../src/unwrap'

async function downloadFromSupabasePublic(name: string) {
  const blob = unwrap(
    await supabase.storage.from('notes-public').download(name),
  )
  return blob!.text()
}

class StaticSiteGenerator {
  private cache = createCache({ ttl: 300 })
    .define('getTree', async (): Promise<PublicTree> => {
      return JSON.parse(await downloadFromSupabasePublic('notes.tree.json'))
    })
    .define('getSitegraph', async (): Promise<Sitegraph> => {
      return JSON.parse(
        await downloadFromSupabasePublic('notes.sitegraph.json'),
      )
    })
    .define('getIndex', async (): Promise<object> => {
      return JSON.parse(await downloadFromSupabasePublic('notes.index.json'))
    })
    .define('getNotesCompiled', async () => {
      return unwrap(
        await supabase.from('notes_contents').select('id, compiled'),
      )
    })

  compilerVersion = '6'

  async findNotesToCompile() {
    const info = unwrap(
      await supabase
        .from('notes_contents')
        .select(
          'id, source_version, compiled_source_version, compiled_compiler_version',
        ),
    )!
    const toCompile: string[] = []
    for (const row of info) {
      if (
        row.compiled_compiler_version !== this.compilerVersion ||
        row.source_version !== row.compiled_source_version
      ) {
        toCompile.push(row.id)
      }
    }
    return toCompile
  }

  async compileNote(id: string) {
    const { source, source_version } = unwrap(
      await supabase
        .from('notes_contents')
        .select('source, source_version')
        .eq('id', id),
    )![0]
    const compileResult = await compileNote(source, id)
    unwrap(
      await supabase
        .from('notes_contents')
        .update({
          compiled: JSON.stringify(compileResult.result.compiled),
          compiled_source_version: source_version,
          compiled_compiler_version: this.compilerVersion,
        })
        .eq('id', id),
    )
  }

  compileAllNotes() {
    const tasks = new Tasks()
    tasks.add('compile notes', async ({ log }) => {
      const notesToCompile = await this.findNotesToCompile()
      log(`to compile: ${notesToCompile.length}`)
      await pMap(
        notesToCompile,
        async (id) => {
          await this.compileNote(id)
          log(`compiled: ${id}`)
        },
        { concurrency: 4 },
      )
      log(`notes compiled: ${notesToCompile.length}`)
    })
    return tasks
  }

  generate() {
    const tasks = new Tasks()

    tasks.addTasks(
      'static files',
      new Tasks()
        .add('compiler', async () => {
          await $`rsync -vr ./node_modules/@notes/compiler/dist/compiler/ ../published/compiler/`.quiet()
        })
        .add('static', async () => {
          await $`rsync -vr ./node_modules/@notes/client/dist/static/ ../published/static/`.quiet()
        })
        .add('runtime', async () => {
          await $`rsync -vr ./node_modules/@notes/client/dist/runtime/ ../published/runtime/`.quiet()
        }),
    )

    tasks.add('pages', async ({ log }) => {
      log('loading tree…')
      const tree = await this.cache.getTree()

      log('loading notes…')
      const notes = await this.cache.getNotesCompiled()
      const publicIds = new Set(Object.keys(tree.nodes))

      const push = async (note: Exclude<typeof notes, null>[number]) => {
        if (!note.compiled) {
          return
        }
        const slug = note.id
        const compiled = JSON.parse(note.compiled)
        const html = generateHtml({
          slug,
          compiled,
          // publicTree: tree,
        })
        writeFileSync(`../published/${slug}.html`, html)
        if (slug === 'HomePage') {
          writeFileSync('../published/index.html', html)
        }
        log(`generated ${slug}.html`)
      }
      log('generating files…')
      const notesToPublish = (notes || []).filter((note) =>
        publicIds.has(note.id),
      )
      await pMap(notesToPublish, push, { concurrency: 4 })
      writeFileSync('../published/404.html', generateHtml())
      log('done')
    })
    return tasks
  }
  generateApi() {
    const tasks = new Tasks()
    tasks.add('tree.json', async () => {
      const tree = await this.cache.getTree()
      writeFileSync('../published/api/tree.json', stringify(tree))
    })
    tasks.add('sitemap.txt', async () => {
      const tree = await this.cache.getTree()
      writeFileSync(
        '../published/api/sitemap.txt',
        Object.keys(tree.nodes)
          .map((id) => {
            return `https://notes.dt.in.th/${id}`
          })
          .join('\n'),
      )
    })
    tasks.add('sitegraph.json', async () => {
      const sitegraph = await this.cache.getSitegraph()
      writeFileSync('../published/api/sitegraph.json', stringify(sitegraph))
    })
    tasks.add('index.json', async () => {
      const index = await this.cache.getIndex()
      writeFileSync('../published/api/index.json', JSON.stringify(index))
    })
    tasks.add('recent.xml', async () => {
      updateFileSync(
        '../published/api/recent.xml',
        await this.generateRssFeed(),
        (f) => f.replace(/<lastBuildDate>.*?<\/lastBuildDate>/, ''),
      )
    })
    tasks.add('CNAME', async () => {
      writeFileSync('../published/CNAME', 'notes.dt.in.th')
    })
    tasks.add('.nojekyll', async () => {
      writeFileSync('../published/.nojekyll', 'notes.dt.in.th')
    })
    return tasks
  }

  private async generateRssFeed() {
    const note = unwrap(
      await supabase.from('notes_contents').select('source').eq('id', 'Recent'),
    )![0]
    const source = note.source
    const feed = new RSS({
      title: 'dtinth',
      description: 'Thai Pangsakulyanont’s writings',
      feed_url: 'https://notes.dt.in.th/api/recent.xml',
      site_url: 'https://dt.in.th',
    })
    const notes = (await this.cache.getNotesCompiled()) || []
    const noteMap = new Map(notes.map((note) => [note.id, note]))
    let count = 0
    for (const m of source.matchAll(
      /^- (\d\d\d\d-\d\d-\d\d): \[(.*?)\]\(([^)\s]+)\)/gm,
    )) {
      const url = new URL(m[3], 'https://notes.dt.in.th/').toString()
      const compilation = noteMap.get(m[3])?.compiled
      const html = compilation ? JSON.parse(compilation).html : ''
      const options = {
        title: m[2],
        description: `<a href="${url}">[Read on notes.dt.in.th]</a>${html}`,
        url: url,
        date: new Date(m[1] + 'T00:00:00Z'),
      }
      feed.item(options)
      if (++count >= 20) {
        break
      }
    }
    const xmlContent = feed.xml().replace(
      '</channel>',
      `
        <follow_challenge>
          <feedId>81341335623521281</feedId>
          <userId>56028730846183424</userId>
        </follow_challenge>
      </channel>`,
    )
    const prettifiedXml = await prettier.format(xmlContent, {
      parser: 'xml',
      plugins: [xmlPlugin],
      useTabs: true,
      xmlWhitespaceSensitivity: 'ignore',
      printWidth: 256,
    })
    return prettifiedXml
  }
}

/**
 * Normalizes the old content and new content, and only updates the file if the normalized content is different.
 */
function updateFileSync(
  path: string,
  content: string,
  normalizer: (content: string) => string,
) {
  const oldContent = normalizer(readFileSync(path, 'utf-8'))
  const newContent = normalizer(content)
  if (oldContent !== newContent) {
    writeFileSync(path, content)
  }
}

const generator = new StaticSiteGenerator()
await new Tasks({ concurrent: false })
  .addTasks('compile', generator.compileAllNotes())
  .addTasks(
    'generate static site',
    new Tasks()
      .addTasks('site contents', generator.generate())
      .addTasks('data files', generator.generateApi()),
  )
  .addTasks(
    'publish',
    new Tasks({ concurrent: false })
      .add('git add', async () => {
        await $`cd ../published && git add .`.quiet()
      })
      .add('git commit', async ({ log }) => {
        const message = (
          await $`cd ../published && git diff --stat --staged`.text()
        )
          .trim()
          .split('\n')
          .pop()
          ?.trim()
        if (!message) {
          log('nothing to commit')
        } else {
          log(message)
          await $`cd ../published && git commit -m "${message}"`.quiet()
        }
      })
      .add('git push', async () => {
        await $`cd ../published && git push`.quiet()
      }),
  )
  .run()
