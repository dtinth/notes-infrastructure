import { $ } from 'bun'
import { expect, test } from 'bun:test'
import { mkdtempSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { GitRepo } from '../src/git'

test('lastModifiedTimes: commit time when clean, mtime when edited', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'notes-git-'))
  await $`git -C ${dir} init --quiet`
  writeFileSync(join(dir, 'Old.md'), 'old')
  writeFileSync(join(dir, 'ก.md'), 'thai')
  writeFileSync(join(dir, 'Edited.md'), 'v1')
  await $`git -C ${dir} add -A && git -C ${dir} -c user.name=t -c user.email=t@t commit --quiet -m init`.env({
    ...process.env,
    GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
  })
  writeFileSync(join(dir, 'Edited.md'), 'v2')
  writeFileSync(join(dir, 'New.md'), 'new')

  const times = await new GitRepo(dir).lastModifiedTimes()
  expect(times.get('Old.md')).toBe(Date.parse('2020-01-01T00:00:00Z'))
  expect(times.get('ก.md')).toBe(Date.parse('2020-01-01T00:00:00Z'))
  expect(times.get('Edited.md')).toBe(statSync(join(dir, 'Edited.md')).mtimeMs)
  expect(times.get('New.md')).toBe(statSync(join(dir, 'New.md')).mtimeMs)
})
