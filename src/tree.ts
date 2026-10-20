export interface TreeNote {
  public: boolean
  topic: boolean
  title: string
  links: string[]
}

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

    const childCost = thisCost + note.links.length * (note.topic ? 0.001 : 1)
    for (const link of note.links) {
      queue.push(link)
      if (!costMap.has(link) || childCost < costMap.get(link)!.cost) {
        costMap.set(link, { cost: childCost, via: slug })
      }
    }
    queue.sort((a, b) => costMap.get(a)!.cost - costMap.get(b)!.cost)
  }
  const sorted = Object.keys(output).sort()
  return { nodes: Object.fromEntries(sorted.map((k) => [k, output[k]])) }
}
