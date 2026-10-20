import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/** A published note: one row of `notes_contents`. */
export interface PublishedRow {
  id: string
  source: string
  source_version: string
  compiled: string | null
  compiled_source_version: string | null
  compiled_compiler_version: string | null
}

export type PublishedRowInfo = Omit<PublishedRow, 'source' | 'compiled'>

/** Where published notes live. Supabase in production, memory in tests. */
export interface PublishedStore {
  listRows(): Promise<PublishedRowInfo[]>
  getRows(): Promise<PublishedRow[]>
  upsertRow(row: PublishedRow): Promise<void>
  deleteRow(id: string): Promise<void>
  /** Search key (lowercased slug or alias) → note id. */
  listSearchKeys(): Promise<Map<string, string>>
  upsertSearchKey(key: string, noteId: string): Promise<void>
  deleteSearchKey(key: string): Promise<void>
  /** Writes a file to the public `notes-public` bucket. */
  uploadPublicFile(name: string, contents: string): Promise<void>
}

export const supabaseUrl = 'https://htrqhjrmmqrqaccchyne.supabase.co'

export class SupabaseStore implements PublishedStore {
  private supabase: SupabaseClient

  constructor(apiKey = process.env.SUPABASE_API_KEY) {
    if (!apiKey) throw new Error('SUPABASE_API_KEY is not set')
    this.supabase = createClient(supabaseUrl, apiKey)
  }

  listRows() {
    return this.selectAll<PublishedRowInfo>(
      'notes_contents',
      'id, source_version, compiled_source_version, compiled_compiler_version',
    )
  }

  getRows() {
    return this.selectAll<PublishedRow>('notes_contents', '*')
  }

  async upsertRow(row: PublishedRow) {
    check(await this.supabase.from('notes_contents').upsert(row))
  }

  async deleteRow(id: string) {
    check(await this.supabase.from('notes_contents').delete().eq('id', id))
  }

  async listSearchKeys() {
    const rows = await this.selectAll<{ search_key: string; note_id: string }>(
      'notes_search_keys',
      'search_key, note_id',
    )
    return new Map(rows.map((row) => [row.search_key, row.note_id]))
  }

  async upsertSearchKey(key: string, noteId: string) {
    check(
      await this.supabase
        .from('notes_search_keys')
        .upsert({ search_key: key, note_id: noteId }),
    )
  }

  async deleteSearchKey(key: string) {
    check(
      await this.supabase
        .from('notes_search_keys')
        .delete()
        .eq('search_key', key),
    )
  }

  async uploadPublicFile(name: string, contents: string) {
    check(
      await this.supabase.storage
        .from('notes-public')
        .upload(name, Buffer.from(contents), {
          cacheControl: '60',
          upsert: true,
          contentType: 'application/json',
        }),
    )
  }

  // PostgREST caps a select at 1000 rows by default, so page through.
  private async selectAll<T>(table: string, columns: string): Promise<T[]> {
    const pageSize = 1000
    const all: T[] = []
    for (let from = 0; ; from += pageSize) {
      const result = await this.supabase
        .from(table)
        .select(columns)
        .order(table === 'notes_search_keys' ? 'search_key' : 'id')
        .range(from, from + pageSize - 1)
      const page = check(result) as T[]
      all.push(...page)
      if (page.length < pageSize) return all
    }
  }
}

function check<T>(result: { data: T; error: unknown }): T {
  if (result.error) throw result.error
  return result.data
}

export class MemoryStore implements PublishedStore {
  rows = new Map<string, PublishedRow>()
  searchKeys = new Map<string, string>()
  files = new Map<string, string>()

  async listRows() {
    return [...this.rows.values()].map(
      ({ source, compiled, ...info }) => info,
    )
  }
  async getRows() {
    return [...this.rows.values()]
  }
  async upsertRow(row: PublishedRow) {
    this.rows.set(row.id, { ...row })
  }
  async deleteRow(id: string) {
    this.rows.delete(id)
  }
  async listSearchKeys() {
    return new Map(this.searchKeys)
  }
  async upsertSearchKey(key: string, noteId: string) {
    this.searchKeys.set(key, noteId)
  }
  async deleteSearchKey(key: string) {
    this.searchKeys.delete(key)
  }
  async uploadPublicFile(name: string, contents: string) {
    this.files.set(name, contents)
  }
}
