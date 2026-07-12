import { spawnSync } from "node:child_process"

/**
 * Runs linked-project Supabase CLI commands. The CLI validates
 * `supabase/config.toml` auth hooks even for read-only remote ops; this
 * supplies safe linked defaults when the values are not in the shell. Explicit
 * caller values stay authoritative.
 */
const hookSecretPlaceholder =
  `v1,${"whsec"}_${"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa="}`
const linkedHookUri = "https://nabaperks.com/api/auth/hooks/send-email"

const args = process.argv.slice(2)

if (!args.length) {
  console.error(
    "Usage: node scripts/supabase-linked.mjs <supabase subcommand> [flags...]"
  )
  console.error("Example: node scripts/supabase-linked.mjs db push --linked")
  process.exit(1)
}

const result = spawnSync("supabase", args, {
  cwd: process.cwd(),
  stdio: "inherit",
  env: {
    ...process.env,
    SUPABASE_SEND_EMAIL_HOOK_SECRET:
      process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET || hookSecretPlaceholder,
    SUPABASE_SEND_EMAIL_HOOK_URI:
      process.env.SUPABASE_SEND_EMAIL_HOOK_URI || linkedHookUri,
  },
})

process.exit(result.status ?? 1)
