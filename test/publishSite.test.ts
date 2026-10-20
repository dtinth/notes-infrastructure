import { $ } from 'bun'
import { expect, test } from 'bun:test'
import { existsSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { compileNote } from '../src/compiler'
import { GitRepo } from '../src/git'
import { apply } from '../src/plan'
import { publishSite } from '../src/publishSite'
import { MemoryStore } from '../src/store'
import { readVault } from '../src/vault'

test('publishes the site to the remote, once per change', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'notes-site-'))
  const remote = join(dir, 'remote.git')
  const site = join(dir, 'site')
  await $`git init --quiet --bare --initial-branch=main ${remote}`
  await $`git clone --quiet ${remote} ${site}`.quiet()
  await $`git -C ${site} config user.name test && git -C ${site} config user.email test@example.com`

  const store = new MemoryStore()
  const vault = readVault(`${import.meta.dir}/../example-vault`)
  await apply({ store, vault, compile: compileNote, compilerVersion: 'test' })

  const logs: string[] = []
  const message = await publishSite(store, new GitRepo(site), (m) => logs.push(m))
  expect(message).toMatch(/files changed/)
  expect(logs).toContain('compiled 0 notes, reused 4')
  expect(existsSync(join(site, 'Article.html'))).toBe(true)
  expect(existsSync(join(site, 'Hidden.html'))).toBe(false)

  const remoteLog = await $`git -C ${remote} log --oneline main`.text()
  expect(remoteLog.trim().split('\n')).toHaveLength(1)

  expect(await publishSite(store, new GitRepo(site))).toBeNull()
}, 60_000)
