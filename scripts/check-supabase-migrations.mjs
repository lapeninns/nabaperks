import { spawnSync } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

const projectDir = process.cwd()
const migrationVersionPattern = /^\d{14}$/
const hookSecretPlaceholder =
  "v1,whsec_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa="
const linkedHookUri = "https://nabaperks.com/api/auth/hooks/send-email"

if (isMain()) {
  const result = runSupabaseMigrationList(projectDir, process.env)

  if (result.status !== 0) {
    console.error("Unable to read linked Supabase migration state.")
    if (result.output.trim()) {
      console.error(result.output.trim())
    }
    process.exit(result.status || 1)
  }

  const localVersions = listLocalMigrationVersions(projectDir)
  const remoteVersions = parseRemoteMigrationVersions(result.output)
  const diff = diffMigrationVersions(localVersions, remoteVersions)

  if (!remoteVersions.length) {
    console.error("No remote Supabase migrations were parsed from CLI output.")
    process.exit(1)
  }

  if (diff.missingOnRemote.length || diff.extraOnRemote.length) {
    console.error(
      "Linked Supabase migrations are not aligned with local files."
    )

    if (diff.missingOnRemote.length) {
      console.error(`Missing on remote: ${diff.missingOnRemote.join(", ")}`)
    }

    if (diff.extraOnRemote.length) {
      console.error(`Remote-only: ${diff.extraOnRemote.join(", ")}`)
    }

    process.exit(1)
  }

  console.log(
    `Linked Supabase migrations are aligned (${localVersions.length} local, ${remoteVersions.length} remote).`
  )
}

export function runSupabaseMigrationList(projectDir, env) {
  const result = spawnSync("supabase", ["migration", "list", "--linked"], {
    cwd: projectDir,
    encoding: "utf8",
    env: {
      ...env,
      // `supabase migration list --linked` is read-only, but the CLI still
      // validates auth hook config before connecting. These linked defaults
      // only unblock config parsing when caller values are absent.
      SUPABASE_SEND_EMAIL_HOOK_SECRET:
        env.SUPABASE_SEND_EMAIL_HOOK_SECRET || hookSecretPlaceholder,
      SUPABASE_SEND_EMAIL_HOOK_URI:
        env.SUPABASE_SEND_EMAIL_HOOK_URI || linkedHookUri,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  return {
    output: `${result.stdout || ""}${result.stderr || ""}${result.error?.message || ""}`,
    status: result.status ?? 1,
  }
}

export function listLocalMigrationVersions(projectDir) {
  const migrationDir = join(projectDir, "supabase", "migrations")

  if (!existsSync(migrationDir)) return []

  return readdirSync(migrationDir)
    .map((file) => basename(file).match(/^(\d{14})_.*\.sql$/)?.[1] || "")
    .filter(Boolean)
    .sort()
}

export function parseRemoteMigrationVersions(output) {
  const versions = new Set()

  for (const line of output.split(/\r?\n/)) {
    if (!line.includes("|")) continue

    const columns = line.split("|").map((column) => column.trim())
    const remoteVersion = columns[1] || ""

    if (migrationVersionPattern.test(remoteVersion)) {
      versions.add(remoteVersion)
    }
  }

  return [...versions].sort()
}

export function diffMigrationVersions(localVersions, remoteVersions) {
  const local = new Set(localVersions)
  const remote = new Set(remoteVersions)

  return {
    missingOnRemote: localVersions.filter((version) => !remote.has(version)),
    extraOnRemote: remoteVersions.filter((version) => !local.has(version)),
  }
}

function isMain() {
  return process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
}
