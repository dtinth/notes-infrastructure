const { execSync } = require('child_process')

process.chdir(__dirname + '/../data')
execSync('git add .', { stdio: 'inherit' })
const stats = execSync('git diff --stat --staged')
  .toString()
  .trim()
  .split('\n')
  .pop()
if (stats) {
  execSync('git commit -m "' + stats + '"', { stdio: 'inherit' })
}
execSync('git pull --no-ff', { stdio: 'inherit' })
execSync('git push', { stdio: 'inherit' })
