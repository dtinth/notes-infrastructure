import { sortKeys, type PublicTree } from './tree'
import { linksOf, type VaultNote } from './vault'

/** The pages of the site and the links between them. */
export interface Sitegraph {
  nodes: Record<string, SitegraphNode>
}

export interface SitegraphNode {
  title?: string
  description?: string
  links: { link: string; displayText?: string }[]
}

export function generateSitegraph(
  notes: Map<string, Pick<VaultNote, 'title' | 'links'>>,
  tree: PublicTree,
): Sitegraph {
  const nodes: Record<string, SitegraphNode> = {}
  for (const id of Object.keys(tree.nodes)) {
    if (id === 'Recent') continue
    const note = notes.get(id)
    if (!note) continue
    nodes[id] = {
      title: note.title,
      links: Array.from(new Set(linksOf(note)), (link) => ({ link })),
    }
  }
  return { nodes: sortKeys(nodes) }
}
