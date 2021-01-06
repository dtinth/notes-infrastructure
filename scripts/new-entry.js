const fs = require('fs')
const id =
  new Date(
    process.argv[2] ? Date.parse(process.argv[2] + '+07:00') : Date.now()
  )
    .toJSON()
    .replace(/\W/g, '')
    .slice(0, 15) +
  'Z' +
  (10000 + 10000 * Math.random()).toString().slice(-4)

const path = 'data/' + id + '.md'
fs.writeFileSync(path, '---\n---\n\n')
console.log(`--> ${path}`)
