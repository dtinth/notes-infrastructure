import {
  DocumentNode,
  generatePublicIndex,
  GitJournalRepository,
} from '../lib/generatePublicIndex'

async function main() {
  const result = await generatePublicIndex({ repo: new GitJournalRepository() })
  printToc(result.indexNode!)
}

function printToc(node: DocumentNode, depth = 0) {
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
