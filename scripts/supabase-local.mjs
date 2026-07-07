import { spawnSync } from "node:child_process"

/**
 * Runs local Supabase CLI commands with the auth hook secret placeholder the
 * CLI requires when parsing supabase/config.toml.
 */
const hookSecretPlaceholder =
  "v1,whsec_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa="

const args = process.argv.slice(2)

if (!args.length) {
  console.error(
    "Usage: node scripts/supabase-local.mjs <supabase subcommand> [flags...]"
  )
  console.error("Example: node scripts/supabase-local.mjs start")
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
