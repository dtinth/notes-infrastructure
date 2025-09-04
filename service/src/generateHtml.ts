import { generateHtml as generateNoteHtml } from '@notes/html-generator'
import { PublicTree } from './generatePublicTree'

export async function generateHtml(
  source: string,
  slug: string,
  _tree: PublicTree,
) {
  const { result } = await compileNote(source, slug)
  const { compiled } = result
  const html = generateNoteHtml({ slug, compiled })
  return html
}

export async function getCompiler() {
  const compilerPath = '@notes/compiler/dist/compiler/index.js'
  const compiler = (await import(
    compilerPath
  )) as typeof import('@notes/compiler/dist/compiler')
  return compiler
}

export async function compileNote(source: string, slug: string) {
  const compiler = await getCompiler()
  const result = await compiler.compileMarkdown(source, slug)
  return { result, compiler }
}
