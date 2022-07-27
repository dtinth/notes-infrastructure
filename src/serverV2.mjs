import Fastify from 'fastify'
import { fileURLToPath } from 'url'
import { runWorker } from '../lib/workerClient.mjs'
import secrets from '../secrets.js'

export const app = Fastify({
  logger: true,
})

app.get('/v2/hello', async () => {
  return await runWorker(
    fileURLToPath(new URL('./workers/publish.mjs', import.meta.url))
  ).resultPromise
})

app.post('/v2/github/webhook', async (request, reply) => {
  if (/** @type {any} */ (request.query).key !== secrets.gitHubWebhookKey) {
    reply.status(401)
    return 'unauthorized'
  }
  return 'okie'
})
