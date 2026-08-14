import { spawnSync } from "node:child_process"

/**
 * Runs local Supabase CLI commands with the auth hook defaults the CLI needs
 * when parsing supabase/config.toml. Explicit caller values stay authoritative.
 */
const hookSecretPlaceholder = `v1,${"whsec"}_${"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa="}`
const localHookUri =
  "http://host.docker.internal:3000/api/auth/hooks/send-email"
const allowedCommands = new Set(["start", "status", "stop"])
const allowedFlags = {
  start: new Set(["--debug", "--help", "-h", "--ignore-health-check"]),
  status: new Set(["--debug", "--help", "-h"]),
  stop: new Set(["--debug", "--help", "-h", "--no-backup"]),
}
const remoteEnvironmentKeys = [
  "DATABASE_URL",
  "SUPABASE_DB_URL",
  "SUPABASE_PROJECT_ID",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_URL",
]

const args = process.argv.slice(2)

if (!args.length) {
  console.error(
    "Usage: node scripts/supabase-local.mjs <supabase subcommand> [flags...]"
  )
  console.error("Example: node scripts/supabase-local.mjs start")
  process.exit(1)
}

if (!isAllowedInvocation(args)) {
  console.error("Refusing unsafe Supabase arguments.")
  process.exit(2)
}

if (remoteEnvironmentKeys.some((key) => process.env[key])) {
  console.error("Refusing unsafe Supabase environment.")
  process.exit(2)
}

const result = spawnSync("supabase", args, {
  cwd: process.cwd(),
  shell: false,
  timeout: 10_000,
  stdio: "inherit",
  env: {
    ...process.env,
    SUPABASE_SEND_EMAIL_HOOK_SECRET:
      process.env.SUPABASE_SEND_EMAIL_HOOK_SECRET || hookSecretPlaceholder,
    SUPABASE_SEND_EMAIL_HOOK_URI:
      process.env.SUPABASE_SEND_EMAIL_HOOK_URI || localHookUri,
  },
})

process.exit(result.status ?? 1)

function isAllowedInvocation([command, ...flags]) {
  if (!allowedCommands.has(command)) return false
  return flags.every((flag) => allowedFlags[command].has(flag))
}
