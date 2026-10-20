import pMap from 'p-map'
import { generateSearchIndex, generateSearchKeys } from './search'
import { generateSitegraph } from './sitegraph'
import type { PublishedRowInfo, PublishedStore } from './store'
import { generatePublicTree } from './tree'
import { parseNote, type VaultNote } from './vault'
import type { CompileFn } from './compiler'

/**
 * One step from the published state (Supabase rows) toward the desired state
 * (`public: true` in the vault).
 */
export type PlanItem =
  | { op: 'create'; id: string }
  | { op: 'update'; id: string }
  | { op: 'delete'; id: string; reason: 'unpublished' | 'missing' }
  /** Same source, but compiled by another compiler or from an old source. */
  | { op: 'recompile'; id: string }

export function computePlan(
  vault: Map<string, Pick<VaultNote, 'public' | 'version'>>,
  rows: PublishedRowInfo[],
  compilerVersion: string,
): PlanItem[] {
  const plan: PlanItem[] = []
  const rowMap = new Map(rows.map((row) => [row.id, row]))
  for (const [id, note] of vault) {
    if (!note.public) continue
    const row = rowMap.get(id)
    if (!row) {
      plan.push({ op: 'create', id })
    } else if (row.source_version !== note.version) {
      plan.push({ op: 'update', id })
    }
  }
  for (const row of rows) {
    const note = vault.get(row.id)
    if (!note || !note.public) {
      plan.push({
        op: 'delete',
        id: row.id,
        reason: note ? 'unpublished' : 'missing',
      })
    } else if (
      row.source_version === note.version &&
      (row.compiled_compiler_version !== compilerVersion ||
        row.compiled_source_version !== row.source_version)
    ) {
      plan.push({ op: 'recompile', id: row.id })
    }
  }
  return plan.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

export function formatPlanItem(item: PlanItem) {
  switch (item.op) {
    case 'create':
      return `+ ${item.id}`
    case 'update':
      return `~ ${item.id}`
    case 'delete':
      return `- ${item.id} (${item.reason})`
    case 'recompile':
      return `↻ ${item.id}`
  }
}

export interface ApplyOptions {
  store: PublishedStore
  vault: Map<string, VaultNote>
  compile: CompileFn
  compilerVersion: string
  /** Only apply items for these notes. All items when omitted. */
  ids?: string[]
  log?: (message: string) => void
}

/** Applies the plan, then refreshes everything derived from published rows. */
export async function apply(options: ApplyOptions) {
  const { store, vault, compile, compilerVersion } = options
  const log = options.log ?? (() => {})
  let plan = computePlan(vault, await store.listRows(), compilerVersion)
  if (options.ids) {
    const ids = new Set(options.ids)
    plan = plan.filter((item) => ids.has(item.id))
  }
  const recompiling = new Set(
    plan.filter((item) => item.op === 'recompile').map((item) => item.id),
  )
  const storedSources = new Map(
    recompiling.size
      ? (await store.getRows())
          .filter((row) => recompiling.has(row.id))
          .map((row) => [row.id, row])
      : [],
  )

  await pMap(
    plan,
    async (item) => {
      if (item.op === 'delete') {
        await store.deleteRow(item.id)
      } else {
        const { source, source_version } =
          item.op === 'recompile'
            ? storedSources.get(item.id)!
            : fromVault(vault.get(item.id)!)
        await store.upsertRow({
          id: item.id,
          source,
          source_version,
          compiled: await compile(source, item.id),
          compiled_source_version: source_version,
          compiled_compiler_version: compilerVersion,
        })
      }
      log(formatPlanItem(item))
    },
    { concurrency: 4 },
  )

  if (plan.length > 0) {
    await syncDerivedData(store, log)
  }
  return plan
}

function fromVault(note: VaultNote) {
  return { source: note.source, source_version: note.version }
}

/**
 * Recomputes the tree, sitegraph, search index and search keys from the
 * published rows only, so nothing about an unpublished note can leak.
 */
export async function syncDerivedData(
  store: PublishedStore,
  log: (message: string) => void = () => {},
) {
  const notes = new Map(
    (await store.getRows()).map((row) => [row.id, parseNote(row.id, row.source)]),
  )
  const tree = generatePublicTree(notes)
  await store.uploadPublicFile('notes.tree.json', JSON.stringify(tree))
  await store.uploadPublicFile(
    'notes.sitegraph.json',
    JSON.stringify(generateSitegraph(notes, tree)),
  )
  await store.uploadPublicFile(
    'notes.index.json',
    JSON.stringify(generateSearchIndex(notes, tree)),
  )

  const desired = generateSearchKeys(notes.values())
  const actual = await store.listSearchKeys()
  let changed = 0
  for (const [key, id] of desired) {
    if (actual.get(key) !== id) {
      await store.upsertSearchKey(key, id)
      changed++
    }
  }
  for (const key of actual.keys()) {
    if (!desired.has(key)) {
      await store.deleteSearchKey(key)
      changed++
    }
  }
  log(`synced tree, sitegraph, index, ${changed} search key changes`)
}
