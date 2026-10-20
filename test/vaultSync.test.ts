import { $ } from 'bun'
import { beforeEach, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { GitRepo } from '../src/git'
import { VaultSync } from '../src/vaultSync'

let dir: string, server: string, laptop: string, sync: VaultSync

async function clone(name: string) {
  const path = join(dir, name)
  await $`git clone --quiet ${join(dir, 'remote.git')} ${path}`.quiet()
  await $`git -C ${path} config user.name ${name} && git -C ${path} config user.email ${name}@example.com`
  return path
}

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'notes-sync-'))
  await $`git init --quiet --bare --initial-branch=main ${join(dir, 'remote.git')}`
  laptop = await clone('laptop')
  writeFileSync(join(laptop, 'A.md'), 'one\ntwo\nthree\n')
  await $`git -C ${laptop} add . && git -C ${laptop} commit -qm init && git -C ${laptop} push -q origin main`.quiet()
  server = await clone('server')
  sync = new VaultSync(new GitRepo(server), 50)
})

const edit = async (repo: string, file: string, content: string, push = false) => {
  writeFileSync(join(repo, file), content)
  if (push) {
    await $`git -C ${repo} commit -qam edit && git -C ${repo} push -q`.quiet()
  }
}

test('commits and pushes local changes, and pulls remote ones', async () => {
  await edit(laptop, 'A.md', 'one\ntwo\nthree\nfour\n', true)
  await edit(server, 'B.md', 'new note\n')
  const status = await sync.retry()

  expect(status).toMatchObject({ state: 'idle', lastCommit: '1 file changed, 1 insertion(+)' })
  expect(readFileSync(join(server, 'A.md'), 'utf-8')).toContain('four')
  await $`git -C ${laptop} pull -q`.quiet()
  expect(readFileSync(join(laptop, 'B.md'), 'utf-8')).toBe('new note\n')
})

test('pauses on conflict, leaving the working tree alone, until retried', async () => {
  await edit(laptop, 'A.md', 'one\nLAPTOP\nthree\n', true)
  await edit(server, 'A.md', 'one\nSERVER\nthree\n')
  expect(await sync.retry()).toMatchObject({ state: 'conflict' })
  expect(readFileSync(join(server, 'A.md'), 'utf-8')).toBe('one\nSERVER\nthree\n')
  expect(await $`git -C ${server} status`.text()).not.toContain('rebase in progress')

  // Further changes don't sync while paused.
  sync.trigger()
  await Bun.sleep(100)
  expect(sync.status.state).toBe('conflict')

  // Someone merges by hand, then retries.
  await $`git -C ${server} pull -q --no-rebase -X ours`.quiet()
  expect(await sync.retry()).toMatchObject({ state: 'idle' })
  await $`git -C ${laptop} pull -q`.quiet()
  expect(readFileSync(join(laptop, 'A.md'), 'utf-8')).toBe('one\nSERVER\nthree\n')
})

test('debounces bursts of changes into one commit', async () => {
  for (const n of [1, 2, 3]) {
    await edit(server, `N${n}.md`, `${n}\n`)
    sync.trigger()
  }
  await Bun.sleep(400)
  const log = await $`git -C ${dir}/remote.git log --oneline main`.text()
  expect(log.trim().split('\n')).toHaveLength(2)
})
