import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const MIGRATIONS_DIR = path.join(projectRoot, "supabase", "migrations")
const MIGRATION_FILENAME = /^(\d{14})_[a-z0-9_]+\.sql$/

// Production applies migrations with `supabase db push --linked --include-all`,
// which also applies a pending file dated before the ledger head. A fresh
// database would run that file earlier, so production and fresh schemas could
// differ where later migrations redefine the same function. The directory
// already contains future-dated files, so a new file named after today's date
// can still sort before existing migrations.
//
// Recorded high-water mark: the migration set at or before it is frozen by
// count and digest (the same idea as Atlas's atlas.sum directory checksum).
// New migrations must sort after it. To raise the mark, update all three
// constants together to the new latest filename and the reported actual values.
const BASELINE = {
  highWaterMark: "20261005100500_reward_unlocked_reflects_minted_reward.sql",
  count: 224,
  digest: "1feb229294afc1e631c80a3b54a6254c84770ef8b84e9e84931eee0a388d3cd7",
}

function versionOf(file) {
  return MIGRATION_FILENAME.exec(file)?.[1] ?? null
}

function namingViolations(files) {
  const violations = []
  const seen = new Map()
  for (const file of files) {
    const version = versionOf(file)
    if (version === null) {
      violations.push(
        `${file}: name must match <14-digit version>_<snake_case>.sql`
      )
      continue
    }
    if (seen.has(version)) {
      violations.push(`${file}: version already used by ${seen.get(version)}`)
    }
    seen.set(version, file)
  }
  return violations
}

function highWaterMarkViolations(files, baseline) {
  if (!files.includes(baseline.highWaterMark)) {
    return [
      `high-water mark ${baseline.highWaterMark} is missing; applied migrations are forward-only and must not be renamed or deleted`,
    ]
  }
  const markVersion = versionOf(baseline.highWaterMark)
  const atOrBefore = files.filter((file) => {
    const version = versionOf(file)
    return version !== null && version <= markVersion
  })
  const digest = createHash("sha256")
    .update(atOrBefore.join("\n"))
    .digest("hex")
  if (atOrBefore.length === baseline.count && digest === baseline.digest) {
    return []
  }
  return [
    [
      `The migration set at or before ${baseline.highWaterMark} changed`,
      `(expected ${baseline.count} files / ${baseline.digest}, found ${atOrBefore.length} / ${digest}).`,
      `Name new migrations so they sort after the latest existing filename (a version greater than ${markVersion}),`,
      "because production uses `supabase db push --include-all` and would apply an earlier-dated file out of order.",
      "Applied migrations must not be renamed or deleted either.",
      "Find the changed file with `git status -- supabase/migrations`.",
    ].join(" "),
  ]
}

// Pure: ordering is checked on a sorted in-memory filename list.
function migrationOrderViolations(filenames, baseline = BASELINE) {
  const files = filenames.filter((file) => file.endsWith(".sql")).sort()
  return [
    ...namingViolations(files),
    ...highWaterMarkViolations(files, baseline),
  ]
}

function repositoryMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
}

test("Given the repository migrations When checked against the high-water mark Then names are unique and none sorts at or before it", () => {
  assert.deepEqual(migrationOrderViolations(repositoryMigrationFiles()), [])
})

test("Given a new migration named after the high-water mark When checked Then it is accepted", () => {
  const files = [
    ...repositoryMigrationFiles(),
    "99991231235958_later_migration.sql",
    "99991231235959_even_later_migration.sql",
  ]
  assert.deepEqual(migrationOrderViolations(files), [])
})

test("Given a new migration dated before the high-water mark When checked Then it is rejected with the naming rule", () => {
  const files = [
    ...repositoryMigrationFiles(),
    "20260924120000_dated_today.sql",
  ]
  const violations = migrationOrderViolations(files)
  assert.equal(violations.length, 1)
  assert.match(violations[0], /sort after the latest existing filename/)
  assert.match(violations[0], /--include-all/)
})

test("Given an applied migration is renamed or deleted When checked Then it is rejected", () => {
  const files = repositoryMigrationFiles()
  const [first] = [...files].sort()
  const withoutFirst = files.filter((file) => file !== first)
  assert.equal(migrationOrderViolations(withoutFirst).length, 1)

  const withoutMark = files.filter((file) => file !== BASELINE.highWaterMark)
  assert.match(
    migrationOrderViolations(withoutMark)[0],
    /high-water mark .* is missing/
  )
})

test("Given malformed or duplicate versions When checked Then each is reported", () => {
  const files = [
    ...repositoryMigrationFiles(),
    "99991231235959_first.sql",
    "99991231235959_second.sql",
    "20261005_short_version.sql",
  ]
  const violations = migrationOrderViolations(files)
  assert.ok(violations.some((v) => /version already used/.test(v)))
  assert.ok(
    violations.some((v) =>
      /20261005_short_version\.sql: name must match/.test(v)
    )
  )
})
