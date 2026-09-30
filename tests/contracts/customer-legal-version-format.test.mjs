import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { test } from "node:test"

// QA BUG-037 (38c42a1..2c45031): the database admits a terms acceptance only
// for a well-formed dated version (YYYY-MM-DD, optionally .N from 1) whose
// snapshot trigger exists, and refuses every other shape. A typo in
// CUSTOMER_LEGAL_VERSION (2026-10-01.01, 2026-9-30, v2026-10-01) would make
// every join fail, so it is caught here before it ships.

const STRICT_VERSION = /^\d{4}-\d{2}-\d{2}(\.[1-9][0-9]*)?$/

function customerLegalVersion() {
  const source = readFileSync("lib/legal/content.ts", "utf8")
  const match = source.match(
    /^export const CUSTOMER_LEGAL_VERSION = "([^"]+)"$/m
  )
  assert.ok(match, "CUSTOMER_LEGAL_VERSION is a string literal")
  return match[1]
}

function latestMigrationDefining(name) {
  const files = readdirSync("supabase/migrations")
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .filter((file) =>
      readFileSync(`supabase/migrations/${file}`, "utf8").includes(
        `create or replace function public.${name}()`
      )
    )
  assert.ok(files.length > 0, `${name} is defined by a migration`)
  return readFileSync(`supabase/migrations/${files.at(-1)}`, "utf8")
}

test("CUSTOMER_LEGAL_VERSION is a strict dated terms version", () => {
  const version = customerLegalVersion()
  assert.match(version, STRICT_VERSION)
  assert.ok(version >= "2026-09-26", "versioned snapshots start on 2026-09-26")
})

test("the terms version guard refuses versions that are not strictly dated", () => {
  const guard = latestMigrationDefining(
    "require_customer_legal_terms_version_snapshot"
  )
  assert.ok(
    guard.includes(
      String.raw`new.policy_version !~ '^\d{4}-\d{2}-\d{2}(\.[1-9][0-9]*)?$'`
    ),
    "the guard uses the same strict version pattern"
  )
  assert.match(guard, /is not a recognised version/)
})

test("the current terms version has a snapshot trigger migration", () => {
  const version = customerLegalVersion()
  const trigger = `customer_terms_apply_v${version
    .replaceAll("-", "")
    .replaceAll(".", "_")}_snapshot`
  const defined = readdirSync("supabase/migrations").some((file) =>
    readFileSync(`supabase/migrations/${file}`, "utf8").includes(
      `create trigger ${trigger}`
    )
  )
  assert.ok(defined, `${trigger} is created by a migration`)
})
