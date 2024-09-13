import sortKeys from 'sort-keys'
import { NotesDatabase } from './NotesDatabase'

export interface PublicTreeNode {
  title?: string
  parent?: string
}

export interface PublicTree {
  nodes: Record<string, PublicTreeNode>
}

export function generatePublicTree(db: NotesDatabase) {
  const visited = new Set<string>()
  const queue = ['HomePage']
  const costMap = new Map<string, { cost: number; via?: string }>([
    ['HomePage', { cost: 0 }],
  ])
  const output: Record<string, PublicTreeNode> = {}
  while (queue.length > 0) {
    const slug = queue.shift()!
    const note = db.documentMap.get(slug)
    if (!note) continue
    if (!note.public) continue
    if (visited.has(slug)) continue

    const thisCost = costMap.get(slug)!.cost
    visited.add(slug)

    const thisParent = costMap.get(slug)!.via
    output[slug] = {
      title: note.title,
      parent: thisParent,
    }

    const links = note.links.split(' ')
    const childCost = thisCost + links.length * (note.topic ? 0.001 : 1)
    for (const link of links) {
      if (link) {
        queue.push(link)
        if (!costMap.has(link) || childCost < costMap.get(link)!.cost) {
          costMap.set(link, { cost: childCost, via: slug })
        }
      }
    }
    queue.sort((a, b) => costMap.get(a)!.cost - costMap.get(b)!.cost)
  }

  return { nodes: sortKeys(output) }
}
