import { expect, test } from 'bun:test'
import { mergeOutsideChanges } from '../backoffice/src/merge'

const base = 'title\n\none\ntwo\nthree\n\nfour\n'

test('merges edits to different parts of the note', () => {
  const ours = base.replace('one', 'ONE')
  const theirs = base.replace('four', 'FOUR')
  expect(mergeOutsideChanges(base, ours, theirs)).toEqual({
    text: 'title\n\nONE\ntwo\nthree\n\nFOUR\n',
    conflict: false,
  })
})

test('marks edits to the same lines as a conflict', () => {
  const { text, conflict } = mergeOutsideChanges(base, base.replace('two', 'mine'), base.replace('two', 'agent'))
  expect(conflict).toBe(true)
  expect(text).toContain('<<<<<<< in the editor\nmine\n=======\nagent\n>>>>>>> on disk')
})

test('takes theirs when the editor has no changes', () => {
  expect(mergeOutsideChanges(base, base, 'new').text).toBe('new')
})
