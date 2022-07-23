import { execFileSync } from 'child_process'
import searchEngineFactory from '../lib/searchEngine.js'
import { indexDocumentIntoSearchEngine } from '../lib/indexer.js'
import { writeFileSync } from 'fs'

const indexId = '20201003T154758Z3667'
const searchEngine = searchEngineFactory.create()
const indexedSet = new Set()
function getContents(id) {
  const contents = execFileSync('git', ['show', `HEAD:${id}.md`], {
    encoding: 'utf-8',
    cwd: 'data',
  })
  return contents
}
function getPath(id) {
  return `data/${id}.md`
}
function getDocument(id) {
  if (indexedSet.has(id)) {
    return searchEngine.documentMap.get(id)
  }
  indexedSet.add(id)
  indexDocumentIntoSearchEngine(searchEngine, getPath(id), getContents(id), {
    publicOnly: true,
  })
  return searchEngine.documentMap.get(id)
}

/** @type {{ id: string; parentId?: string; cost: number }[]} */
const fringe = [{ id: indexId, parentId: undefined, cost: 0 }]
const visitedSet = new Set()
/** @typedef {{ id: string; title: string; children?: DocumentNode[] }} DocumentNode */
/** @type {Map<string, DocumentNode>} */
const nodeMap = new Map()

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
  const document = getDocument(id)
  if (!document) {
    continue
  }
  /** @type {DocumentNode} */
  const node = {
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

  console.log(item.cost, item.parentId || '-', id, document.title)
  const links = (document.links || '').split(' ').filter(Boolean)
  const selfCost = document.topic ? 0 : 100
  for (const linkId of links) {
    if (visitedSet.has(linkId)) {
      continue
    }
    const linkCost = linkId === '20220130T173123Z7835' ? 10000 : 1
    fringe.push({
      id: linkId,
      parentId: id,
      cost: item.cost + selfCost + linkCost,
    })
  }
}

const indexNode = nodeMap.get(indexId)
function printToc(node, depth = 0) {
  if (!node) {
    return
  }
  console.log(`${' '.repeat(depth * 2)}- [${node.title}](${node.id})`)
  if (node.children) {
    for (const child of node.children) {
      printToc(child, depth + 1)
    }
  }
}
printToc(indexNode)
writeFileSync('data/metadata/public.json', JSON.stringify(indexNode))
