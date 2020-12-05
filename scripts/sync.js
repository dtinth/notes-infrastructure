const { execSync } = require('child_process')

process.chdir(__dirname + '/../journal')
execSync('git add .', { stdio: 'inherit' })
const stats = execSync('git diff --stat --staged').toString().trim().split('\n').pop()
execSync('git commit -m "' + stats + '"', { stdio: 'inherit' })
execSync('git pull', { stdio: 'inherit' })
execSync('git push', { stdio: 'inherit' })
