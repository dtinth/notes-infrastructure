import { createHash } from 'crypto'
import { lstatSync, readdirSync, readFileSync } from 'fs'
import { basename, extname, join } from 'path'
import parseFrontmatter from 'gray-matter'
import { MarkdownContent } from './MarkdownContent'

/**
 * A note as indexed from the vault. Field shapes match legacy
 * `service/src/indexNote.ts`, because the search index is built from these
 * objects and must stay byte-identical to what the frontend already reads.
 */
export interface VaultNote {
  id: string
  version: string
  source: string
  public: boolean
  topic: boolean | undefined
  title: string
  /** Plain text of the body, minus the title when the title came from it. */
  text: string
  excerpt: string
  aka: string
  /** Space-separated slug and aliases. */
  names: string
  /** Space-separated internal link targets, in document order. */
  links: string
  frontMatter: Record<string, any>
}

/**
 * Note ids are plain file names: no path separators or control characters,
 * no leading dot. Ids and aliases become file names in the site, too.
 */
export function isValidNoteId(id: string) {
  return /^[^/\\\x00-\x1f\x7f]+$/.test(id) && !id.startsWith('.')
}

/**
 * Reads a note file, or returns undefined unless it is a regular file.
 * Symlinks are skipped: one pulled into the vault could point anywhere.
 */
export function readNoteFile(path: string) {
  const stat = lstatSync(path, { throwIfNoEntry: false })
  return stat?.isFile() ? readFileSync(path, 'utf-8') : undefined
}

export function readVault(dir: string): Map<string, VaultNote> {
  const notes = new Map<string, VaultNote>()
  for (const file of readdirSync(dir)) {
    if (extname(file) !== '.md') continue
    const id = basename(file, '.md')
    const source = isValidNoteId(id) ? readNoteFile(join(dir, file)) : undefined
    if (source !== undefined) notes.set(id, parseNote(id, source))
  }
  return notes
}

export function parseNote(id: string, source: string): VaultNote {
  const version = createHash('sha256').update(source).digest('hex')
  const { data: frontMatter, content: body } = parseFrontmatter(source)
  const markdown = new MarkdownContent(body)
  const links = markdown.links.filter((l) => !l.includes(':'))

  let content = markdown.text
  let title = frontMatter.title || ''
  if (!title) {
    const match = content.match(/^(.*?)(?:\.\s|\n|$)/)
    if (match) {
      title = match[1]
      content = content.slice(title.length).trim()
    }
  }
  if (frontMatter.topic) {
    title += ' (topic)'
  }

  const names = new Set([id])
  if (frontMatter.aliases) {
    for (const alias of [frontMatter.aliases].flat()) {
      names.add(alias)
    }
  }

  return {
    id,
    version,
    source,
    public: !!frontMatter.public,
    topic: frontMatter.topic,
    title,
    text: content,
    excerpt: content.slice(0, 256),
    aka: Array.isArray(frontMatter.aka)
      ? frontMatter.aka.join(' ')
      : String(frontMatter.aka || ''),
    names: [...names].join(' '),
    links: links.join(' '),
    frontMatter,
  }
}

export function linksOf(note: Pick<VaultNote, 'links'>): string[] {
  return note.links.split(' ').filter(Boolean)
}
