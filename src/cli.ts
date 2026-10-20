import { compileMarkdown } from '@notes/compiler/dist/compiler/index.js'
import { resolve } from 'path'
import { buildSite } from './site'
import { generatePublicTree } from './tree'
import { readVault } from './vault'

const [command, ...args] = process.argv.slice(2)
const vaultDir = process.env.NOTES_VAULT || process.cwd()

switch (command) {
  case 'index': {
    const notes = readVault(vaultDir)
    const tree = generatePublicTree(notes)
    for (const note of notes.values()) {
      const state = !note.public
        ? 'private'
        : note.id in tree.nodes
        ? 'listed'
        : 'unlisted'
      console.log(`${state.padEnd(8)} ${note.version.slice(0, 8)} ${note.id}`)
    }
    break
  }
  case 'compile': {
    const note = readVault(vaultDir).get(args[0])
    if (!note) throw new Error(`No such note: ${args[0]}`)
    const { compiled } = await compileMarkdown(note.source, note.id)
    console.log(JSON.stringify(compiled, null, 2))
    break
  }
  case 'build': {
    const outDir = resolve(args[0] || 'dist-site')
    const notes = readVault(vaultDir)
    const publicNotes = new Map([...notes].filter(([, note]) => note.public))
    await buildSite(publicNotes, outDir, { log: console.log })
    break
  }
  default:
    console.error('Usage: notes <index|compile <id>|build [outDir]>')
    process.exit(1)
}
