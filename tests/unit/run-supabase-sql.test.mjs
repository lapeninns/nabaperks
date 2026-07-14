import assert from "node:assert/strict"
import { test } from "node:test"

import {
  parseMigrationVersion,
  planMigrationApply,
} from "../../scripts/run-supabase-sql.mjs"

/**
 * db migration ledger apply — the pure half.
 *
 * `applyMigration()` used to replay nearly every migration file on every
 * invocation, consulting neither the migration ledger nor recording anything
 * in it. The apply DECISION is now a pure function so its skip/apply/guard
 * branches are provable without a database; the live-ledger read/record path
 * is proven in tests/db/migration-ledger-apply.test.mjs.
 */

const files = [
  { name: "20260101000000_a.sql", version: "20260101000000" },
  { name: "20260102000000_b.sql", version: "20260102000000" },
  { name: "20260103000000_c.sql", version: "20260103000000" },
]

test("parseMigrationVersion returns the 14-digit prefix for a conforming file", () => {
  assert.equal(
    parseMigrationVersion("20260606142000_initial_schema_rls.sql"),
    "20260606142000"
  )
  assert.equal(parseMigrationVersion("20260103000000_c.sql"), "20260103000000")
})

test("parseMigrationVersion returns null for a non-conforming name", () => {
  assert.equal(parseMigrationVersion("seed.sql"), null)
  assert.equal(parseMigrationVersion("2026010100000_short.sql"), null)
  assert.equal(parseMigrationVersion("not-a-migration"), null)
})

test("planMigrationApply skips already-applied versions and schedules the rest", () => {
  const plan = planMigrationApply({
    files,
    appliedVersions: ["20260101000000", "20260102000000"],
  })

  assert.equal(plan.blocked, false)
  assert.deepEqual(
    plan.toApply.map((f) => f.version),
    ["20260103000000"]
  )
  assert.deepEqual(
    plan.skipped.map((f) => f.version),
    ["20260101000000", "20260102000000"]
  )
})

test("planMigrationApply schedules nothing when every version is applied (the no-op)", () => {
  const plan = planMigrationApply({
    files,
    appliedVersions: files.map((f) => f.version),
  })

  assert.equal(plan.blocked, false)
  assert.deepEqual(plan.toApply, [])
  assert.equal(plan.skipped.length, files.length)
})

test("planMigrationApply applies everything on a genuinely fresh database", () => {
  const plan = planMigrationApply({
    files,
    appliedVersions: [],
    schemaProvisioned: false,
  })

  assert.equal(plan.blocked, false)
  assert.equal(plan.toApply.length, files.length)
  assert.deepEqual(plan.skipped, [])
})

test("planMigrationApply blocks a provisioned schema with an empty ledger and no --force", () => {
  const plan = planMigrationApply({
    files,
    appliedVersions: [],
    schemaProvisioned: true,
    force: false,
  })

  assert.equal(plan.blocked, true)
  assert.equal(plan.reason, "schema-without-ledger")
  assert.deepEqual(plan.toApply, [])
})

test("planMigrationApply with --force applies every file and never blocks", () => {
  const plan = planMigrationApply({
    files,
    appliedVersions: ["20260101000000"],
    schemaProvisioned: true,
    force: true,
  })

  assert.equal(plan.blocked, false)
  assert.equal(plan.toApply.length, files.length)
  assert.deepEqual(plan.skipped, [])
})

test("planMigrationApply always applies a file with no parseable version", () => {
  const withUnversioned = [
    ...files,
    { name: "hotfix.sql", version: null },
  ]

  const plan = planMigrationApply({
    files: withUnversioned,
    appliedVersions: files.map((f) => f.version),
  })

  assert.deepEqual(
    plan.toApply.map((f) => f.name),
    ["hotfix.sql"]
  )
})
