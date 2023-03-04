import Fastify, { FastifyReply, FastifyRequest } from 'fastify'
import { decodeJwt } from 'jose'
import { createFileLog, runWorker } from '../lib/workerClient'
import secrets from '../secrets'
import { firebaseIssuer, validateFirebaseJwt } from './firebaseAuth'
import { validateGoogleJwt } from './googleAuth'
import { searchEngine } from './store'
import cors from '@fastify/cors'
import * as jsonwebtoken from 'jsonwebtoken'
import { z } from 'zod'
import fs from 'fs'
import { createHash } from 'crypto'

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
  const iss = decodeJwt(token).iss
  if (iss === firebaseIssuer) {
    const { payload } = await validateFirebaseJwt(token)
    if (payload.sub !== secrets.firebaseUserId) {
      reply.status(403)
      return 'forbidden'
    }
    return f()
  } else {
    const { payload } = await validateGoogleJwt(token)
    if (payload.sub !== secrets.googleUserId) {
      reply.status(403)
      return 'forbidden'
    }
    return f()
  }
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

app.post('/v2/publish', async (request, reply) => {
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
      const links = (document.links || '')
        .split(' ')
        .map((x) => x.split('#')[0])
        .filter(Boolean)
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

app.register(async (app) => {
  await app.register(cors)

  const getPrivateToken = (id: string) => {
    const jwt = jsonwebtoken.sign({ id }, secrets.previewSigningSecret, {
      algorithm: 'HS256',
      expiresIn: 5 * 86400,
    })
    return jwt
  }

  app.get('/v2/info', async (request, reply) => {
    return authenticate(request, reply, async () => {
      reply.header('Access-Control-Allow-Origin', '*')
      const file = String((request.query as any).slug)
      const owner = String(process.env.VAULT_OWNER)
      const repo = String(process.env.VAULT_REPO)
      return {
        editUrl: `https://github.com/${owner}/${repo}/edit/main/${file}.md`,
        privateToken: getPrivateToken(file),
      }
    })
  })

  const syncSchema = z.object({
    id: z.string().min(1).regex(/^\w+$/),
    write: z
      .object({
        contents: z.string(),
        lastSynchronizedHash: z.string().nullish(),
      })
      .optional(),
  })
  app.post('/v2/synchronize', async (request, reply) => {
    const body = syncSchema.parse(request.body)
    return authenticate(request, reply, async () => {
      const filePath = 'data/' + body.id + '.md'

      const currentContents = fs.existsSync(filePath)
        ? fs.readFileSync(filePath)
        : null
      const currentHash = currentContents
        ? createHash('sha1').update(currentContents).digest('hex')
        : null

      const result = {
        written: false,
        status: 'Retrieved note entry',
        contents: currentContents?.toString('utf8'),
        hash: currentHash,
      }

      if (body.write) {
        const newContents = Buffer.from(body.write.contents)
        const newHash = createHash('sha1').update(newContents).digest('hex')
        if (currentHash && newHash === currentHash) {
          result.status = 'Already up-to-date'
          result.written = true
        } else if (
          currentHash &&
          currentHash !== body.write.lastSynchronizedHash
        ) {
          result.status = 'Data conflict'
        } else if (body.write.lastSynchronizedHash && !currentHash) {
          result.status = 'Removed from here'
        } else {
          result.status = 'Saved'
          result.written = true
          fs.writeFileSync(filePath, newContents)
          result.contents = newContents.toString('utf8')
          result.hash = newHash
        }
      }

      return result
    })
  })
})
