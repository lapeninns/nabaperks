import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

function dbTestFiles() {
  const dir = path.join(projectRoot, "tests", "db")
  return readdirSync(dir)
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => ({ file, source: readProjectFile("tests", "db", file) }))
}

// Given test fixtures need a live loyalty entitlement, when they select a
// billing row, then they must mirror the active/trialing product allowlist.
const CANONICAL_CLAUSE = /bc\.status in \('trialing', 'active'\)/

test("Given a fresh database When db tests pick billing-eligible fixtures Then no picker uses the merchants-status vocabulary on billing_customers", () => {
  const offenders = dbTestFiles()
    .filter(({ source }) => /bc\.status in \('trial'/.test(source))
    .map(({ file }) => file)

  assert.deepEqual(
    offenders,
    [],
    "these files gate billing_customers.status on the merchants vocabulary ('trial'…) and fail on a freshly seeded database (seed writes Stripe's 'trialing')"
  )
})

test("Given the product's billing rule When a db test gates on billing_customers Then it mirrors the active allowlist", () => {
  const missing = dbTestFiles()
    .filter(({ source }) => /billing_customers bc/.test(source))
    .filter(({ source }) => !CANONICAL_CLAUSE.test(source))
    .map(({ file }) => file)

  assert.deepEqual(
    missing,
    [],
    "every billing-eligibility picker must use: bc.status in ('trialing', 'active')"
  )
})

test("Given the committed seed When billing rows are inserted Then they use active or trialing billing", () => {
  const seed = readProjectFile("supabase", "seed.sql")
  assert.match(seed, /insert into public\.billing_customers/i)
  assert.doesNotMatch(
    seed,
    /'(past_due|cancelled|suspended)'/,
    "the committed seed must not park demo merchants in a non-live billing status"
  )
})

test("Given reassignable seed fixtures When staff-excision asserts owner access Then it derives owners from the database instead of hardcoding them", () => {
  const source = readProjectFile("tests", "db", "staff-excision.test.mjs")
  assert.doesNotMatch(
    source,
    /00000000-0000-0000-0000-000000000101/,
    "staff-excision must not hardcode Old Crown Girton's owner UUID — local fixture seeds may reassign ownership"
  )
  assert.match(
    source,
    /owner_user_id/,
    "staff-excision must read merchants.owner_user_id to identify tenant owners"
  )
})
