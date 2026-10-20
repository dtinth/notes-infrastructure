import { debounced } from './debounce'
import { GitRepo } from './git'

export type VaultSyncState =
  | { state: 'idle'; lastSyncedAt?: string; lastCommit?: string }
  | { state: 'syncing'; since: string }
  /** Auto-sync is paused until someone resolves it and calls `retry`. */
  | { state: 'conflict'; since: string; message: string }
  | { state: 'error'; since: string; message: string }

/**
 * Keeps the vault's git repo in sync: commits local changes once things go
 * quiet, rebases onto the remote, and pushes. Stops on conflict.
 */
export class VaultSync {
  status: VaultSyncState = { state: 'idle' }
  private sync: ReturnType<typeof debounced>

  constructor(
    private repo: GitRepo,
    idleMs = 5 * 60_000,
    private log: (message: string) => void = () => {},
  ) {
    this.sync = debounced(() => this.run(), idleMs)
  }

  /** Call on every vault change. */
  trigger() {
    if (this.status.state === 'conflict') return
    this.sync.trigger()
  }

  /** Syncs now, also after a conflict once it has been fixed by hand. */
  async retry() {
    this.status = { state: 'idle' }
    await this.sync.flush()
    return this.status
  }

  private async run() {
    const since = new Date().toISOString()
    this.status = { state: 'syncing', since }
    try {
      const commit = await this.repo.commitAll()
      if (commit) this.log(`vault: committed ${commit}`)
      if (!(await this.repo.pullRebase())) {
        this.status = {
          state: 'conflict',
          since,
          message: 'Local and remote vault changes conflict. Merge them by hand, then retry.',
        }
        this.log('vault: conflict, auto-sync paused')
        return
      }
      await this.repo.push()
      this.status = {
        state: 'idle',
        lastSyncedAt: new Date().toISOString(),
        ...(commit ? { lastCommit: commit } : {}),
      }
    } catch (error) {
      this.status = { state: 'error', since, message: String(error) }
      this.log(`vault: sync failed: ${error}`)
    }
  }
}
