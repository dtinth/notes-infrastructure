const execa = require('execa')

/**
 * @param {object} options
 * @param {string} [options.currentDocumentId]
 * @param {SearchEngine} options.searchEngine
 * @return {Promise<NoteSidebarItem[]>}
 */
exports.getSidebar = async (options) => {
  const id = options.currentDocumentId
  if (!id) {
    return []
  }
  const latestChanges = getLatestChanges()
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
    if (id === options.currentDocumentId) return []
    if (backlinkIds.has(id)) return []
    if (linkedIds.has(id)) return []
    const document = searchEngine.documentMap.get(id)
    if (!document) return []
    return [document]
  })
  /**
   * @param {JournalDocument[]} documents
   * @param {string} idPrefix
   * @return {NoteSidebarItem[]}
   */
  const children = (documents, idPrefix) => {
    return documents.map((d) => {
      return {
        label: d.title,
        id: idPrefix + '_' + d.id,
        noteId: d.id,
      }
    })
  }
  const idToDateMap = new Map(
    (await latestChanges).map((change) => {
      return [change.id, change.timestamp.split('T')[0] ?? '?']
    })
  )
  const recents = (await latestChanges).flatMap((change) => {
    const document = searchEngine.documentMap.get(change.id)
    if (!document) return []
    return [document]
  })
  return [
    {
      id: 'backlinks',
      label: `Backlinks (${backlinks.length})`,
      collapsibleState: 1,
      children: children(backlinks, 'backlinks'),
    },
    {
      id: 'similar',
      label: `Unlinked but similar (${similar.length})`,
      collapsibleState: 1,
      children: cap(children(similar, 'similar'), 10, 'similar'),
    },
    {
      id: 'links',
      label: `Links (${links.length})`,
      collapsibleState: 1,
      children: children(links, 'links'),
    },
    {
      id: 'recent',
      label: `Recent changes`,
      collapsibleState: 1,
      children: groupBy(children(recents, 'recent'), idToDateMap, 'recent'),
    },
  ]
}

/**
 * @param {NoteSidebarItem[]} items
 * @param {Map<string, string>} map
 * @param {string} prefix
 * @return {NoteSidebarItem[]}
 */
function groupBy(items, map, prefix) {
  let lastGroup = ''
  return items.flatMap((item, index) => {
    if (!item.noteId) return [item]
    const group = map.get(item.noteId) ?? '?'
    if (group === lastGroup) {
      return [item]
    } else {
      lastGroup = group
      return [
        {
          id: `${prefix}_header_${index}`,
          label: group,
          icon: { id: 'calendar' },
        },
        item,
      ]
    }
  })
}

/**
 * @param {NoteSidebarItem[]} items
 * @param {number} max
 * @param {string} prefix
 * @return {NoteSidebarItem[]}
 */
function cap(items, max, prefix) {
  if (items.length > max) {
    return [
      ...items.slice(0, max),
      {
        id: prefix + '_' + 'seeMore',
        collapsibleState: 1,
        label: `${items.length - max} more...`,
        children: items.slice(max),
      },
    ]
  } else {
    return items
  }
}

async function getLatestChanges() {
  const data = await execa(
    "git log --name-only --format='@ %cI %H' --max-count=25",
    { shell: true, cwd: 'data' }
  )
  const lines = data.stdout.split('\n').map((l) => l.trim())
  const seen = new Set()
  /** @type {{ id: string; timestamp: string }[]} */
  const result = []
  let timestamp = ''
  for (const line of lines) {
    /** @type {RegExpMatchArray | null} */
    let m = null
    if ((m = line.match(/^@ (\S+)/))) {
      timestamp = m[1]
    } else if ((m = line.match(/^(\w+)\.md$/))) {
      const id = m[1]
      if (!seen.has(id)) {
        seen.add(id)
        result.push({ id, timestamp })
      }
    }
  }
  return result
}
