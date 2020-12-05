// @ts-check
const parseFrontmatter = require('gray-matter')
const path = require('path')

/**
 * @type {WeakMap<import('minisearch').default, Map<string, any>>}
 */
const searchEngineToDocumentMap = new WeakMap()

/**
 * @param {import('minisearch').default} searchEngine
 * @param {string} filename
 * @param {string} contents
 */
exports.indexDocumentIntoSearchEngine = (searchEngine, filename, contents) => {
  let { data: frontmatter, content } = parseFrontmatter(contents)
  content = content.trim()
  const links = []
  content.replace(/\((\d+T\d+Z\d+)\)/g, (_, pageId) => {
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
  let documentMap = searchEngineToDocumentMap.get(searchEngine)
  if (!documentMap) {
    documentMap = new Map()
  }
  const id = path.basename(filename, '.md')
  let existingDocument = documentMap.get(id)
  if(existingDocument) {
    searchEngine.remove(existingDocument)
    documentMap.delete(id)
  }
  const document = {
    id: id,
    topic: frontmatter.topic,
    text: content,
    links: links.join(' '),
    excerpt: content.slice(0, 256),
    title,
  }
  searchEngine.add(document)
  documentMap.set(id, document)
}