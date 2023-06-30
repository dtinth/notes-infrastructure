import { execFileSync } from 'child_process'
import MiniSearch from 'minisearch'
import { indexDocumentIntoSearchEngine } from './indexer'
import { createSearchEngine, searchEngineOptions } from './searchEngine'

export interface DocumentRepository {
  getDocument(id: string): Promise<JournalDocument | undefined>
}

interface GeneratePublicIndexOptions {
  repo: DocumentRepository
  log?: (message: string) => void
}

export interface PublicIndex {
  indexNode: DocumentNode
  indexData: any
  ids: string[]
}

export async function generatePublicIndex({
  repo,
  log = console.log,
}: GeneratePublicIndexOptions): Promise<PublicIndex> {
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
    indexNode: nodeMap.get(indexId)!,
    indexData: minisearch.toJSON(),
    ids,
  }
}

export interface DocumentNode {
  id: string
  title: string
  children?: DocumentNode[]
}

export class GitJournalRepository implements DocumentRepository {
  searchEngine = createSearchEngine()
  indexedSet = new Set()

  private getContents(id: string) {
    const contents = execFileSync('git', ['show', `HEAD:${id}.md`], {
      encoding: 'utf-8',
      cwd: 'data',
    })
    return contents
  }
  private getPath(id: string) {
    return `data/${id}.md`
  }
  async getDocument(id: string) {
    if (this.indexedSet.has(id)) {
      return this.searchEngine.documentMap.get(id)
    }
    this.indexedSet.add(id)
    indexDocumentIntoSearchEngine(
      this.searchEngine,
      this.getPath(id),
      this.getContents(id),
      { publicOnly: true }
    )
    return this.searchEngine.documentMap.get(id)
  }
}
