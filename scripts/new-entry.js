const fs = require('fs')
const id = 
  new Date()
    .toJSON()
    .replace(/\W/g, "")
    .slice(0, 15) +
    "Z" +
    (10000 + 10000 * Math.random()).toString().slice(-4)

const path = 'data/' + id + '.md'
fs.writeFileSync(path, '---\n---\n\n')
console.log(`--> ${path}`)
