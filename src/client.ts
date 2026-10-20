import type { PlanItem } from './plan'

/** Talks to a running `notes serve`, as agents and the CLI do. */
export function createClient({
  url = process.env.NOTES_URL || 'http://127.0.0.1:21024',
  apiKey = process.env.NOTES_API_KEY,
} = {}) {
  if (!apiKey) throw new Error('NOTES_API_KEY is not set')
  const request = async <T>(method: string, path: string, body?: unknown) => {
    const response = await fetch(new URL(path, url), {
      method,
      headers: {
        authorization: `Bearer ${apiKey}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      throw new Error(`${method} ${path}: ${response.status} ${await response.text()}`)
    }
    return response.json() as Promise<T>
  }
  return {
    plan: () => request<{ items: PlanItem[]; lines: string[] }>('GET', '/api/plan'),
    apply: (ids?: string[]) =>
      request<{ items: PlanItem[]; lines: string[] }>('POST', '/api/apply', { ids }),
    status: () => request<Record<string, unknown>>('GET', '/api/status'),
    retrySync: () => request<Record<string, unknown>>('POST', '/api/sync/retry'),
  }
}
