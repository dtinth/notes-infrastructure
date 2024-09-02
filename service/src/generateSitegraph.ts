import { PublicTree } from './generatePublicTree'
import { NotesDatabase } from './NotesDatabase'

/**
 * A sitegraph represents the pages and links of a website.
 */
export interface Sitegraph {
  nodes: { [id: string]: SitegraphNode }
}

export interface SitegraphNode {
  title?: string
  description?: string
  links: SitegraphLink[]
}

export interface SitegraphLink {
  link: string
  displayText?: string
}

export async function generateSitegraph(
  db: NotesDatabase,
  publicTree: PublicTree
): Promise<Sitegraph> {
  const publicIds = Object.keys(publicTree.nodes)
  const nodes: { [id: string]: SitegraphNode } = {}
  for (const id of publicIds) {
    if (id === 'Recent') continue
    const node = db.documentMap.get(id)
    if (!node) {
      continue
    }
    const sitegraphNode: SitegraphNode = {
      title: node.title,
      links: node.links
        .split(' ')
        .filter(Boolean)
        .map((target) => {
          return { link: target }
        }),
    }
    nodes[id] = sitegraphNode
  }
  const sitegraph: Sitegraph = { nodes }
  return sitegraph
}
