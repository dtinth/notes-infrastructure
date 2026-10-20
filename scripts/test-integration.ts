/**
 * Runs the tests against the local Supabase from `npx supabase start`,
 * reading its URL and keys from `supabase status`.
 */
import { $ } from 'bun'

const status = await $`npx -y supabase@2.121.0 status -o json`.quiet().json()
const result = await $`bun test ${process.argv.slice(2)}`
  .env({
    ...process.env,
    NOTES_TEST_SUPABASE_URL: status.API_URL,
    NOTES_TEST_SUPABASE_KEY: status.SERVICE_ROLE_KEY,
    NOTES_TEST_SUPABASE_ANON_KEY: status.ANON_KEY,
  })
  .nothrow()
process.exit(result.exitCode)
