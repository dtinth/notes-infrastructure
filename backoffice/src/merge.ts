import { merge } from 'node-diff3'

export const CONFLICT_START = '<<<<<<< in the editor'

/**
 * Merges changes made outside the editor (`theirs`, e.g. by an agent) into
 * the editor's unsaved text (`ours`), both edited from `base`. Where both
 * changed the same lines, git-style conflict markers are left in the text.
 */
export function mergeOutsideChanges(base: string, ours: string, theirs: string) {
  const lines = (text: string) => text.split('\n')
  const { conflict, result } = merge(lines(ours), lines(base), lines(theirs))
  const labeled = result.map((line) =>
    line === '<<<<<<<' ? CONFLICT_START : line === '>>>>>>>' ? '>>>>>>> on disk' : line,
  )
  return { text: labeled.join('\n'), conflict }
}
