import { createPrivateKey } from 'crypto'
import { importPKCS8, SignJWT } from 'jose'

/**
 * Mints installation tokens for a GitHub App, one per repository, cached
 * until shortly before they expire. Each token only reaches its own
 * repository's contents, even when the installation covers more.
 */
export class GitHubApp {
  private tokens = new Map<string, { token: string; expiresAt: number }>()

  constructor(
    private appId: string,
    /** PEM, PKCS#1 (as GitHub hands it out) or PKCS#8. */
    private privateKey: string,
    private apiUrl = 'https://api.github.com',
  ) {}

  /** `repo` is `owner/name`. */
  async getToken(repo: string) {
    const cached = this.tokens.get(repo)
    if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return cached.token

    const installation = await this.request<{ id: number }>(
      'GET',
      `/repos/${repo}/installation`,
    )
    const { token, expires_at } = await this.request<{
      token: string
      expires_at: string
    }>('POST', `/app/installations/${installation.id}/access_tokens`, {
      repositories: [repo.split('/')[1]],
      permissions: { contents: 'write' },
    })
    this.tokens.set(repo, { token, expiresAt: Date.parse(expires_at) })
    return token
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        authorization: `Bearer ${await this.appJwt()}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
      },
    })
    if (!response.ok) {
      throw new Error(`GitHub ${method} ${path}: ${response.status}`)
    }
    return response.json() as Promise<T>
  }

  private async appJwt() {
    const pkcs8 = createPrivateKey(this.privateKey)
      .export({ type: 'pkcs8', format: 'pem' })
      .toString()
    const now = Math.floor(Date.now() / 1000)
    return new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(this.appId)
      // Backdated for clock drift, as GitHub recommends.
      .setIssuedAt(now - 60)
      .setExpirationTime(now + 9 * 60)
      .sign(await importPKCS8(pkcs8, 'RS256'))
  }
}

/** `owner/name` of a GitHub remote URL, or undefined for other remotes. */
export function parseGitHubRepo(remoteUrl: string) {
  return remoteUrl.match(
    /^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+\/[^/]+?)(?:\.git)?\/?$/,
  )?.[1]
}
