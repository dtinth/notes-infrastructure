import { beforeEach, describe, expect, test } from 'bun:test'
import { cpSync, existsSync, mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createApp } from '../src/server'
import { MemoryStore } from '../src/store'
import { VaultIndex } from '../src/vaultIndex'

const apiKey = 'test-api-key'

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'notes-vault-'))
  cpSync(`${import.meta.dir}/../example-vault`, dir, { recursive: true })
  const vault = new VaultIndex(dir)
  const store = new MemoryStore()
  let published = 0
  const app = createApp({
    vault,
    store,
    compile: async (source, id) => JSON.stringify({ html: `${id}:${source.length}` }),
    compilerVersion: 'test',
    apiKey,
    adminUid: 'admin',
    getSupabaseUserId: async (token) => {
      if (token === 'admin-session') return 'admin'
      if (token === 'other-session') return 'someone-else'
      throw new Error('invalid')
    },
    onPublished: () => published++,
  })
  const request = (method: string, path: string, body?: unknown, token = apiKey) =>
    app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      }),
    )
  return { dir, vault, store, request, published: () => published }
}

let s: ReturnType<typeof setup>
beforeEach(() => {
  s = setup()
})

describe('frontend contract', () => {
  test('exchanges the admin’s Supabase session for a token that reads private notes', async () => {
    const auth = await s.request('POST', '/auth/supabase', { supabaseAccessToken: 'admin-session' }, '')
    expect(auth.status).toBe(200)
    const { accessToken } = await auth.json()

    const note = await s.request('GET', '/web/notes/Draft', undefined, accessToken)
    expect(note.status).toBe(200)
    expect((await note.json()).source).toContain('Private note')
  })

  test('rejects anyone else', async () => {
    const other = await s.request('POST', '/auth/supabase', { supabaseAccessToken: 'other-session' }, '')
    expect(other.status).toBe(401)
    const invalid = await s.request('POST', '/auth/supabase', { supabaseAccessToken: 'nope' }, '')
    expect(invalid.status).toBe(401)
    const noToken = await s.request('GET', '/web/notes/Draft', undefined, '')
    expect(noToken.status).toBe(401)
    const badToken = await s.request('GET', '/web/notes/Draft', undefined, 'forged')
    expect(badToken.status).toBe(401)
  })
})

describe('api', () => {
  test('plan, apply, then nothing left to do', async () => {
    const plan = await (await s.request('GET', '/api/plan')).json()
    expect(plan.lines).toEqual(['+ Article', '+ Hidden', '+ HomePage', '+ JavaScript'])

    const applied = await (await s.request('POST', '/api/apply', {})).json()
    expect(applied.lines).toHaveLength(4)
    expect(s.published()).toBe(1)

    const after = await (await s.request('GET', '/api/plan')).json()
    expect(after.items).toEqual([])
  })

  test('applies only the requested notes', async () => {
    await s.request('POST', '/api/apply', { ids: ['HomePage'] })
    expect([...s.store.rows.keys()]).toEqual(['HomePage'])
  })

  test('saving a note writes the file and shows up in the plan', async () => {
    await s.request('POST', '/api/apply', {})
    const source = '---\npublic: true\n---\n# Article\n\nEdited.'
    const saved = await s.request('PUT', '/api/notes/Article', { source })
    expect(saved.status).toBe(200)
    expect(readFileSync(join(s.dir, 'Article.md'), 'utf-8')).toBe(source)

    const plan = await (await s.request('GET', '/api/plan')).json()
    expect(plan.lines).toEqual(['~ Article'])
  })

  test('refuses note ids that escape the vault', async () => {
    for (const id of ['..%2Fescape', '.hidden', '%2Ftmp%2Fescape']) {
      const response = await s.request('PUT', `/api/notes/${id}`, { source: 'x' })
      expect(response.status).toBe(400)
    }
    expect(existsSync(join(s.dir, '..', 'escape.md'))).toBe(false)
  })

  test('requires auth', async () => {
    expect((await s.request('GET', '/api/notes', undefined, '')).status).toBe(401)
  })
})
