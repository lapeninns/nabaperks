import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { fileURLToPath } from "node:url"

const projectDir = process.cwd()
const migrationVersionPattern = /^\d{14}$/
const migrationFilePattern = /^(\d{14})_.*\.sql$/
const hookSecretPlaceholder =
  "v1,whsec_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa="
const linkedHookUri = "https://nabaperks.com/api/auth/hooks/send-email"

// Baseline for the append-only rule: a migration already present on this ref is
// "released" and must not be edited on a feature branch. Versions listed here
// are explicitly-sanctioned edits (each SHOULD be exceptional and reviewed).
const APPEND_ONLY_BASELINE_REF = "origin/main"
const SANCTIONED_MIGRATION_EDITS = []

if (isMain()) {
  // Git-based structural checks run first and need no linked credentials, so
  // they catch drift even where `migration list --linked` cannot connect.
  const localFiles = listLocalMigrationFiles(projectDir)
  const duplicates = detectDuplicateVersions(localFiles.map((f) => f.version))

  if (duplicates.length) {
    console.error("Duplicate migration versions found (two files share a version):")
    for (const version of duplicates) {
      const names = localFiles.filter((f) => f.version === version).map((f) => f.name)
      console.error(`  ${version}: ${names.join(", ")}`)
    }
    process.exit(1)
  }

  const editBaseline = gitMigrationBlobs(APPEND_ONLY_BASELINE_REF, projectDir)
  if (editBaseline.available) {
    const edited = findEditedAppliedMigrations({
      baseline: editBaseline.entries,
      current: workingTreeMigrationBlobs(projectDir, localFiles),
      sanctioned: SANCTIONED_MIGRATION_EDITS,
    })

    if (edited.length) {
      console.error(
        `Already-released migrations were edited (append-only violation vs ${APPEND_ONLY_BASELINE_REF}):`
      )
      console.error(`  ${edited.join(", ")}`)
      console.error(
        "Add a NEW forward-only migration instead, or record a sanctioned edit."
      )
      process.exit(1)
    }
  } else {
    console.warn(
      `Skipped append-only edit check: ${APPEND_ONLY_BASELINE_REF} is not available.`
    )
  }

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
  return listLocalMigrationFiles(projectDir)
    .map((file) => file.version)
    .sort()
}

export function listLocalMigrationFiles(projectDir) {
  const migrationDir = join(projectDir, "supabase", "migrations")

  if (!existsSync(migrationDir)) return []

  return readdirSync(migrationDir)
    .map((file) => {
      const version = basename(file).match(migrationFilePattern)?.[1] || ""
      return version ? { version, name: file } : null
    })
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Versions used by more than one migration file. A duplicate version silently
 * reorders or shadows a migration in the ledger, which version-set comparison
 * cannot see. Returned unique and sorted.
 */
export function detectDuplicateVersions(versions) {
  const counts = new Map()
  for (const version of versions) {
    counts.set(version, (counts.get(version) ?? 0) + 1)
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([version]) => version)
    .sort()
}

/**
 * Versions present in BOTH baseline and current whose content hash changed and
 * are not on the sanctioned-edit list. baseline/current are arrays of
 * `{ version, sha }`. New or removed files are ignored — only edits to an
 * already-released migration are flagged. Returned sorted.
 */
export function findEditedAppliedMigrations({ baseline, current, sanctioned = [] }) {
  const sanctionedSet = new Set(sanctioned)
  const currentByVersion = new Map(current.map((entry) => [entry.version, entry.sha]))
  const edited = []

  for (const { version, sha } of baseline) {
    if (sanctionedSet.has(version)) continue
    if (!currentByVersion.has(version)) continue
    if (currentByVersion.get(version) !== sha) edited.push(version)
  }

  return [...new Set(edited)].sort()
}

/** `{version, sha}` for each migration blob on a git ref, or unavailable. */
export function gitMigrationBlobs(ref, projectDir) {
  const result = spawnSync(
    "git",
    ["ls-tree", "-r", ref, "--", "supabase/migrations"],
    { cwd: projectDir, encoding: "utf8" }
  )

  if (result.status !== 0) return { available: false, entries: [] }

  const entries = []
  for (const line of (result.stdout || "").split(/\r?\n/)) {
    // Format: "<mode> blob <sha>\t<path>"
    const match = line.match(/^\S+\s+blob\s+(\S+)\t(.+)$/)
    if (!match) continue
    const version = basename(match[2]).match(migrationFilePattern)?.[1]
    if (version) entries.push({ version, sha: match[1] })
  }

  return { available: true, entries }
}

/** Working-tree `{version, sha}` using git's own blob-hash algorithm. */
export function workingTreeMigrationBlobs(projectDir, files = listLocalMigrationFiles(projectDir)) {
  const migrationDir = join(projectDir, "supabase", "migrations")
  return files.map((file) => ({
    version: file.version,
    sha: gitBlobHash(readFileSync(join(migrationDir, file.name))),
  }))
}

/** Git's blob object id: sha1 of "blob <len>\0<content>". */
export function gitBlobHash(buffer) {
  const header = Buffer.from(`blob ${buffer.length}\0`)
  return createHash("sha1").update(Buffer.concat([header, buffer])).digest("hex")
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
