import { chmodSync } from 'fs'

const result = await Bun.build({
  entrypoints: ['src/cli.ts'],
  target: 'bun',
  outdir: 'dist',
  naming: 'notes.js',
  minify: true,
  banner: '#!/usr/bin/env bun',
  define: { 'process.env.NODE_ENV': '"production"' },
})
if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}
for (const output of result.outputs) {
  console.log(output.path, `${(output.size / 1e6).toFixed(1)} MB`)
}
chmodSync('dist/notes.js', 0o755)
