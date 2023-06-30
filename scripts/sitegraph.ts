import {
  generatePublicIndex,
  GitJournalRepository,
} from '../lib/generatePublicIndex'
import { Sitegraph, generateSitegraph } from '../lib/generateSitegraph'

async function main() {
  const repo = new GitJournalRepository()
  const publicIndex = await generatePublicIndex({ repo })
  const sitegraph: Sitegraph = await generateSitegraph({ publicIndex, repo })
  console.log(JSON.stringify(sitegraph, null, 2))
}

main()
