import { afterAll, expect, test } from 'bun:test'
import { generateKeyPairSync } from 'crypto'
import { importSPKI, jwtVerify } from 'jose'
import { GitHubApp, parseGitHubRepo } from '../src/githubApp'
import { decodePem } from '../src/serve'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const pkcs1 = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString()
const spki = publicKey.export({ type: 'spki', format: 'pem' }).toString()

const requests: string[] = []
const fakeGitHub = Bun.serve({
  port: 0,
  async fetch(request) {
    const jwt = request.headers.get('authorization')!.replace('Bearer ', '')
    const { payload } = await jwtVerify(jwt, await importSPKI(spki, 'RS256'))
    if (payload.iss !== '12345') return new Response('bad iss', { status: 401 })
    const { pathname } = new URL(request.url)
    const body = request.method === 'POST' ? ` ${await request.text()}` : ''
    requests.push(`${request.method} ${pathname}${body}`)
    if (pathname === '/repos/dtinth/notes/installation') return Response.json({ id: 99 })
    if (pathname === '/app/installations/99/access_tokens') {
      return Response.json({
        token: 'ghs_test',
        expires_at: new Date(Date.now() + 3600_000).toISOString(),
      })
    }
    return new Response('not found', { status: 404 })
  },
})
afterAll(() => fakeGitHub.stop())

test('mints a token scoped to one repo with a PKCS#1 key, then caches it', async () => {
  const app = new GitHubApp('12345', pkcs1, fakeGitHub.url.origin)
  expect(await app.getToken('dtinth/notes')).toBe('ghs_test')
  expect(await app.getToken('dtinth/notes')).toBe('ghs_test')
  expect(requests).toEqual([
    'GET /repos/dtinth/notes/installation',
    'POST /app/installations/99/access_tokens {"repositories":["notes"],"permissions":{"contents":"write"}}',
  ])
})

test('parseGitHubRepo', () => {
  expect(parseGitHubRepo('https://github.com/dtinth/dt.in.th')).toBe('dtinth/dt.in.th')
  expect(parseGitHubRepo('https://github.com/dtinth/notes.git')).toBe('dtinth/notes')
  expect(parseGitHubRepo('git@github.com:dtinth/notes.git')).toBe('dtinth/notes')
  expect(parseGitHubRepo('/tmp/remote.git')).toBeUndefined()
  expect(parseGitHubRepo('https://evil.example/github.com/dtinth/notes')).toBeUndefined()
})

test('decodePem takes the key as is, with \\n escapes, or base64', () => {
  const escaped = pkcs1.trim().replaceAll('\n', '\\n')
  expect(decodePem(pkcs1)).toBe(pkcs1)
  expect(decodePem(escaped)).toBe(pkcs1.trim())
  expect(decodePem(Buffer.from(pkcs1).toString('base64'))).toBe(pkcs1)
})
