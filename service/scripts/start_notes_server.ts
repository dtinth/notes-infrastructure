import { Elysia, t } from 'elysia'

const app = new Elysia()
  .get('/v2/hello', () => 'meow')
  .group(
    '/private',
    {
      headers: t.Object({
        authorization: t.String({ pattern: '^Bearer .+$' }),
      }),
      beforeHandle({ headers, set }) {
        if (headers.authorization !== 'Bearer secret') {
          set.status = 'Unauthorized'
          return 'Nope!'
        }
      },
    },
    (app) => app.get('/list', () => 'list')
  )
  .listen({ port: 21024, hostname: '127.0.0.1' })

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
