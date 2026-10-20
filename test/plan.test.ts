import { beforeEach, describe, expect, test } from 'bun:test'
import { apply, computePlan } from '../src/plan'
import { MemoryStore } from '../src/store'
import { parseNote, type VaultNote } from '../src/vault'

const compile = async (source: string, id: string) => `compiled:${id}:${source.length}`

function vaultOf(notes: Record<string, string>) {
  return new Map<string, VaultNote>(
    Object.entries(notes).map(([id, source]) => [id, parseNote(id, source)]),
  )
}

const home = '---\npublic: true\n---\n# Home\n\n[A](A) [Draft](Draft)'
const a = '---\npublic: true\naliases: [aa]\n---\n# A'
const draft = '# Draft\n\nPrivate.'

describe('computePlan', () => {
  test('creates public notes that have no row, ignores private ones', () => {
    const plan = computePlan(vaultOf({ HomePage: home, Draft: draft }), [], 'v1')
    expect(plan).toEqual([{ op: 'create', id: 'HomePage' }])
  })

  test('updates, deletes and recompiles', () => {
    const vault = vaultOf({
      HomePage: home,
      A: a.replace('# A', '# A changed'),
      Draft: draft,
    })
    const row = (id: string, source_version: string, compiler = 'v1') => ({
      id,
      source_version,
      compiled_source_version: source_version,
      compiled_compiler_version: compiler,
    })
    const plan = computePlan(
      vault,
      [
        row('HomePage', vault.get('HomePage')!.version, 'v0'),
        row('A', 'old'),
        row('Draft', 'whatever'),
        row('Gone', 'whatever'),
      ],
      'v1',
    )
    expect(plan).toEqual([
      { op: 'update', id: 'A' },
      { op: 'delete', id: 'Draft', reason: 'unpublished' },
      { op: 'delete', id: 'Gone', reason: 'missing' },
      { op: 'recompile', id: 'HomePage' },
    ])
  })
})

describe('apply', () => {
  let store: MemoryStore
  beforeEach(() => {
    store = new MemoryStore()
  })

  test('publishes rows and derived data, then the plan is empty', async () => {
    const vault = vaultOf({ HomePage: home, A: a, Draft: draft })
    await apply({ store, vault, compile, compilerVersion: 'v1' })

    expect([...store.rows.keys()].sort()).toEqual(['A', 'HomePage'])
    expect(store.rows.get('A')!.compiled).toBe(`compiled:A:${a.length}`)
    expect(Object.fromEntries(store.searchKeys)).toEqual({
      a: 'A',
      aa: 'A',
      homepage: 'HomePage',
    })
    const tree = JSON.parse(store.files.get('notes.tree.json')!)
    expect(Object.keys(tree.nodes)).toEqual(['A', 'HomePage'])
    expect(computePlan(vault, await store.listRows(), 'v1')).toEqual([])
  })

  test('derived data never mentions unpublished notes', async () => {
    const vault = vaultOf({ HomePage: home, A: a })
    await apply({ store, vault, compile, compilerVersion: 'v1', ids: ['HomePage'] })

    expect([...store.rows.keys()]).toEqual(['HomePage'])
    const tree = JSON.parse(store.files.get('notes.tree.json')!)
    expect(Object.keys(tree.nodes)).toEqual(['HomePage'])
    expect(store.files.get('notes.index.json')).not.toContain('"A"')
  })

  test('unpublishing deletes the row and its search keys', async () => {
    await apply({ store, vault: vaultOf({ HomePage: home, A: a }), compile, compilerVersion: 'v1' })
    const unpublished = vaultOf({ HomePage: home, A: a.replace('public: true', 'public: false') })
    const plan = await apply({ store, vault: unpublished, compile, compilerVersion: 'v1' })

    expect(plan).toEqual([{ op: 'delete', id: 'A', reason: 'unpublished' }])
    expect(store.rows.has('A')).toBe(false)
    expect(store.searchKeys.has('aa')).toBe(false)
  })

  test('recompiles when the compiler version changes', async () => {
    await apply({ store, vault: vaultOf({ HomePage: home }), compile, compilerVersion: 'v1' })
    const stored = store.rows.get('HomePage')!.source
    await apply({ store, vault: vaultOf({ HomePage: home }), compile, compilerVersion: 'v2' })

    const row = store.rows.get('HomePage')!
    expect(row.source).toBe(stored)
    expect(row.compiled_compiler_version).toBe('v2')
  })
})
