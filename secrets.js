const path = require('path')
const fs = require('fs')
const env = require('dotenv').parse(
  fs.readFileSync(path.join(__dirname, '.env'))
)
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
  bingSearchApiKey: encrypted(`
    AdL8Uce3E/wq4xeLZkaP+zw2H9ojI+n2.zExBmiuHkK96cu9oIy+VCm3X6EDdGLnUepRki1l
    +7IdZNF4OgujvfBYLVKjkhFk6DgE=
  `),
  nodeIdHashingSalt: encrypted(`
    lIj+sUgJO0uHxVL0GqOBM909pkdPY7WE.8raKyneQJZjocFFhMZHVbK3RlQnKwoaR2JEeRZE
    1M9cUbMygcVT+XcOg48t7mAjwBpw0gQCpGDTyx3OXT1I=
  `),
  publicPathPrefix: encrypted(`
    elE70UnDAcVc9NLS0CTkJgvkDfqi2TEI.MYjb6b39rnmexn33YqrCRmpKKVR3RRHLnq98HuW
    Briu33FWBfTqWz+gYZ8lAtd1oFRQ0UdxyGmbUXiEt8Jg7nBgi
  `),
}
