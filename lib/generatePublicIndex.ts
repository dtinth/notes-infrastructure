import MiniSearch from 'minisearch'
import { searchEngineOptions } from './searchEngine'

export interface DocumentRepository {
  getDocument(id: string): Promise<JournalDocument | undefined>
}

interface GeneratePublicIndexOptions {
  repo: DocumentRepository
  log?: (message: string) => void
}

export async function generatePublicIndex({
  repo,
  log = console.log,
}: GeneratePublicIndexOptions) {
  const indexId = 'HomePage'
  const fringe: { id: string; parentId?: string; cost: number }[] = [
    { id: indexId, parentId: undefined, cost: 0 },
  ]

  const visitedSet = new Set()
  const nodeMap = new Map<string, DocumentNode>()
  const minisearch = new MiniSearch<JournalDocument>(searchEngineOptions)
  const ids: string[] = []

  while (fringe.length > 0) {
    fringe.sort((a, b) => {
      return a.cost - b.cost
    })
    const item = fringe.shift()
    if (!item) {
      continue
    }
    const id = item.id
    if (visitedSet.has(id)) {
      continue
    }
    visitedSet.add(id)
    const document = await repo.getDocument(id)
    if (!document) {
      continue
    }
    const node: DocumentNode = {
      id,
      title: document.title.replace(/^#\s+/, '').replace(/[*\[\]]/g, ''),
    }
    nodeMap.set(id, node)
    if (item.parentId) {
      const parentNode = nodeMap.get(item.parentId)
      if (parentNode) {
        parentNode.children = parentNode.children || []
        parentNode.children.push(node)
      }
    }

    log(`${item.cost} ${item.parentId || '-'} ${id} ${document.title}`)
    const links = (document.links || '')
      .split(' ')
      .map((x) => x.split('#')[0])
      .filter(Boolean)
    const selfCost = document.topic ? 0 : 100
    for (const linkId of links) {
      if (visitedSet.has(linkId)) {
        continue
      }
      const linkCost = linkId === 'Recent' ? 10000 : 1
      fringe.push({
        id: linkId,
        parentId: id,
        cost: item.cost + selfCost + linkCost,
      })
    }

    minisearch.add({ ...document, excerpt: '' })
    ids.push(id)
  }

  return {
    indexNode: nodeMap.get(indexId),
    indexData: minisearch.toJSON(),
    ids,
  }
}

interface DocumentNode {
  id: string
  title: string
  children?: DocumentNode[]
}
