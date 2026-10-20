import { compileNote } from '../src/generateHtml'

const variants: Record<string, string> = {
  yaml_plain: "```yaml\nFIREBASE_TOKEN: ${{ steps.auth.outputs.access_token }}\n```",
  yaml_quoted: "```yaml\nFIREBASE_TOKEN: \"${{ steps.auth.outputs.access_token }}\"\n```",
  bash_dollarcurly: "```bash\necho ${{ steps.auth.outputs.access_token }}\n```",
  text_lang: "```text\nFIREBASE_TOKEN: ${{ steps.auth.outputs.access_token }}\n```",
  inline_code: "Use `${{ steps.auth.outputs.access_token }}` here.",
}

for (const [name, md] of Object.entries(variants)) {
  const { result } = await compileNote(md, 'test-' + name)
  const hasCtx = /_ctx\.(env|steps)/.test(result.debuggingInfo.clientEsm ?? '')
  console.log(name, '| errors:', result.errors.length, '| ctx-ref:', hasCtx, '| html-ok:', !result.compiled.html.includes('Compilation unsuccessful'))
  if (result.errors.length) console.log('  ', result.errors[0].slice(0, 200))
}
