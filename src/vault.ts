import { createHash } from 'crypto'
import { readdirSync, readFileSync } from 'fs'
import { basename, extname, join } from 'path'
import parseFrontmatter from 'gray-matter'
import { MarkdownContent } from './MarkdownContent'

export interface VaultNote {
  id: string
  version: string
  source: string
  public: boolean
  topic: boolean
  title: string
  names: string[]
  links: string[]
  frontMatter: Record<string, any>
}

export function readVault(dir: string): Map<string, VaultNote> {
  const notes = new Map<string, VaultNote>()
  for (const file of readdirSync(dir)) {
    if (extname(file) !== '.md') continue
    const id = basename(file, '.md')
    notes.set(id, parseNote(id, readFileSync(join(dir, file), 'utf-8')))
  }
  return notes
}

export function parseNote(id: string, source: string): VaultNote {
  const version = createHash('sha256').update(source).digest('hex')
  const { data: frontMatter, content } = parseFrontmatter(source)
  const markdown = new MarkdownContent(content)
  let title = frontMatter.title || ''
  if (!title) {
    title = markdown.text.match(/^(.*?)(?:\.\s|\n|$)/)?.[1] || ''
  }
  if (frontMatter.topic) {
    title += ' (topic)'
  }
  const aliases = frontMatter.aliases
    ? [frontMatter.aliases].flat().map(String)
    : []
  return {
    id,
    version,
    source,
    public: !!frontMatter.public,
    topic: !!frontMatter.topic,
    title,
    names: [...new Set([id, ...aliases])],
    links: markdown.links.filter((l) => !l.includes(':')),
    frontMatter,
  }
}
