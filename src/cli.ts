import { compileMarkdown } from '@notes/compiler/dist/compiler/index.js'
import { resolve } from 'path'
import { createClient } from './client'
import { compilerVersion } from './compiler'
import { computePlan, formatPlanItem } from './plan'
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
    // --direct reads Supabase without a server, e.g. to check for a
    // zero-change plan before cutover. Needs SUPABASE_API_KEY.
    const items = args.includes('--direct')
      ? computePlan(readVault(vaultDir), await new SupabaseStore().listRows(), compilerVersion)
      : (await createClient().plan()).items
    for (const item of items) console.log(formatPlanItem(item))
    const count = (op: string) => items.filter((i) => i.op === op).length
    console.log(
      `${count('create')} to create, ${count('update')} to update, ` +
        `${count('delete')} to delete, ${count('recompile')} to recompile`,
    )
    break
  }
  case 'apply': {
    const { lines } = await createClient().apply(args.length ? args : undefined)
    for (const line of lines) console.log(line)
    console.log(lines.length ? `applied ${lines.length}` : 'nothing to apply')
    break
  }
  case 'status': {
    console.log(JSON.stringify(await createClient().status(), null, 2))
    break
  }
  case 'sync-retry': {
    console.log(JSON.stringify(await createClient().retrySync(), null, 2))
    break
  }
  case 'serve': {
    await serve()
    break
  }
  default:
    console.error(`Usage: notes <command>

Talking to a running server (NOTES_URL, NOTES_API_KEY):
  plan             what would be published, updated or unpublished
  apply [id...]    apply the plan, or only for these notes
  status           vault sync and site state
  sync-retry       resume vault sync after fixing a conflict

Local (NOTES_VAULT, or the current directory):
  serve            run the server
  plan --direct    plan against Supabase without a server (SUPABASE_API_KEY)
  index            list notes as private, listed or unlisted
  compile <id>     print a note's compiled output
  build [outDir]   build the static site from public notes`)
    process.exit(1)
}
