import { compileMarkdown } from '@notes/compiler/dist/compiler/index.js'
import { generateHtml } from '@notes/html-generator'
import xmlPlugin from '@prettier/plugin-xml'
import { stringify } from '@thai/funny-json'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import pMap from 'p-map'
import prettier from 'prettier'
import RSS from 'rss'
import { join } from 'path'
import { copySiteAssets } from './assets'
import { generateSearchIndex } from './search'
import { generateSitegraph } from './sitegraph'
import { generatePublicTree } from './tree'
import type { PublishedRow } from './store'
import { isValidNoteId, parseNote, type VaultNote } from './vault'

type CompiledNote = Awaited<ReturnType<typeof compileMarkdown>>['compiled']

export interface BuildSiteOptions {
  /**
   * Compiled output already known for some notes, as stored in
   * `notes_contents.compiled`. Notes without it are compiled here.
   */
  precompiled?: Map<string, string>
  log?: (message: string) => void
}

/** Builds the site from published rows, reusing their compiled output. */
export function buildSiteFromRows(
  rows: PublishedRow[],
  outDir: string,
  options: Omit<BuildSiteOptions, 'precompiled'> = {},
) {
  const notes = new Map(rows.map((row) => [row.id, parseNote(row.id, row.source)]))
  const precompiled = new Map<string, string>()
  for (const row of rows) {
    if (row.compiled && row.compiled_source_version === row.source_version) {
      precompiled.set(row.id, row.compiled)
    }
  }
  return buildSite(notes, outDir, { ...options, precompiled })
}

/**
 * Writes the whole static site for dt.in.th into `outDir`, matching what
 * legacy `service/scripts/generate_static_site.ts` produced.
 * `notes` are the published notes; only the ones reachable from HomePage
 * get pages.
 */
export async function buildSite(
  notes: Map<string, VaultNote>,
  outDir: string,
  options: BuildSiteOptions = {},
) {
  const log = options.log ?? (() => {})
  const tree = generatePublicTree(notes)
  const compiled = new Map<string, CompiledNote>()
  let compiledHere = 0
  await pMap(
    notes.values(),
    async (note) => {
      const stored = options.precompiled?.get(note.id)
      if (stored) {
        compiled.set(note.id, JSON.parse(stored))
      } else {
        compiled.set(note.id, (await compileMarkdown(note.source, note.id)).compiled)
        compiledHere++
      }
    },
    { concurrency: 4 },
  )
  log(`compiled ${compiledHere} notes, reused ${compiled.size - compiledHere}`)

  mkdirSync(join(outDir, 'api'), { recursive: true })
  await copySiteAssets(outDir)

  const written = new Map<string, string>()
  // Ids and aliases become file names, so one like `../x` must not get here.
  const write = (filename: string, content: string, sourceSlug: string) => {
    if (!isValidNoteId(filename)) {
      throw new Error(`${sourceSlug} would write an invalid file name: ${filename}`)
    }
    const alreadyWrittenBy = written.get(filename)
    if (alreadyWrittenBy) {
      throw new Error(
        `${filename} already written by ${alreadyWrittenBy}, now by ${sourceSlug}`,
      )
    }
    written.set(filename, sourceSlug)
    writeFileSync(join(outDir, filename), content)
  }
  for (const slug of Object.keys(tree.nodes)) {
    const note = notes.get(slug)!
    const html = generateHtml({ slug, compiled: compiled.get(slug)! })
    write(`${slug}.html`, html, slug)
    write(`${slug}.md`, note.source, slug)
    if (slug === 'HomePage') {
      write('index.html', html, slug)
    }
    const aliases = note.frontMatter.aliases
    if (Array.isArray(aliases)) {
      for (const alias of aliases) {
        write(`${alias}.html`, html, slug)
      }
    }
  }
  writeFileSync(join(outDir, '404.html'), generateHtml())
  log(`wrote ${written.size} pages`)

  const api = (name: string) => join(outDir, 'api', name)
  writeFileSync(api('tree.json'), stringify(tree))
  writeFileSync(
    api('sitemap.txt'),
    Object.keys(tree.nodes)
      .map((id) => `https://dt.in.th/${id}`)
      .join('\n'),
  )
  writeFileSync(api('sitegraph.json'), stringify(generateSitegraph(notes, tree)))
  writeFileSync(api('index.json'), JSON.stringify(generateSearchIndex(notes, tree)))
  updateFileSync(api('recent.xml'), await generateRssFeed(notes, compiled), (f) =>
    f.replace(/<lastBuildDate>.*?<\/lastBuildDate>/, ''),
  )

  writeFileSync(join(outDir, 'CNAME'), 'dt.in.th')
  writeFileSync(join(outDir, '.nojekyll'), 'dt.in.th')
  mkdirSync(join(outDir, '.well-known/matrix'), { recursive: true })
  writeFileSync(
    join(outDir, '.well-known/matrix/client'),
    JSON.stringify({
      'm.homeserver': { base_url: 'https://matrix.lighthouse.d4h.cc' },
    }),
  )
}

/** The 20 latest entries listed in the Recent note. */
async function generateRssFeed(
  notes: Map<string, VaultNote>,
  compiled: Map<string, CompiledNote>,
) {
  const source = notes.get('Recent')?.source ?? ''
  const feed = new RSS({
    title: 'dtinth',
    description: 'Thai Pangsakulyanont’s writings',
    feed_url: 'https://dt.in.th/api/recent.xml',
    site_url: 'https://dt.in.th',
  })
  let count = 0
  for (const m of source.matchAll(
    /^- (\d\d\d\d-\d\d-\d\d): \[(.*?)\]\(([^)\s]+)\)/gm,
  )) {
    const url = new URL(m[3], 'https://dt.in.th/').toString()
    const html = compiled.get(m[3])?.html ?? ''
    feed.item({
      title: m[2],
      description: `<a href="${url}">[Read on dt.in.th]</a>${html}`,
      url: url,
      date: new Date(m[1] + 'T00:00:00Z'),
    })
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
  return prettier.format(xmlContent, {
    parser: 'xml',
    plugins: [xmlPlugin],
    useTabs: true,
    xmlWhitespaceSensitivity: 'ignore',
    printWidth: 256,
  } as prettier.Options)
}

/** Only rewrites `path` if the content differs after normalizing both. */
function updateFileSync(
  path: string,
  content: string,
  normalizer: (content: string) => string,
) {
  if (existsSync(path)) {
    const oldContent = normalizer(readFileSync(path, 'utf-8'))
    if (oldContent === normalizer(content)) return
  }
  writeFileSync(path, content)
}
