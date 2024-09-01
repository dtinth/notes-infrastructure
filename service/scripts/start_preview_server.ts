import { staticPlugin } from '@elysiajs/static'
import { Elysia, redirect } from 'elysia'
import { generateHtml } from '../src/generateHtml'

const app = new Elysia()
  .use(
    staticPlugin({
      assets: 'node_modules/notes-frontend/dist/assets',
      prefix: '/assets',
    })
  )
  .use(
    staticPlugin({
      assets: 'node_modules/notes-frontend/dist/lib',
      prefix: '/lib',
    })
  )
  .use(
    staticPlugin({
      assets: 'node_modules/notes-frontend/dist/runtime',
      prefix: '/runtime',
    })
  )
  .get('/', () => {
    return redirect('/HomePage')
  })
  .get('/:slug', async ({ params: { slug } }) => {
    const source = await Bun.file('../data/' + slug + '.md').text()
    const html = await generateHtml(source, slug)
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  })
  .listen({ port: 22024, hostname: '127.0.0.1' })

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
