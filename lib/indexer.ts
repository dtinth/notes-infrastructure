import parseFrontmatter from 'gray-matter'
import path from 'path'
import { MarkdownContent } from './contentParser'

export interface IndexOptions {
  publicOnly?: boolean
}

export function indexDocumentIntoSearchEngine(
  searchEngine: SearchEngine,
  filename: string,
  contents: string,
  options: IndexOptions = {}
) {
  let { data: frontmatter, content } = parseFrontmatter(contents)
  if (!frontmatter.public && options.publicOnly) {
    return
  }
  content = content.trim()
  const markdownContent = new MarkdownContent(content)
  const links: string[] = markdownContent.links.filter((l) => !l.includes(':'))

  content = content.replace(/\((\d+T\d+Z\d+)\)/g, '')
  let title = frontmatter.title || ''
  if (!title) {
    const match = content.match(/^(.*?)(?:\.\s|\n|$)/)
    if (match) {
      title = match[1]
      content = content.slice(title.length).trim()
    }
  }
  if (frontmatter.topic) {
    title += ' (topic)'
  }
  const id = path.basename(filename, '.md')
  const names = new Set([id])
  if (frontmatter.aliases) {
    const aliases = Array.isArray(frontmatter.aliases)
      ? frontmatter.aliases
      : [frontmatter.aliases]
    for (const alias of aliases) {
      searchEngine.redirectMap.set(alias, id)
      names.add(alias)
    }
  }
  let existingDocument = searchEngine.documentMap.get(id)
  if (existingDocument) {
    searchEngine.minisearch.remove(existingDocument)
    searchEngine.documentMap.delete(id)
  }
  /** @type {JournalDocument} */
  const document = {
    id: id,
    public: !!frontmatter.public,
    topic: frontmatter.topic,
    aka: Array.isArray(frontmatter.aka)
      ? frontmatter.aka.join(' ')
      : String(frontmatter.aka || ''),
    text: content,
    links: links.join(' '),
    excerpt: content.slice(0, 256),
    title,
    names: [...names].join(' '),
  }
  searchEngine.minisearch.add(document)
  searchEngine.documentMap.set(id, document)
  searchEngine.contentsMap.set(id, contents)
  return id
}
