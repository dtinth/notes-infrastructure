/**
 * Checks the static site output against the live dt.in.th repo.
 *
 * The live repo has a `.md` copy of every listed note, so those make a vault.
 * We build into a copy of the live checkout and let git show what changed.
 */
import { $ } from 'bun'
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { buildSite } from '../src/site'
import { readVault } from '../src/vault'

const dir = '.out/parity'
const live = join(dir, 'live')
const vault = join(dir, 'vault')
const out = join(dir, 'out')

if (existsSync(live)) {
  await $`git -C ${live} pull --quiet --ff-only`
} else {
  mkdirSync(dir, { recursive: true })
  await $`git clone --quiet --depth 1 https://github.com/dtinth/dt.in.th ${live}`
}
rmSync(vault, { recursive: true, force: true })
rmSync(out, { recursive: true, force: true })
mkdirSync(vault)
for (const file of readdirSync(live)) {
  if (file.endsWith('.md')) cpSync(join(live, file), join(vault, file))
}
cpSync(live, out, { recursive: true })

await buildSite(readVault(vault), out, { log: console.log })

const changed = (await $`git -C ${out} status --porcelain`.text())
  .split('\n')
  .filter(Boolean)
const html = changed.filter((line) => line.endsWith('.html'))
const assets = changed.filter((line) => / (compiler|runtime|static)\//.test(line))
const other = changed.filter((line) => !html.includes(line) && !assets.includes(line))
console.log(`changed: ${html.length} pages, ${assets.length} asset files`)
if (other.length) {
  console.log('other changes (unexpected):')
  for (const line of other) console.log(`  ${line}`)
  process.exitCode = 1
}
console.log(`inspect with: git -C ${out} diff`)
