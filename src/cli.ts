import { compileMarkdown } from '@notes/compiler/dist/compiler/index.js'
import { resolve } from 'path'
import { compileNote, compilerVersion } from './compiler'
import { apply, computePlan, formatPlanItem } from './plan'
import { serve } from './serve'
import { buildSite } from './site'
import { SupabaseStore } from './store'
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
  case 'plan': {
    const store = new SupabaseStore()
    const plan = computePlan(
      readVault(vaultDir),
      await store.listRows(),
      compilerVersion,
    )
    for (const item of plan) console.log(formatPlanItem(item))
    const count = (op: string) => plan.filter((i) => i.op === op).length
    console.log(
      `${count('create')} to create, ${count('update')} to update, ` +
        `${count('delete')} to delete, ${count('recompile')} to recompile`,
    )
    break
  }
  case 'apply': {
    await apply({
      store: new SupabaseStore(),
      vault: readVault(vaultDir),
      compile: compileNote,
      compilerVersion,
      ids: args.length ? args : undefined,
      log: console.log,
    })
    break
  }
  case 'serve': {
    await serve()
    break
  }
  default:
    console.error(
      'Usage: notes <serve | index | compile <id> | build [outDir] | plan | apply [id...]>',
    )
    process.exit(1)
}
