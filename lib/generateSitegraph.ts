import { DocumentRepository, PublicIndex } from './generatePublicIndex'

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

export async function generateSitegraph({
  publicIndex,
  repo,
}: {
  publicIndex: PublicIndex
  repo: DocumentRepository
}): Promise<Sitegraph> {
  const nodes: { [id: string]: SitegraphNode } = {}
  for (const id of publicIndex.ids) {
    if (id === 'Recent') continue
    const node = await repo.getDocument(id)
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
