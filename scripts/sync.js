const { execSync } = require('child_process')

process.chdir(__dirname + '/../data')
execSync('git add .', { stdio: 'inherit' })
const stats = execSync('git diff --stat --staged')
  .toString()
  .trim()
  .split('\n')
  .pop()
  ?.trim()
if (stats) {
  execSync('git commit -m "' + stats + '"', { stdio: 'inherit' })
}
execSync('git pull --no-ff --no-edit', { stdio: 'inherit' })
execSync('git push', { stdio: 'inherit' })

process.chdir(__dirname + '/../service')
execSync(
  '~/.local/share/mise/shims/bun --env-file=.env run scripts/publish.ts',
  { stdio: 'inherit' }
)
execSync(
  '~/.local/share/mise/shims/bun --env-file=.env run scripts/generate_static_site.ts',
  { stdio: 'inherit' }
)
