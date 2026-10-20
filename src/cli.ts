import { compileMarkdown } from '@notes/compiler/dist/compiler/index.js'
import { generateHtml } from '@notes/html-generator'
import { mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
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
    mkdirSync(outDir, { recursive: true })
    const notes = readVault(vaultDir)
    const tree = generatePublicTree(notes)
    for (const id of Object.keys(tree.nodes)) {
      const note = notes.get(id)!
      const { compiled } = await compileMarkdown(note.source, id)
      const html = generateHtml({ slug: id, compiled })
      writeFileSync(join(outDir, `${id}.html`), html)
      if (id === 'HomePage') writeFileSync(join(outDir, 'index.html'), html)
      console.log(`built ${id}.html`)
    }
    writeFileSync(join(outDir, 'api-tree.json'), JSON.stringify(tree, null, 2))
    break
  }
  default:
    console.error('Usage: notes <index|compile <id>|build [outDir]>')
    process.exit(1)
}
