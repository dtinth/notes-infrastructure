import { compileNote, compilerVersion } from './compiler'
import { debounced } from './debounce'
import { publishSite } from './publishSite'
import { createApp } from './server'
import { productionSupabaseUrl, SupabaseStore } from './store'
import { VaultIndex } from './vaultIndex'

// Public anon key of the production project, as used by the frontend.
const productionAnonKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0cnFoanJtbXFycWFjY2NoeW5lIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NTkxOTk3NDIsImV4cCI6MTk3NDc3NTc0Mn0.VEdURpInV9dowpoMkHopAzpiBtNnRXDgO6hRfy1ZSHY'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

/** `notes serve`: configured entirely from environment variables. */
export async function serve() {
  const vaultDir = process.env.NOTES_VAULT || process.cwd()
  const siteDir = process.env.NOTES_SITE_DIR
  const supabaseUrl = process.env.SUPABASE_URL || productionSupabaseUrl
  const anonKey = process.env.SUPABASE_ANON_KEY || productionAnonKey
  const log = (message: string) =>
    console.log(`[${new Date().toISOString()}] ${message}`)

  const vault = new VaultIndex(vaultDir)
  vault.watch()
  log(`indexed ${vault.notes.size} notes in ${vaultDir}`)

  const store = new SupabaseStore({ url: supabaseUrl })
  const status: Record<string, unknown> = {}
  const site = siteDir
    ? debounced(async () => {
        status.site = { state: 'publishing', since: new Date().toISOString() }
        const message = await publishSite(store, siteDir, log)
        status.site = { state: 'idle', at: new Date().toISOString(), message }
      }, 10_000)
    : undefined

  const app = createApp({
    vault,
    store,
    compile: compileNote,
    compilerVersion,
    apiKey: requireEnv('NOTES_API_KEY'),
    adminUid: requireEnv('SUPABASE_ADMIN_UID'),
    async getSupabaseUserId(accessToken) {
      const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: { authorization: `Bearer ${accessToken}`, apikey: anonKey },
      })
      if (!response.ok) throw new Error(`auth: ${response.status}`)
      return ((await response.json()) as { id: string }).id
    },
    onPublished: site?.trigger,
    getStatus: () => status,
  })
  app.listen({ port: Number(process.env.PORT || 21024), hostname: '0.0.0.0' })
  log(`listening on ${app.server?.url}`)
}
