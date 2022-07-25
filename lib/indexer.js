const parseFrontmatter = require('gray-matter')
const path = require('path')

/**
 * @param {SearchEngine} searchEngine
 * @param {string} filename
 * @param {string} contents
 * @param {object} [options]
 * @param {boolean} [options.publicOnly]
 */
exports.indexDocumentIntoSearchEngine = (
  searchEngine,
  filename,
  contents,
  options = {}
) => {
  let { data: frontmatter, content } = parseFrontmatter(contents)
  if (!frontmatter.public && options.publicOnly) {
    return
  }
  content = content.trim()
  const links = []
  content = content.replace(/\((\d+T\d+Z\d+)\)/g, (_, pageId) => {
    links.push(pageId)
    return ''
  })
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
  }
  searchEngine.minisearch.add(document)
  searchEngine.documentMap.set(id, document)
  searchEngine.contentsMap.set(id, contents)
  return id
}
