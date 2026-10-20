import { compileMarkdown } from '@notes/compiler/dist/compiler/index.js'
import pkg from '../package.json'

/**
 * Identifies the compiler that produced a row's `compiled` column. It is the
 * pinned @notes/compiler release, so upgrading the package recompiles every
 * published note. (Legacy used a hand-bumped number, which went stale.)
 */
export const compilerVersion = pkg.dependencies['@notes/compiler'].match(
  /notes-compiler-(.+)\.tgz$/,
)![1]

export type CompileFn = (source: string, id: string) => Promise<string>

/** Compiles a note into the JSON string stored in `notes_contents.compiled`. */
export const compileNote: CompileFn = async (source, id) => {
  const { compiled } = await compileMarkdown(source, id)
  return JSON.stringify(compiled)
}
