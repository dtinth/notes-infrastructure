import Fastify from 'fastify'
import { fileURLToPath } from 'url'
import { createFileLog, runWorker } from '../lib/workerClient.mjs'
import secrets from '../secrets.js'

export const app = Fastify({
  logger: true,
})

function getWorkerFile(f) {
  return fileURLToPath(new URL('./workers/' + f, import.meta.url))
}

app.get('/v2/hello', async () => {
  return 'meow'
})

app.post('/v2/github/webhook', async (request, reply) => {
  if (/** @type {any} */ (request.query).key !== secrets.gitHubWebhookKey) {
    reply.status(401)
    return 'unauthorized'
  }
  return await runWorker(getWorkerFile('publish.mjs'), '', {
    createLog: createFileLog('publish'),
  }).resultPromise
})
