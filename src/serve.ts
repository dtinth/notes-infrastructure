import { compileNote, compilerVersion } from './compiler'
import { debounced } from './debounce'
import { GitRepo, type TokenProvider } from './git'
import { GitHubApp, parseGitHubRepo } from './githubApp'
import { join } from 'path'
import { renderPreview } from './preview'
import { publishSite } from './publishSite'
import { createApp } from './server'
import { productionSupabaseUrl, SupabaseStore } from './store'
import { VaultIndex } from './vaultIndex'
import { VaultSync } from './vaultSync'

// Public anon key of the production project, as used by the frontend.
const productionAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0cnFoanJtbXFycWFjY2NoeW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTkxOTk3NDIsImV4cCI6MTk3NDc3NTc0Mn0.VEdURpInV9dowpoMkHopAzpiBtNnRXDgO6hRfy1ZSHY'

// Google OAuth client the frontend signs in with. Its authorized JavaScript
// origins must include the backoffice's origin.
const productionGoogleClientId =
  '347735770628-4n43ifcg3mmce5ema444thhosdtoougl.apps.googleusercontent.com'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/**
 * A PEM from a one-line env var: as is, with `\n` escapes, or base64'd
 * (`base64 -w0 key.pem`), since .env files and multiline values don't mix.
 */
export function decodePem(value: string) {
  const pem = value.includes('-----BEGIN')
    ? value
    : Buffer.from(value, 'base64').toString('utf-8')
  return pem.replaceAll('\\n', '\n')
}

/** `notes serve`: configured entirely from environment variables. */
export async function serve() {
  const vaultDir = process.env.NOTES_VAULT || process.cwd()
  const siteDir = process.env.NOTES_SITE_DIR
  const supabaseUrl = process.env.SUPABASE_URL || productionSupabaseUrl
  const anonKey = process.env.SUPABASE_ANON_KEY || productionAnonKey
  const log = (message: string) =>
    console.log(`[${new Date().toISOString()}] ${message}`)

  const githubApp = process.env.GITHUB_APP_ID
    ? new GitHubApp(
        process.env.GITHUB_APP_ID,
        decodePem(requireEnv('GITHUB_APP_PRIVATE_KEY')),
      )
    : undefined
  /** Token for the GitHub repo behind a remote URL, or a clone's origin. */
  const tokenFor = (dirOrRemote: string): TokenProvider | undefined =>
    githubApp &&
    (async () => {
      const remote = parseGitHubRepo(dirOrRemote)
        ? dirOrRemote
        : await new GitRepo(dirOrRemote).git(['remote', 'get-url', 'origin'])
      const repo = parseGitHubRepo(remote.trim())
      return repo ? githubApp.getToken(repo) : undefined
    })

  const apiKey = requireEnv('NOTES_API_KEY')
  // It also signs session tokens, so a short one could be guessed offline.
  if (apiKey.length < 32) log('warning: NOTES_API_KEY is shorter than 32 characters')

  const vault = new VaultIndex(vaultDir)
  vault.watch()
  log(`indexed ${vault.notes.size} notes in ${vaultDir}`)

  // NOTES_SYNC=0 turns vault sync off, e.g. when the vault isn't a git repo.
  const vaultSync =
    process.env.NOTES_SYNC === '0'
      ? undefined
      : new VaultSync(
          new GitRepo(vaultDir, tokenFor(vaultDir)),
          Number(process.env.NOTES_SYNC_IDLE_MS || 5 * 60_000),
          log,
        )
  if (vaultSync) {
    vault.onChange(() => vaultSync.trigger())
    // Also pull changes made elsewhere when nothing happens locally.
    setInterval(() => vaultSync.trigger(), 15 * 60_000)
    vaultSync.trigger()
  }

  // The dt.in.th clone lives in the server's state volume, cloned on first run.
  if (siteDir && process.env.NOTES_SITE_REMOTE) {
    await new GitRepo(siteDir, tokenFor(process.env.NOTES_SITE_REMOTE)).ensureCloned(
      process.env.NOTES_SITE_REMOTE,
    )
  }

  const store = new SupabaseStore({ url: supabaseUrl })
  const status: Record<string, unknown> = {}
  const site = siteDir
    ? debounced(async () => {
        const since = new Date().toISOString()
        status.site = { state: 'publishing', since }
        try {
          const repo = new GitRepo(siteDir, tokenFor(siteDir))
          const message = await publishSite(store, repo, log)
          status.site = { state: 'idle', at: new Date().toISOString(), message }
        } catch (error) {
          status.site = { state: 'error', since, message: String(error) }
          log(`site: publish failed: ${error}`)
        }
      }, 10_000)
    : undefined

  const app = createApp({
    vault,
    store,
    compile: compileNote,
    compilerVersion,
    apiKey,
    adminUid: requireEnv('SUPABASE_ADMIN_UID'),
    async getSupabaseUserId(accessToken) {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { authorization: `Bearer ${accessToken}`, apikey: anonKey },
      })
      if (!response.ok) throw new Error(`auth: ${response.status}`)
      return ((await response.json()) as { id: string }).id
    },
    onPublished: site?.trigger,
    getStatus: () => ({ ...status, vault: vaultSync?.status }),
    renderPreview,
    backofficeConfig: {
      supabaseUrl,
      supabaseAnonKey: anonKey,
      googleClientId: process.env.GOOGLE_CLIENT_ID || productionGoogleClientId,
    },
    backofficeDir:
      process.env.NOTES_BACKOFFICE_DIR || join(import.meta.dir, '../backoffice/dist'),
    retrySync: vaultSync && (() => vaultSync.retry()),
  })
  app.listen({ port: Number(process.env.PORT || 21024), hostname: '0.0.0.0' })
  log(`listening on ${app.server?.url}`)
}
