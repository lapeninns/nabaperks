import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  dateOfBirthForIndex,
  earnedBusinessDateFor,
  joinedAtForIndex,
  lastVisitAtForIndex,
  parseArgs,
  stampCreatedAtFor,
  stressCustomerId,
  stressDayOffsetFor,
  stressEmail,
  stressMembershipId,
  STRESS_HISTORY_DAYS,
} from "../../scripts/seed-stress.mjs"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("parseArgs defaults to 10k members with events enabled", () => {
  const args = parseArgs([])

  assert.equal(args.count, 10_000)
  assert.equal(args.batch, 1_000)
  assert.equal(args.stampsPerMember, 1)
  assert.equal(args.withEvents, true)
  assert.equal(args.clean, false)
})

test("parseArgs requires an explicit merchant for clean-only mode", () => {
  assert.throws(() => parseArgs(["--clean"]), /--merchant-id is required/)
})

test("parseArgs accepts separate and inline clean merchant UUIDs", () => {
  const merchantId = "10000000-0000-0000-0000-000000000001"
  const separate = parseArgs(["--clean", "--merchant-id", merchantId])
  const inline = parseArgs(["--clean", "--", `--merchant-id=${merchantId}`])

  assert.equal(separate.clean, true)
  assert.equal(separate.count, 0)
  assert.equal(separate.merchantId, merchantId)
  assert.deepEqual(inline, separate)
})

test("parseArgs rejects malformed merchant identities", () => {
  for (const merchantId of [
    "../merchant",
    "ignore cleanup rules",
    "not-a-uuid",
  ])
    assert.throws(
      () => parseArgs(["--clean", "--merchant-id", merchantId]),
      /--merchant-id must be a UUID/
    )
})

test("stress seed ids and emails are deterministic", () => {
  assert.equal(stressEmail(42), "stress+42@example.test")
  assert.equal(stressCustomerId(1), "a0000000-0000-4000-8000-000000000001")
  assert.equal(stressMembershipId(10), "b0000000-0000-4000-8000-00000000000a")
})

test("stress seed dates spread across the history window", () => {
  assert.equal(STRESS_HISTORY_DAYS, 540)

  const join1 = joinedAtForIndex(1)
  const join2 = joinedAtForIndex(2)
  const joinWide = joinedAtForIndex(999)

  assert.notEqual(join1.toISOString(), join2.toISOString())
  assert.notEqual(join1.getUTCHours(), 12)
  assert.ok(stressDayOffsetFor(999, 0) < STRESS_HISTORY_DAYS)
  assert.ok(joinWide < new Date())

  const stampJoin = stampCreatedAtFor(42, 0, join1)
  const stampReturn = stampCreatedAtFor(42, 1, join1)
  assert.ok(stampJoin >= join1)
  assert.notEqual(earnedBusinessDateFor(42, 0), earnedBusinessDateFor(42, 1))

  const lastVisit = lastVisitAtForIndex(10, join1, [stampJoin, stampReturn])
  assert.ok(lastVisit >= stampReturn)

  assert.notEqual(dateOfBirthForIndex(1), dateOfBirthForIndex(2))
})

test("stress seed target guard accepts only approved local database namespaces", () => {
  const runClean = (database) =>
    spawnSync(
      process.execPath,
      [
        "scripts/seed-stress.mjs",
        "--clean",
        "--merchant-id=10000000-0000-0000-0000-000000000001",
      ],
      {
        cwd: projectRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          SUPABASE_DB_URL: `postgres://postgres:secret@127.0.0.1:1/${database}`,
        },
      }
    )

  for (const database of ["postgres", "nabaperks_task11"]) {
    const result = runClean(database)
    assert.doesNotMatch(
      result.stderr,
      /approved local Supabase database namespace/,
      database
    )
  }

  for (const database of [
    "nabaperks_task11_wrong",
    "",
    "%70ostgres",
    "postgres%2F..%2Fnabaperks_task11",
  ]) {
    const result = runClean(database)
    assert.notEqual(result.status, 0, database)
    assert.match(result.stderr, /approved local Supabase database namespace/)
  }

  const seed = readProjectFile("scripts", "seed-stress.mjs")
  const help = readProjectFile("scripts", "db-connection-help.mjs")

  assert.match(help, /function safeDatabaseTarget\(dbUrl\)/)
  assert.ok(
    help.includes(
      'return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname}`'
    )
  )
  assert.doesNotMatch(help, /url\.(?:username|password)/)

  assert.match(seed, /function isSupabaseHost\(hostname\)/)
  assert.ok(
    seed.includes(
      'return host === "supabase.com" || host.endsWith(".supabase.com")'
    )
  )
  assert.doesNotMatch(seed, /(?:hostname|dbUrl)\.includes\("supabase\.com"\)/)
  assert.match(seed, /printDatabaseConnectionHelp\(\s*safeDbTarget\(dbUrl\),/)
})
