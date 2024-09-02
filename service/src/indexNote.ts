import parseFrontmatter from 'gray-matter'
import { MarkdownContent } from './MarkdownContent'
import { Note } from './Note'
import { NotesDatabase } from './NotesDatabase'

export interface IndexOptions {
  publicOnly?: boolean
}

export function indexNote(
  notesDatabase: NotesDatabase,
  slug: string,
  source: string,
  options: IndexOptions = {}
): boolean {
  notesDatabase.identitySet.add(slug)

  const existingDocument = notesDatabase.documentMap.get(slug)
  if (existingDocument) {
    const existingSource = notesDatabase.contentsMap.get(slug)
    if (existingSource === source) return false
  }

  let { data: frontMatter, content } = parseFrontmatter(source)
  if (!frontMatter.public && options.publicOnly) {
    return false
  }
  const markdownContent = new MarkdownContent(content)
  const links: string[] = markdownContent.links.filter((l) => !l.includes(':'))

  content = markdownContent.text
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
  const names = new Set([slug])
  if (frontMatter.aliases) {
    const aliases = Array.isArray(frontMatter.aliases)
      ? frontMatter.aliases
      : [frontMatter.aliases]
    for (const alias of aliases) {
      names.add(alias)
    }
  }
  const document: Note = {
    id: slug,
    public: !!frontMatter.public,
    topic: frontMatter.topic,
    aka: Array.isArray(frontMatter.aka)
      ? frontMatter.aka.join(' ')
      : String(frontMatter.aka || ''),
    text: content,
    links: links.join(' '),
    excerpt: content.slice(0, 256),
    title,
    names: [...names].join(' '),
    frontMatter,
  }
  notesDatabase.documentMap.set(slug, document)
  notesDatabase.contentsMap.set(slug, source)
  if (existingDocument) {
    notesDatabase.minisearch.remove(existingDocument)
  }
  notesDatabase.minisearch.add(document)
  return true
}

export function unindexNote(notesDatabase: NotesDatabase, slug: string) {
  const document = notesDatabase.documentMap.get(slug)
  if (!document) return
  notesDatabase.documentMap.delete(slug)
  notesDatabase.contentsMap.delete(slug)
  notesDatabase.identitySet.delete(slug)
  notesDatabase.minisearch.remove(document)
}
