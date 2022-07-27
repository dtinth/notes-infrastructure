import { randomBytes } from 'crypto'
import { mkdirSync, writeFileSync } from 'fs'

mkdirSync('.data/credentials', { recursive: true })
writeFileSync(
  '.data/credentials/local.json',
  JSON.stringify(
    {
      localKey: randomBytes(128).toString('hex'),
    },
    null,
    2
  )
)
