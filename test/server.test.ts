import { beforeEach, describe, expect, test } from 'bun:test'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'fs'
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

  test('refuses to save over changes made since the note was loaded', async () => {
    const { note } = await (await s.request('GET', '/api/notes/Article')).json()
    writeFileSync(join(s.dir, 'Article.md'), 'changed by an agent')
    s.vault.refresh('Article')

    const stale = await s.request('PUT', '/api/notes/Article', { source: 'mine', baseVersion: note.version })
    expect(stale.status).toBe(409)
    expect(readFileSync(join(s.dir, 'Article.md'), 'utf-8')).toBe('changed by an agent')

    const { version } = await stale.json()
    const fresh = await s.request('PUT', '/api/notes/Article', { source: 'mine', baseVersion: version })
    expect(fresh.status).toBe(200)
  })

  test('refuses note ids that escape the vault', async () => {
    for (const id of ['..%2Fescape', '.hidden', '%2Ftmp%2Fescape']) {
      const response = await s.request('PUT', `/api/notes/${id}`, { source: 'x' })
      expect(response.status).toBe(400)
    }
    expect(existsSync(join(s.dir, '..', 'escape.md'))).toBe(false)
  })

  test('ignores symlinked notes and never writes through them', async () => {
    const outside = join(s.dir, '..', `outside-${Date.now()}.txt`)
    writeFileSync(outside, '---\npublic: true\n---\nsecret')
    symlinkSync(outside, join(s.dir, 'Link.md'))
    s.vault.refresh('Link')
    expect((await s.request('GET', '/api/notes/Link')).status).toBe(404)

    const saved = await s.request('PUT', '/api/notes/Link', { source: 'overwritten' })
    expect(saved.status).toBe(500)
    expect(readFileSync(outside, 'utf-8')).toContain('secret')
  })

  test('searches every note, private ones too, and marks ones linking here', async () => {
    const search = async (q: string) => (await s.request('POST', '/api/search', { q })).json()
    const draft = await search('private')
    expect(draft[0]).toMatchObject({ id: 'Draft', public: false, linksHere: false })

    const linking = await search('JavaScript')
    expect(linking.find((r: any) => r.id === 'Article')).toMatchObject({ linksHere: true })

    // Saving a note updates the index.
    await s.request('PUT', '/api/notes/Fresh', { source: '# Fresh\n\nZebracorn.' })
    expect((await search('zebracorn')).map((r: any) => r.id)).toEqual(['Fresh'])
  })

  test('requires auth', async () => {
    expect((await s.request('GET', '/api/notes', undefined, '')).status).toBe(401)
  })
})

describe('backoffice', () => {
  test('serves files under /admin/, falling back to the app shell', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notes-backoffice-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), 'shell')
    writeFileSync(join(dir, 'assets/app.js'), 'js')
    writeFileSync(join(dir, '..', 'secret.txt'), 'secret')
    const app = createApp({
      vault: new VaultIndex(s.dir),
      store: new MemoryStore(),
      compile: async () => '',
      compilerVersion: 'test',
      apiKey,
      adminUid: 'admin',
      getSupabaseUserId: async () => 'admin',
      backofficeDir: dir,
    })
    const get = async (path: string) =>
      (await app.handle(new Request(`http://localhost${path}`))).text()
    expect(await get('/admin/')).toBe('shell')
    expect(await get('/admin/assets/app.js')).toBe('js')
    expect(await get('/admin/some/route')).toBe('shell')
    expect(await get('/admin/..%2Fsecret.txt')).toBe('shell')

    const response = await app.handle(new Request('http://localhost/admin/'))
    expect(response.headers.get('x-frame-options')).toBe('DENY')
  })

  test('serves the preview runtime, and nothing outside it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'notes-runtime-'))
    mkdirSync(join(dir, 'runtime/entry'), { recursive: true })
    writeFileSync(join(dir, 'runtime/entry/index.js'), 'runtime')
    writeFileSync(join(dir, 'secret.txt'), 'secret')
    const app = createApp({
      vault: new VaultIndex(s.dir),
      store: new MemoryStore(),
      compile: async () => '',
      compilerVersion: 'test',
      apiKey,
      adminUid: 'admin',
      getSupabaseUserId: async () => 'admin',
      getPreviewRuntimeDir: async () => join(dir, 'runtime'),
    })
    const get = (path: string) => app.handle(new Request(`http://localhost${path}`))
    expect(await (await get('/runtime/entry/index.js')).text()).toBe('runtime')
    expect((await get('/runtime/..%2Fsecret.txt')).status).toBe(404)
    expect((await get('/runtime/missing.js')).status).toBe(404)
  })

  test('previews hot-reload only for a well-formed origin', async () => {
    const origins: (string | undefined)[] = []
    const app = createApp({
      vault: new VaultIndex(s.dir),
      store: new MemoryStore(),
      compile: async () => '',
      compilerVersion: 'test',
      apiKey,
      adminUid: 'admin',
      getSupabaseUserId: async () => 'admin',
      renderPreview: async (source, id, origin) => {
        origins.push(origin)
        return { html: '', compiled: {}, errors: [] }
      },
    })
    const preview = (origin?: string) =>
      app.handle(
        new Request('http://localhost/api/preview', {
          method: 'POST',
          headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
          body: JSON.stringify({ id: 'Draft', source: '# Hi', origin }),
        }),
      )
    expect((await preview()).status).toBe(200)
    expect((await preview('https://notes.example')).status).toBe(200)
    expect((await preview('https://notes.example"><script>')).status).toBe(400)
    expect((await preview('javascript:alert(1)')).status).toBe(400)
    expect(origins).toEqual([undefined, 'https://notes.example'])
  })
})
