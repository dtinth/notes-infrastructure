import { $ } from 'bun'

/** Returns a GitHub token for pushing and pulling, if there is one. */
export type TokenProvider = () => Promise<string | undefined>

/** A git working tree the server writes to (the vault or the site clone). */
export class GitRepo {
  constructor(
    public readonly dir: string,
    private getToken?: TokenProvider,
  ) {}

  /**
   * Runs git, retrying while another process (an agent, or a human) holds
   * the index lock, since the vault's working tree is shared.
   */
  async git(args: string[], { attempts = 10, network = false } = {}) {
    const auth = network ? await this.authArgs() : []
    for (let attempt = 1; ; attempt++) {
      const result = await $`git -C ${this.dir} ${auth} ${args}`.quiet().nothrow()
      if (result.exitCode === 0) return result.stdout.toString()
      const stderr = result.stderr.toString()
      if (stderr.includes('index.lock') && attempt < attempts) {
        await Bun.sleep(200 * attempt)
        continue
      }
      throw new Error(`git ${args.join(' ')} failed: ${stderr.trim()}`)
    }
  }

  /**
   * Commits everything, with the stat line as the message (like legacy
   * `yarn sync`). Returns the message, or null when there was nothing to
   * commit.
   */
  async commitAll() {
    await this.git(['add', '--all'])
    const stat = (await this.git(['diff', '--staged', '--stat'])).trim()
    const message = stat.split('\n').pop()?.trim()
    if (!message) return null
    await this.git(['commit', '--quiet', '-m', message])
    return message
  }

  async push() {
    await this.git(['push', '--quiet'], { network: true })
  }

  /**
   * Pulls with rebase. On conflict, aborts the rebase so the working tree is
   * left as it was, and returns false.
   */
  async pullRebase() {
    try {
      // rebase=merges keeps merge commits someone made by hand to resolve a
      // conflict, instead of flattening them and hitting the conflict again.
      await this.git(['pull', '--quiet', '--rebase=merges'], { network: true })
      return true
    } catch (error) {
      const status = await this.git(['status'])
      if (!status.includes('rebase in progress')) throw error
      await this.git(['rebase', '--abort'])
      return false
    }
  }

  // The token goes in a per-command header, so it never lands in .git/config.
  private async authArgs() {
    const token = await this.getToken?.()
    if (!token) return []
    const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
    return ['-c', `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`]
  }
}
