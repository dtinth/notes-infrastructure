const path = require('path');
const fs = require('fs')
const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname, '.env')))
const encrypted = require('@dtinth/encrypted')(env.ENCRYPTION_SECRET)

module.exports = {
  previewSigningSecret: encrypted(`
    N5qbfhlRUWf+z5OajuJ7MozRijSv6aKC.xWbAzJnD7FRxlP9/R7VtAhLzXLtJq4qgnxFvSuj
    Hqsngg5hLAu669RQ4e6TjHWalj4o=
  `),
  apiToken: encrypted(`
    QmZJg0pL+yoFv+l3VC6hcq1kSr53O5vQ.oSAseI7NCcPiWxuhqyNNk47rzZU4d2b9IGB+qdv
    68tBS7A9BsG7a/95W9gK1zI/JsgE=
  `),
}