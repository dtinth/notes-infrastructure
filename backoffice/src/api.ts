/** Talks to `notes serve`. */

export interface NoteSummary {
  id: string
  title: string
  version: string
  public: boolean
}

export type PlanItem =
  | { op: 'create' | 'update' | 'recompile'; id: string }
  | { op: 'delete'; id: string; reason: 'unpublished' | 'missing' }

export interface Status {
  compilerVersion: string
  vault?: { state: string; message?: string; lastSyncedAt?: string; lastCommit?: string }
  site?: { state: string; message?: string | null; at?: string }
}

const TOKEN_KEY = 'notes:token'

export class Unauthorized extends Error {}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {}
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: {
      authorization: `Bearer ${getToken()}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (response.status === 401) throw new Unauthorized()
  if (!response.ok) {
    throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`)
  }
  return response.json()
}

export const api = {
  listNotes: () => request<NoteSummary[]>('GET', '/api/notes'),
  getNote: (id: string) =>
    request<{ source: string; note: { version: string } }>(
      'GET',
      `/api/notes/${encodeURIComponent(id)}`,
    ),
  saveNote: (id: string, source: string) =>
    request<{ version: string }>('PUT', `/api/notes/${encodeURIComponent(id)}`, { source }),
  plan: () => request<{ items: PlanItem[] }>('GET', '/api/plan'),
  apply: (ids?: string[]) => request<{ items: PlanItem[] }>('POST', '/api/apply', { ids }),
  status: () => request<Status>('GET', '/api/status'),
  retrySync: () => request<unknown>('POST', '/api/sync/retry'),
  preview: (id: string, source: string) =>
    request<{ html: string; errors: string[] }>('POST', '/api/preview', { id, source }),
}

export function planSymbol(item: PlanItem) {
  return { create: '+', update: '~', delete: '−', recompile: '↻' }[item.op]
}
