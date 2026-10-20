import type { GitRepo } from './git'
import { buildSiteFromRows } from './site'
import type { PublishedStore } from './store'

/**
 * Rebuilds the static site from published rows into the dt.in.th clone,
 * then commits and pushes it. Returns the commit message, or null when the
 * site didn't change.
 */
export async function publishSite(
  store: PublishedStore,
  repo: GitRepo,
  log: (message: string) => void = () => {},
) {
  await buildSiteFromRows(await store.getRows(), repo.dir, { log })
  const message = await repo.commitAll()
  if (!message) {
    log('site unchanged')
    return null
  }
  await repo.push()
  log(`pushed site: ${message}`)
  return message
}
