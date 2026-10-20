import { cors } from '@elysiajs/cors'
import { Elysia, t } from 'elysia'
import { mintAccessToken, verifyAccessToken } from './accessToken'
import type { CompileFn } from './compiler'
import { apply, computePlan, formatPlanItem } from './plan'
import type { PublishedStore } from './store'
import { isValidNoteId, type VaultIndex } from './vaultIndex'

export interface ServerDeps {
  vault: VaultIndex
  store: PublishedStore
  compile: CompileFn
  compilerVersion: string
  /** Signs session tokens, and is itself accepted as a bearer token (CLI). */
  apiKey: string
  /** Supabase user id of the one person allowed in. */
  adminUid: string
  /** Resolves a Supabase access token to its user id. */
  getSupabaseUserId: (accessToken: string) => Promise<string>
  /** Called after an apply changed something, e.g. to rebuild the site. */
  onPublished?: () => void
  /** Extra status to report, e.g. vault sync state. */
  getStatus?: () => Record<string, unknown>
  /** Resumes vault sync after a conflict was resolved by hand. */
  retrySync?: () => Promise<unknown>
}

export function createApp(deps: ServerDeps) {
  const { vault, store, compile, compilerVersion, apiKey } = deps

  const isAuthorized = async (authorization: string | undefined) => {
    const token = authorization?.match(/^Bearer (.+)$/)?.[1]
    if (!token) return false
    if (token === apiKey) return true
    try {
      await verifyAccessToken(token, apiKey)
      return true
    } catch {
      return false
    }
  }

  const noteResponse = (id: string) => {
    const note = vault.notes.get(id)
    if (!note) return null
    const { source, ...rest } = note
    return { note: rest, source }
  }

  const authenticated = new Elysia()
    .onBeforeHandle(async ({ headers, set }) => {
      if (!(await isAuthorized(headers.authorization))) {
        set.status = 'Unauthorized'
        return { error: 'Unauthorized' }
      }
    })
    .as('scoped')

  return (
    new Elysia()
      .use(cors())
      .get('/', () => 'notes')

      // Exchanges a Supabase session for a notes session (frontend contract).
      .post(
        '/auth/supabase',
        async ({ body, set }) => {
          let userId: string
          try {
            userId = await deps.getSupabaseUserId(body.supabaseAccessToken)
          } catch {
            set.status = 'Unauthorized'
            return { error: 'Unauthorized' }
          }
          if (userId !== deps.adminUid) {
            set.status = 'Unauthorized'
            return { error: 'Unauthorized' }
          }
          return { accessToken: await mintAccessToken(apiKey) }
        },
        { body: t.Object({ supabaseAccessToken: t.String() }) },
      )

      // Private notes for the frontend's private mode (frontend contract).
      .group('/web', (app) =>
        app.use(authenticated).get('/notes/:id', ({ params, set }) => {
          const response = noteResponse(params.id)
          if (!response) set.status = 'Not Found'
          return response ?? { error: 'Not Found' }
        }),
      )

      .group('/api', (app) =>
        app
          .use(authenticated)
          .get('/notes', () =>
            [...vault.notes.values()]
              .map((note) => ({
                id: note.id,
                title: note.title,
                version: note.version,
                public: note.public,
              }))
              .sort((a, b) => a.id.localeCompare(b.id)),
          )
          .get('/notes/:id', ({ params, set }) => {
            const response = noteResponse(params.id)
            if (!response) set.status = 'Not Found'
            return response ?? { error: 'Not Found' }
          })
          .put(
            '/notes/:id',
            ({ params, body, set }) => {
              if (!isValidNoteId(params.id)) {
                set.status = 'Bad Request'
                return { error: 'Invalid note id' }
              }
              vault.write(params.id, body.source)
              return { version: vault.notes.get(params.id)!.version }
            },
            { body: t.Object({ source: t.String() }) },
          )
          .get('/plan', async () => {
            const items = computePlan(
              vault.notes,
              await store.listRows(),
              compilerVersion,
            )
            return { items, lines: items.map(formatPlanItem) }
          })
          .post(
            '/apply',
            async ({ body }) => {
              const items = await apply({
                store,
                vault: vault.notes,
                compile,
                compilerVersion,
                ids: body.ids,
              })
              if (items.length > 0) deps.onPublished?.()
              return { items, lines: items.map(formatPlanItem) }
            },
            { body: t.Object({ ids: t.Optional(t.Array(t.String())) }) },
          )
          .get('/status', () => ({ compilerVersion, ...deps.getStatus?.() }))
          .post('/sync/retry', async () => ({ vault: await deps.retrySync?.() })),
      )
  )
}

export type App = ReturnType<typeof createApp>
