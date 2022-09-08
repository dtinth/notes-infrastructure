import { execFileSync } from 'child_process'
import searchEngineFactory from '../lib/searchEngine'
import { indexDocumentIntoSearchEngine } from '../lib/indexer'
import {
  DocumentRepository,
  generatePublicIndex,
} from '../lib/generatePublicIndex'

async function main() {
  const result = await generatePublicIndex(new GitJournalRepository())
  printToc(result.indexNode)
}

class GitJournalRepository implements DocumentRepository {
  searchEngine = searchEngineFactory.create()
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

main()

// writeFileSync('data/metadata/public.json', JSON.stringify(indexNode))
// writeFileSync(
//   'data/metadata/public.index.json',
//   JSON.stringify(searchEngine.minisearch)
// )
// writeFileSync(
//   'data/metadata/public.docs.json',
//   JSON.stringify(Object.fromEntries(searchEngine.documentMap))
// )
