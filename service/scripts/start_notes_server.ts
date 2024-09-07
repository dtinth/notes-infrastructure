import { cors } from '@elysiajs/cors'
import chokidar from 'chokidar'
import { Elysia, t } from 'elysia'
import MiniSearch from 'minisearch'
import { searchEngineOptions } from '../src/NotesDatabase'
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
  .use(cors())
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
        .post('/refresh', async () => manager.indexAll())
        .get('/list', async () => 'list')
        .get('/tree', async () => generatePublicTree(manager.db))
        .get('/sitegraph', async () =>
          generateSitegraph(manager.db, generatePublicTree(manager.db))
        )
        .get('/publicIndex', async () => {
          const searchEngine = new MiniSearch(searchEngineOptions)
          const publicIds = Object.keys(generatePublicTree(manager.db).nodes)
          for (const id of publicIds) {
            const document = manager.db.documentMap.get(id)
            if (document) searchEngine.add(document)
          }
          return searchEngine.toJSON()
        })
        .get('/list', async () => ({
          notes: Object.fromEntries(
            Array.from(manager.db.documentMap.values(), (note): [
              string,
              string
            ] => [note.id, note.version])
          ),
        }))
        .get('/searchKeys', async () => ({
          searchKeys: Object.fromEntries(
            Array.from(manager.db.documentMap.values()).flatMap((note) =>
              note.public
                ? note.names
                    .split(' ')
                    .map((name) => [name.toLowerCase(), note.id])
                : []
            )
          ),
        }))
        .get('/public', async () => ({
          notes: Object.fromEntries(
            Array.from(manager.db.documentMap.values())
              .filter((note) => note.public)
              .map((note): [string, string] => [note.id, note.version])
          ),
        }))
        .get('/notes/:id', async ({ params }) => {
          const { id } = params
          const note = manager.db.documentMap.get(id)
          const source = manager.db.contentsMap.get(id)
          return { note, source }
        })
  )
  .listen({ port: 21024, hostname: '127.0.0.1' })

export type App = typeof app

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
