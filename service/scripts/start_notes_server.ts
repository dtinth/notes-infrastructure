import chokidar from 'chokidar'
import { Elysia, t } from 'elysia'
import { NotesManager } from '../src/NotesManager'
import { NotesFileSystemSource } from '../src/NotesSource'
import { generatePublicTree } from '../src/generatePublicTree'
import { generateSitegraph } from '../src/generateSitegraph'

// Start a notes manager
const manager = new NotesManager(new NotesFileSystemSource())
await manager.indexAll()

chokidar
  .watch('../data', {
    ignored: /\.git/,
    awaitWriteFinish: true,
    ignoreInitial: true,
  })
  .on('all', (event, path) => {
    console.log('[chokidar]', event, path)
    manager.indexAll()
  })

const app = new Elysia()
  .get('/v2/hello', () => 'meow')
  .group(
    '/private',
    {
      headers: t.Object({
        authorization: t.String({ pattern: '^Bearer .+$' }),
      }),
      beforeHandle({ headers, set }) {
        if (headers.authorization !== 'Bearer ' + process.env.NOTES_API_KEY) {
          set.status = 'Unauthorized'
          return 'Nope!'
        }
      },
    },
    (app) =>
      app
        .get('/list', async () => 'list')
        .get('/tree', async () => generatePublicTree(manager.db))
        .get('/sitegraph', async () =>
          generateSitegraph(manager.db, generatePublicTree(manager.db))
        )
  )
  .listen({ port: 21024, hostname: '127.0.0.1' })

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
