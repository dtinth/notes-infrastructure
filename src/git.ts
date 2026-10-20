import { $ } from 'bun'

/** A git working tree the server writes to (the vault or the site clone). */
export class GitRepo {
  constructor(public readonly dir: string) {}

  /**
   * Runs git, retrying while another process (an agent, or a human) holds
   * the index lock, since the vault's working tree is shared.
   */
  async git(args: string[], { attempts = 10 } = {}) {
    for (let attempt = 1; ; attempt++) {
      const result = await $`git -C ${this.dir} ${args}`.quiet().nothrow()
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
    await this.git(['push', '--quiet'])
  }
}
