import { stringify } from '@thai/funny-json'
import { generatePublicTree } from '../src/generatePublicTree'
import { generateSitegraph } from '../src/generateSitegraph'
import { NotesManager } from '../src/NotesManager'
import { NotesFileSystemSource } from '../src/NotesSource'

const manager = new NotesManager(new NotesFileSystemSource())
await manager.indexAll()

const tree = generatePublicTree(manager.db)
console.log(stringify(tree))

const sitegraph = await generateSitegraph(manager.db, tree)
// console.log(stringify(sitegraph))
void sitegraph
