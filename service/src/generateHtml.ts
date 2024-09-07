import { PublicTree } from './generatePublicTree'

export async function generateHtml(
  source: string,
  slug: string,
  tree: PublicTree
) {
  const { result, compiler } = await compileNote(source, slug)
  const template = await Bun.file(
    'node_modules/notes-frontend/dist/index.html'
  ).text()
  const { compiled } = result
  const html = compiler.applyTemplate({
    slug,
    template,
    compiled,
    publicTree: tree,
  })
  return html
}

export async function getCompiler() {
  const compilerPath = 'notes-frontend/dist/lib/compiler/index.js'
  const compiler = await import(compilerPath)
  return compiler
}

export async function compileNote(source: string, slug: string) {
  const compiler = await getCompiler()
  const result = await compiler.compileMarkdown(source, slug)
  return { result, compiler }
}
