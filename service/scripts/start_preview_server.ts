import { staticPlugin } from '@elysiajs/static'
import { createCache } from 'async-cache-dedupe'
import { Elysia, redirect } from 'elysia'
import { appClient, headers } from '../src/appClient'
import { generateHtml } from '../src/generateHtml'

const treeCache = createCache({ ttl: 60, stale: 50 }).define(
  'getTree',
  async () => {
    const { data, error } = await appClient.private.tree.get({ headers })
    if (error) throw error
    return data
  },
)

const app = new Elysia()
  .use(
    staticPlugin({
      assets: 'node_modules/@notes/compiler/dist/compiler',
      prefix: '/compiler',
    }),
  )
  .use(
    staticPlugin({
      assets: 'node_modules/@notes/client/dist/static',
      prefix: '/static',
    }),
  )
  .use(
    staticPlugin({
      assets: 'node_modules/@notes/client/dist/runtime',
      prefix: '/runtime',
    }),
  )
  .get('/', () => {
    return redirect('/HomePage')
  })
  .get('/:slug', async ({ params: { slug } }) => {
    const source = await Bun.file('../data/' + slug + '.md').text()
    const tree = await treeCache.getTree()
    const html = await generateHtml(source, slug, tree)
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  })
  .listen({ port: 22024, hostname: '127.0.0.1' })

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
)
