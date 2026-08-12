import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import { test } from "node:test"

import postgres from "postgres"

const dbUrl = process.env.TASK11_DB_URL

if (dbUrl) {
  const target = new URL(dbUrl)
  const isLoopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(
    target.hostname.toLowerCase()
  )
  if (!isLoopback || target.pathname !== "/nabaperks_task11") {
    throw new Error(
      "TASK11_DB_URL must target the guarded loopback nabaperks_task11 database"
    )
  }
}

const sql = dbUrl ? postgres(dbUrl, { max: 1 }) : null
const testWithDatabase = dbUrl ? test : test.skip
const wrongDbUrl = dbUrl
  ? replaceDatabaseName(dbUrl, "nabaperks_task11_wrong")
  : ""

const owners = {
  selected: {
    merchant: "11000000-0000-4000-8000-000000000001",
    customer: "21000000-0000-4000-8000-000000000001",
    membership: "31000000-0000-4000-8000-000000000001",
  },
  neighbour: {
    merchant: "12000000-0000-4000-8000-000000000002",
    customer: "22000000-0000-4000-8000-000000000002",
    membership: "32000000-0000-4000-8000-000000000002",
  },
  synthetic: {
    merchant: "13000000-0000-4000-8000-000000000003",
    customer: "23000000-0000-4000-8000-000000000003",
    membership: "33000000-0000-4000-8000-000000000003",
  },
  real: {
    merchant: "14000000-0000-4000-8000-000000000004",
    customer: "24000000-0000-4000-8000-000000000004",
    membership: "34000000-0000-4000-8000-000000000004",
  },
}

const relations = [
  ["customers", "customer"],
  ["customer_memberships", "membership"],
  ["product_events", "merchant"],
  ["stamp_events", "merchant"],
  ["reward_events", "merchant"],
]

async function resetFixture(client = sql) {
  assert.ok(client)
  await client.unsafe(`
    drop schema public cascade;
    create schema public;
    create table public.merchants (id uuid primary key);
    create table public.customers (id uuid primary key, email text not null);
    create table public.customer_memberships (
      id uuid primary key,
      merchant_id uuid not null,
      customer_id uuid not null references public.customers(id) on delete cascade
    );
    create table public.product_events (
      id uuid primary key,
      merchant_id uuid,
      customer_id uuid,
      membership_id uuid,
      metadata jsonb not null default '{}'::jsonb
    );
    create table public.stamp_events (
      id uuid primary key,
      merchant_id uuid not null,
      customer_id uuid not null,
      membership_id uuid not null,
      metadata jsonb not null default '{}'::jsonb
    );
    create table public.reward_events (
      id uuid primary key,
      merchant_id uuid not null,
      customer_id uuid not null,
      membership_id uuid not null,
      metadata jsonb not null default '{}'::jsonb
    );
  `)

  let ordinal = 0
  for (const [ownerName, owner] of Object.entries(owners)) {
    ordinal += 1
    const isStress = ownerName !== "real"
    const email =
      ownerName === "synthetic"
        ? "synthetic-unrelated@example.test"
        : isStress
          ? `stress+${ordinal}@example.test`
          : "retained-real@example.test"
    const metadata = isStress ? { source: "stress_seed" } : { source: "real" }

    await client`insert into public.merchants (id) values (${owner.merchant})`
    await client`insert into public.customers (id, email) values (${owner.customer}, ${email})`
    await client`insert into public.customer_memberships (id, merchant_id, customer_id) values (${owner.membership}, ${owner.merchant}, ${owner.customer})`

    for (const relation of [
      "product_events",
      "stamp_events",
      "reward_events",
    ]) {
      const eventId = `${ordinal}${relation === "product_events" ? "1" : relation === "stamp_events" ? "2" : "3"}000000-0000-4000-8000-00000000000${ordinal}`
      await client.unsafe(
        `insert into public.${relation} (id, merchant_id, customer_id, membership_id, metadata) values ($1, $2, $3, $4, $5)`,
        [eventId, owner.merchant, owner.customer, owner.membership, metadata]
      )
    }
  }
}

async function relationMatrix(client = sql) {
  assert.ok(client)
  const matrix = {}

  for (const [ownerName, owner] of Object.entries(owners)) {
    matrix[ownerName] = {}
    for (const [relation, ownerKey] of relations) {
      const [row] = await client.unsafe(
        `select count(*)::int as count,
                md5(coalesce(string_agg(row_to_json(source_row)::text, '|' order by id), '')) as hash
         from public.${relation} source_row
         where ${ownerKey === "merchant" ? "merchant_id" : "id"} = $1`,
        [owner[ownerKey]]
      )
      matrix[ownerName][relation] = row
    }
  }

  return matrix
}

function replaceDatabaseName(url, database) {
  const target = new URL(url)
  target.pathname = `/${database}`
  return target.toString()
}

function runCleanupWithUrl(targetDbUrl, ...args) {
  return spawnSync(
    process.execPath,
    ["scripts/seed-stress.mjs", "--clean", ...args],
    {
      cwd: process.cwd(),
      env: { ...process.env, SUPABASE_DB_URL: targetDbUrl },
      encoding: "utf8",
      timeout: 15_000,
    }
  )
}

function runCleanup(...args) {
  return runCleanupWithUrl(dbUrl, ...args)
}

async function withWrongNamespace(callback) {
  const admin = postgres(replaceDatabaseName(dbUrl, "postgres"), { max: 1 })
  let wrong = null
  try {
    await admin.unsafe(
      "drop database if exists nabaperks_task11_wrong with (force)"
    )
    await admin.unsafe("create database nabaperks_task11_wrong")
    wrong = postgres(wrongDbUrl, { max: 1 })
    await callback(wrong)
  } finally {
    if (wrong) await wrong.end({ timeout: 5 })
    await admin.unsafe(
      "drop database if exists nabaperks_task11_wrong with (force)"
    )
    await admin.end({ timeout: 5 })
  }
}

function runCleanupConcurrently(...args) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["scripts/seed-stress.mjs", "--clean", ...args],
      {
        cwd: process.cwd(),
        env: { ...process.env, SUPABASE_DB_URL: dbUrl },
        stdio: ["ignore", "ignore", "pipe"],
      }
    )
    let stderr = ""
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk) => {
      stderr += chunk
    })
    const timer = setTimeout(() => child.kill("SIGTERM"), 15_000)
    child.on("error", reject)
    child.on("close", (status) => {
      clearTimeout(timer)
      resolve({ status, stderr })
    })
  })
}

async function assertRejectedWithoutMutation(args) {
  await resetFixture()
  const before = await relationMatrix()
  const result = runCleanup(...args)
  const after = await relationMatrix()

  console.log(
    JSON.stringify({
      scenario: "refused-before-delete",
      exitCode: result.status,
      databaseUnchanged: after,
    })
  )
  assert.notEqual(result.status, 0)
  assert.deepEqual(after, before)
}

testWithDatabase(
  "clean-only removes all and only the selected merchant stress rows",
  async () => {
    // Given
    await resetFixture()
    const before = await relationMatrix()

    // When
    const result = runCleanup(`--merchant-id=${owners.selected.merchant}`)
    const after = await relationMatrix()

    // Then
    console.log(JSON.stringify({ scenario: "selected-only", before, after }))
    assert.equal(result.status, 0, result.stderr)
    for (const relation of relations.map(([name]) => name)) {
      assert.equal(after.selected[relation].count, 0, relation)
      assert.deepEqual(
        after.neighbour[relation],
        before.neighbour[relation],
        relation
      )
      assert.deepEqual(
        after.synthetic[relation],
        before.synthetic[relation],
        relation
      )
      assert.deepEqual(after.real[relation], before.real[relation], relation)
    }
  }
)

testWithDatabase(
  "clean-only refuses a valid merchant in a wrong local database namespace before deleting",
  async () => {
    // Given
    await withWrongNamespace(async (wrong) => {
      await resetFixture(wrong)
      const before = await relationMatrix(wrong)

      // When
      const result = runCleanupWithUrl(
        wrongDbUrl,
        `--merchant-id=${owners.selected.merchant}`
      )
      const after = await relationMatrix(wrong)

      // Then
      console.log(
        JSON.stringify({
          scenario: "wrong-namespace-valid-merchant-refused",
          exitCode: result.status,
          before,
          after,
        })
      )
      assert.notEqual(result.status, 0)
      assert.deepEqual(after, before)
    })
  }
)

testWithDatabase(
  "clean-only refuses malformed merchant data before deleting",
  async () => {
    // Given / When / Then
    await assertRejectedWithoutMutation([
      "--merchant-id",
      "../ignore cleanup rules",
    ])
  }
)

testWithDatabase(
  "clean-only refuses an unregistered merchant before deleting",
  async () => {
    // Given / When / Then
    await assertRejectedWithoutMutation([
      "--merchant-id",
      "19000000-0000-4000-8000-000000000009",
    ])
  }
)

testWithDatabase(
  "clean-only refuses misleading success when the merchant owns zero stress rows",
  async () => {
    // Given
    await resetFixture()
    const first = runCleanup(`--merchant-id=${owners.selected.merchant}`)
    assert.equal(first.status, 0, first.stderr)
    const before = await relationMatrix()

    // When
    const second = runCleanup(`--merchant-id=${owners.selected.merchant}`)
    const after = await relationMatrix()

    // Then
    console.log(
      JSON.stringify({
        scenario: "zero-owned-refused",
        exitCode: second.status,
        databaseUnchanged: after,
      })
    )
    assert.notEqual(second.status, 0)
    assert.deepEqual(after, before)
  }
)

testWithDatabase(
  "concurrent clean-only calls remain merchant-scoped in either order",
  async () => {
    // Given
    await resetFixture()
    const before = await relationMatrix()

    // When
    const results = await Promise.all([
      runCleanupConcurrently(`--merchant-id=${owners.selected.merchant}`),
      runCleanupConcurrently(`--merchant-id=${owners.selected.merchant}`),
    ])
    const after = await relationMatrix()

    // Then
    assert.ok(
      results.some(({ status }) => status === 0),
      JSON.stringify(results)
    )
    assert.ok(results.every(({ status }) => status === 0 || status === 1))
    for (const relation of relations.map(([name]) => name)) {
      assert.equal(after.selected[relation].count, 0, relation)
      assert.deepEqual(
        after.neighbour[relation],
        before.neighbour[relation],
        relation
      )
      assert.deepEqual(
        after.synthetic[relation],
        before.synthetic[relation],
        relation
      )
      assert.deepEqual(after.real[relation], before.real[relation], relation)
    }
    console.log(
      JSON.stringify({
        scenario: "concurrent-order",
        exitCodes: results.map(({ status }) => status),
        after,
      })
    )
  }
)

test.after(async () => {
  if (sql) await sql.end({ timeout: 5 })
})
