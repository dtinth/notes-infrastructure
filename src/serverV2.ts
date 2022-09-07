import Fastify, { FastifyReply, FastifyRequest } from 'fastify'
import { createFileLog, runWorker } from '../lib/workerClient'
import secrets from '../secrets'
import { validateJwt } from './googleAuth'
import { searchEngine } from './store'

export const app = Fastify({
  logger: true,
})

function getWorkerFile(f: string) {
  return `${__dirname}/workers/${f}`
}

async function authenticate<T>(
  request: FastifyRequest,
  reply: FastifyReply,
  f: () => Promise<T>
) {
  const token = String(request.headers.authorization).split(' ')[1]
  if (token === secrets.apiToken) {
    return f()
  }
  const { payload } = await validateJwt(token)
  if (payload.sub !== secrets.googleUserId) {
    reply.status(403)
    return 'forbidden'
  }
  return f()
}

app.get('/v2/hello', async () => {
  return 'meow'
})

app.post('/v2/github/webhook', async (request, reply) => {
  if ((request.query as any).key !== secrets.gitHubWebhookKey) {
    reply.status(401)
    return 'unauthorized'
  }
  return await runWorker(getWorkerFile('publish.ts'), '', {
    createLog: createFileLog('publish'),
  }).resultPromise
})

app.post('/v2/github/webhook-test', async (request, reply) => {
  return authenticate(request, reply, async () => {
    return await runWorker(getWorkerFile('publish.ts'), '', {
      createLog: createFileLog('publish'),
    }).resultPromise
  })
})

app.get('/v2/test-worker', async (request, reply) => {
  return await runWorker(getWorkerFile('test-worker.ts'), '').resultPromise
})

app.post('/v2/rename', async (request, reply) => {
  return authenticate(request, reply, async () => {
    const body = request.body as any
    const from = String(body.from)
    const to = String(body.to)
    const operations: any[] = []
    for (const [id, document] of searchEngine.documentMap) {
      if (id === from) {
        const aliases = new Set(document.names.split(' '))
        aliases.delete(to)
        operations.push({
          type: 'rename',
          id,
          to,
          aliases: [...aliases],
        })
      }
      const links = (document.links || '').split(' ').filter(Boolean)
      if (links.includes(from)) {
        operations.push({
          type: 'updateLink',
          id,
        })
      }
    }
    return {
      from: body.from,
      to: body.to,
      operations,
    }
  })
})
