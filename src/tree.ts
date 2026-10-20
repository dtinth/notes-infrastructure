import { linksOf, type VaultNote } from './vault'

type TreeNote = Pick<VaultNote, 'public' | 'topic' | 'title' | 'links'>

export interface PublicTree {
  nodes: Record<string, { title?: string; parent?: string }>
}

/** Public notes reachable from HomePage, each with its cheapest parent. */
export function generatePublicTree(notes: Map<string, TreeNote>): PublicTree {
  const visited = new Set<string>()
  const queue = ['HomePage']
  const costMap = new Map<string, { cost: number; via?: string }>([
    ['HomePage', { cost: 0 }],
  ])
  const output: PublicTree['nodes'] = {}
  while (queue.length > 0) {
    const slug = queue.shift()!
    const note = notes.get(slug)
    if (!note) continue
    if (!note.public) continue
    if (visited.has(slug)) continue

    const thisCost = costMap.get(slug)!.cost
    visited.add(slug)
    output[slug] = { title: note.title, parent: costMap.get(slug)!.via }

    const links = linksOf(note)
    const childCost = thisCost + links.length * (note.topic ? 0.001 : 1)
    for (const link of links) {
      queue.push(link)
      if (!costMap.has(link) || childCost < costMap.get(link)!.cost) {
        costMap.set(link, { cost: childCost, via: slug })
      }
    }
    queue.sort((a, b) => costMap.get(a)!.cost - costMap.get(b)!.cost)
  }
  return { nodes: sortKeys(output) }
}

export function sortKeys<T>(object: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.keys(object)
      .sort()
      .map((key) => [key, object[key]]),
  )
}
