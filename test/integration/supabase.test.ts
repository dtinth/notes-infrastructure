/**
 * Runs against a local Supabase with the schema in supabase/migrations:
 *
 *   npx supabase start
 *   NOTES_TEST_SUPABASE_URL=http://127.0.0.1:54321 \
 *   NOTES_TEST_SUPABASE_KEY=<service role key> \
 *   NOTES_TEST_SUPABASE_ANON_KEY=<anon key> bun test
 *
 * Skipped when those aren't set. Never point it at production: it wipes
 * the tables.
 */
import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, test } from 'bun:test'
import { compileNote } from '../../src/compiler'
import { apply, computePlan } from '../../src/plan'
import { SupabaseStore } from '../../src/store'
import { readVault } from '../../src/vault'

const url = process.env.NOTES_TEST_SUPABASE_URL
const apiKey = process.env.NOTES_TEST_SUPABASE_KEY
const anonKey = process.env.NOTES_TEST_SUPABASE_ANON_KEY

const configured = !!(url && apiKey && anonKey)

describe.skipIf(!configured)('SupabaseStore', () => {
  // describe bodies run even when skipped, so only connect when configured.
  if (!configured) return
  const admin = createClient(url, apiKey, { auth: { persistSession: false } })
  const anon = createClient(url, anonKey, { auth: { persistSession: false } })
  const store = new SupabaseStore({ url, apiKey })
  const vault = readVault(`${import.meta.dir}/../../example-vault`)

  beforeEach(async () => {
    await admin.from('notes_contents').delete().neq('id', '')
    await admin.from('notes_search_keys').delete().neq('search_key', '')
  })

  test('apply publishes what the frontend reads', async () => {
    await apply({ store, vault, compile: compileNote, compilerVersion: 'test' })
    expect(computePlan(vault, await store.listRows(), 'test')).toEqual([])

    // An unlisted note, looked up by the frontend the way it does on 404.html.
    const { data, error } = await anon.rpc('notes_get_contents', {
      input_search_key: 'hidden',
    })
    expect(error).toBeNull()
    expect(data[0].id).toBe('Hidden')
    expect(JSON.parse(data[0].compiled).html).toContain('Hidden')

    // An alias.
    const alias = await anon.rpc('notes_get_contents', { input_search_key: 'js' })
    expect(alias.data[0].id).toBe('JavaScript')

    // Private notes are never published.
    const draft = await anon.rpc('notes_get_contents', { input_search_key: 'draft' })
    expect(draft.data).toEqual([])

    const response = await fetch(
      `${url}/storage/v1/object/public/notes-public/notes.tree.json`,
    )
    const tree = await response.json()
    expect(Object.keys(tree.nodes)).toEqual(['Article', 'HomePage', 'JavaScript'])
  }, 30_000)

  test('the anon key cannot read tables directly', async () => {
    await apply({ store, vault, compile: compileNote, compilerVersion: 'test' })
    const { data } = await anon.from('notes_contents').select('id')
    expect(data ?? []).toEqual([])
  }, 30_000)

  test('reads more than one page of rows', async () => {
    const keys = Array.from({ length: 1234 }, (_, i) => ({
      search_key: `k${i}`,
      note_id: 'X',
    }))
    await admin.from('notes_search_keys').insert(keys)
    expect((await store.listSearchKeys()).size).toBe(1234)
  })
})
