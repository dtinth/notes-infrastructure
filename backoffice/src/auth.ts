import { createClient } from '@supabase/supabase-js'
import { setToken } from './api'

interface Config {
  supabaseUrl: string
  supabaseAnonKey: string
  googleClientId: string
}

async function getSupabase() {
  const config: Config = await (await fetch('/backoffice/config')).json()
  return { config, supabase: createClient(config.supabaseUrl, config.supabaseAnonKey) }
}

/** Exchanges the Supabase session (if any) for a notes session token. */
export async function refreshSession() {
  const { supabase } = await getSupabase()
  const { data } = await supabase.auth.getSession()
  const accessToken = data.session?.access_token
  if (!accessToken) return false
  const response = await fetch('/auth/supabase', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ supabaseAccessToken: accessToken }),
  })
  if (!response.ok) return false
  setToken((await response.json()).accessToken)
  return true
}

/** Renders Google's sign-in button into `container`; resolves once signed in. */
export async function signInWithGoogle(container: HTMLElement) {
  const { config, supabase } = await getSupabase()
  await loadScript('https://accounts.google.com/gsi/client')
  const google = (window as any).google
  const credential = await new Promise<string>((resolve) => {
    google.accounts.id.initialize({
      client_id: config.googleClientId,
      callback: (response: { credential: string }) => resolve(response.credential),
    })
    google.accounts.id.renderButton(container, { theme: 'filled_black', size: 'large' })
  })
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token: credential,
  })
  if (error) throw error
  if (!(await refreshSession())) throw new Error('This account is not allowed in.')
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = reject
    document.head.appendChild(script)
  })
}
