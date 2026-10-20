import { afterAll, expect, test } from 'bun:test'
import { generateKeyPairSync } from 'crypto'
import { importSPKI, jwtVerify } from 'jose'
import { GitHubApp, parseGitHubRepo } from '../src/githubApp'

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
    requests.push(`${request.method} ${pathname}`)
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

test('mints an installation token with a PKCS#1 key, then caches it', async () => {
  const app = new GitHubApp('12345', pkcs1, fakeGitHub.url.origin)
  expect(await app.getToken('dtinth/notes')).toBe('ghs_test')
  expect(await app.getToken('dtinth/notes')).toBe('ghs_test')
  expect(requests).toEqual([
    'GET /repos/dtinth/notes/installation',
    'POST /app/installations/99/access_tokens',
  ])
})

test('parseGitHubRepo', () => {
  expect(parseGitHubRepo('https://github.com/dtinth/dt.in.th')).toBe('dtinth/dt.in.th')
  expect(parseGitHubRepo('https://github.com/dtinth/notes.git')).toBe('dtinth/notes')
  expect(parseGitHubRepo('git@github.com:dtinth/notes.git')).toBe('dtinth/notes')
  expect(parseGitHubRepo('/tmp/remote.git')).toBeUndefined()
})
