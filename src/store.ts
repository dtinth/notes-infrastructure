import { create } from '../lib/searchEngine'
import chokidar from 'chokidar'
import { indexDocumentIntoSearchEngine } from '../lib/indexer'
import fs from 'fs'

export const searchEngine = create()

chokidar
  .watch('data', {
    ignored: /\.git/,
    awaitWriteFinish: true,
  })
  .on('all', (event, path) => {
    console.log(event, path)
    if (event === 'add' || event === 'change') {
      if (path.match(/^data\/(\w+)\.md$/)) {
        indexDocumentIntoSearchEngine(
          searchEngine,
          path,
          fs.readFileSync(path, 'utf8')
        )
      }
    }
  })
