import { stringify } from '@thai/funny-json'
import { createCache } from 'async-cache-dedupe'
import { $ } from 'bun'
import { writeFileSync } from 'fs'
import pMap from 'p-map'
import RSS from 'rss'
import { getCompiler } from '../src/generateHtml'
import { PublicTree } from '../src/generatePublicTree'
import { Sitegraph } from '../src/generateSitegraph'
import { supabase } from '../src/supabase'
import { Tasks } from '../src/Tasks'
import { unwrap } from '../src/unwrap'

async function downloadFromSupabasePublic(name: string) {
  const blob = unwrap(
    await supabase.storage.from('notes-public').download(name)
  )
  return blob!.text()
}

class StaticSiteGenerator {
  private cache = createCache({ ttl: 300 })
    .define(
      'getTree',
      async (): Promise<PublicTree> => {
        return JSON.parse(await downloadFromSupabasePublic('notes.tree.json'))
      }
    )
    .define(
      'getSitegraph',
      async (): Promise<Sitegraph> => {
        return JSON.parse(
          await downloadFromSupabasePublic('notes.sitegraph.json')
        )
      }
    )
    .define(
      'getIndex',
      async (): Promise<object> => {
        return JSON.parse(await downloadFromSupabasePublic('notes.index.json'))
      }
    )

  generate() {
    const tasks = new Tasks()

    tasks.addTasks(
      'static files',
      new Tasks()
        .add('assets', async () => {
          await $`rsync -vr ./node_modules/notes-frontend/dist/assets/ ../published/assets/`.quiet()
        })
        .add('lib', async () => {
          await $`rsync -vr ./node_modules/notes-frontend/dist/lib/ ../published/lib/`.quiet()
        })
        .add('runtime', async () => {
          await $`rsync -vr ./node_modules/notes-frontend/dist/runtime/ ../published/runtime/`.quiet()
        })
    )

    tasks.add('pages', async () => {
      const tree = await this.cache.getTree()
      const notes = unwrap(
        await supabase.from('notes_contents').select('id, compiled')
      )
      const compiler = await getCompiler()
      const template = await Bun.file(
        'node_modules/notes-frontend/dist/index.html'
      ).text()
      const push = async (note: Exclude<typeof notes, null>[number]) => {
        if (!note.compiled) {
          return
        }
        const slug = note.id
        const compiled = JSON.parse(note.compiled)
        const html = compiler.applyTemplate({
          slug,
          template,
          compiled,
          publicTree: tree,
        })
        writeFileSync(`../published/${slug}.html`, html)
        // console.log('Written:', slug)
      }
      await pMap(notes || [], push, { concurrency: 4 })
      writeFileSync('../published/404.html', template)
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
          .join('\n')
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
      writeFileSync('../published/api/recent.xml', await this.generateRssFeed())
    })
    return tasks
  }

  private async generateRssFeed() {
    const note = unwrap(
      await supabase.from('notes_contents').select('source').eq('id', 'Recent')
    )![0]
    const source = note.source
    const feed = new RSS({
      title: 'dtinth',
      description: 'Thai Pangsakulyanont’s writings',
      feed_url: 'https://notes.dt.in.th/api/recent.xml',
      site_url: 'https://dt.in.th',
    })
    for (const m of source.matchAll(
      /^- (\d\d\d\d-\d\d-\d\d): \[(.*?)\]\(([^)\s]+)\)/gm
    )) {
      const url = new URL(m[3], 'https://notes.dt.in.th/').toString()
      const options = {
        title: m[2],
        description: `<a href="${url}">[Read]</a>`,
        url: url,
        date: new Date(m[1] + 'T00:00:00Z'),
      }
      feed.item(options)
    }
    return feed.xml()
  }
}

const generator = new StaticSiteGenerator()
{
  const tasks = new Tasks()
  tasks.addTasks('site contents', generator.generate())
  tasks.addTasks('data files', generator.generateApi())
  await tasks.run()
}
