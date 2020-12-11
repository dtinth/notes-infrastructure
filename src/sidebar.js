/**
 * @param {object} options
 * @param {string} [options.currentDocumentId]
 * @param {SearchEngine} options.searchEngine
 */
exports.getSidebar = async (options) => {
  const id = options.currentDocumentId
  if (!id) {
    return []
  }
  const searchEngine = options.searchEngine
  const allDocs = Array.from(searchEngine.documentMap.values())
  const backlinks = allDocs.filter((f) => f.links.includes(id))
  const linkedIds = new Set(
    (searchEngine.documentMap.get(id)?.links || '').split(' ')
  )
  const links = allDocs.filter((f) => linkedIds.has(f.id))
  const searchText = id + ' ' + (searchEngine.contentsMap.get(id) || '')
  const searchResults = searchEngine.minisearch.search(searchText)
  const backlinkIds = new Set(backlinks.map((b) => b.id))
  const similar = searchResults.flatMap((r) => {
    const id = r.id
    if (backlinkIds.has(id)) return []
    const document = searchEngine.documentMap.get(id)
    if (!document) return []
    return [document]
  })
  /**
   * @param {JournalDocument[]} documents
   */
  const children = (documents) => {
    return documents.map((d) => {
      return {
        label: d.title,
        id: d.id,
        noteId: d.id,
      }
    })
  }
  return [
    {
      id: 'backlinks',
      label: `Backlinks (${backlinks.length})`,
      collapsibleState: 1,
      children: children(backlinks),
    },
    {
      id: 'similar',
      label: `Unlinked but similar (${similar.length})`,
      collapsibleState: 1,
      children: children(similar),
    },
    {
      id: 'links',
      label: `Links (${links.length})`,
      collapsibleState: 1,
      children: children(links),
    },
  ]
}
