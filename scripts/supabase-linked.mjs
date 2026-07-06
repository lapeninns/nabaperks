import { spawnSync } from "node:child_process"

/**
 * Runs linked-project Supabase CLI commands. The CLI validates
 * `supabase/config.toml` auth hooks even for read-only remote ops; this
 * supplies a formatted placeholder when the real secret is not in the shell.
 */
const hookSecretPlaceholder =
  "v1,whsec_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa="

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
  },
})

process.exit(result.status ?? 1)
