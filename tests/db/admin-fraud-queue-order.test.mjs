import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * Admin fraud queue ordering — live-DB tier (UI audit ADM 04#6).
 *
 * `fraud_flags.severity` is text whose ALPHABETICAL order (high, low, medium)
 * is not its severity order, so the admin queue used to fetch a fixed
 * newest-100 window and rank it in memory. That is correct for exactly one
 * window and wrong for every paged one: each page would be ranked
 * independently and a high-severity flag on page 3 would sit below a
 * low-severity one on page 1.
 *
 * `20260809100000_fraud_flag_severity_rank.sql` adds `severity_rank`, a STORED
 * GENERATED column, and `getAdminFraudFlags` orders by it in SQL. These tests
 * run the exact ordering the reader asks PostgREST for, page by page, against
 * real Postgres.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

/** The severity order the console displays; index 0 is the most severe. */
const SEVERITY_ORDER = ["high", "medium", "low"]

async function seedFlags(tx) {
  const [merchant] = await tx`
    select id from public.merchants order by created_at limit 1`
  assert.ok(merchant, "a seeded merchant exists")

  // Deliberately inserted so that recency and severity disagree: the newest
  // flags are the least severe, which is the case an in-memory page sort gets
  // wrong.
  const seeds = [
    { severity: "low", days: 0 },
    { severity: "low", days: 1 },
    { severity: "medium", days: 2 },
    { severity: "medium", days: 3 },
    { severity: "high", days: 4 },
    { severity: "high", days: 5 },
  ]

  const ids = []
  for (const seed of seeds) {
    const id = randomUUID()
    ids.push(id)
    await tx`
      insert into public.fraud_flags (
        id, merchant_id, signal, severity, status, metadata, created_at
      )
      values (
        ${id}::uuid,
        ${merchant.id}::uuid,
        'admin_fraud_order_probe',
        ${seed.severity},
        'open',
        '{}'::jsonb,
        now() - (${seed.days} || ' days')::interval
      )`
  }

  return ids
}

/** One page of the queue, ordered exactly as `getAdminFraudFlags` orders it. */
async function readPage(tx, ids, { limit, offset }) {
  return tx`
    select severity, severity_rank, created_at
    from public.fraud_flags
    where id = any(${ids}::uuid[])
    order by severity_rank asc, created_at desc
    limit ${limit} offset ${offset}`
}

test(
  "Given fraud flags whose severity and recency disagree When the queue is paged Then page 2 never outranks page 1",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const ids = await seedFlags(tx)

      const pageOne = await readPage(tx, ids, { limit: 2, offset: 0 })
      const pageTwo = await readPage(tx, ids, { limit: 2, offset: 2 })
      const pageThree = await readPage(tx, ids, { limit: 2, offset: 4 })

      assert.deepEqual(
        pageOne.map((row) => row.severity),
        ["high", "high"],
        "the first page is the most severe work"
      )
      assert.deepEqual(
        pageTwo.map((row) => row.severity),
        ["medium", "medium"]
      )
      assert.deepEqual(
        pageThree.map((row) => row.severity),
        ["low", "low"]
      )

      // The property that matters, stated independently of the fixture: rank
      // never improves as the operator pages forward.
      const paged = [...pageOne, ...pageTwo, ...pageThree]
      for (let index = 1; index < paged.length; index += 1) {
        assert.ok(
          paged[index].severity_rank >= paged[index - 1].severity_rank,
          `row ${index} (${paged[index].severity}) outranks the row before it`
        )
      }
    })
  }
)

test(
  "Given the same flags When they are ordered by the severity TEXT instead Then the first page is wrong",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const ids = await seedFlags(tx)

      // The counterfactual: this is what paging the queue without a rank
      // column would have shipped. It is here so the rank column cannot be
      // deleted as "redundant" without this test failing.
      const alphabetical = await tx`
        select severity
        from public.fraud_flags
        where id = any(${ids}::uuid[])
        order by severity asc, created_at desc
        limit 4`

      assert.equal(
        alphabetical.at(-1)?.severity,
        "low",
        "alphabetical order puts a LOW flag on the first page"
      )
      assert.ok(
        !alphabetical.some((row) => row.severity === "medium"),
        "alphabetical order pushes every MEDIUM flag off the first page"
      )
    })
  }
)

test(
  "Given severity_rank When it is written directly or its severity changes Then the database owns the value",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [merchant] = await tx`
        select id from public.merchants order by created_at limit 1`
      const id = randomUUID()

      await tx`
        insert into public.fraud_flags (
          id, merchant_id, signal, severity, status, metadata
        )
        values (
          ${id}::uuid, ${merchant.id}::uuid, 'admin_fraud_order_probe',
          'low', 'open', '{}'::jsonb
        )`

      const [low] = await tx`
        select severity_rank from public.fraud_flags where id = ${id}::uuid`
      assert.equal(low.severity_rank, SEVERITY_ORDER.indexOf("low") + 1)

      // A generated column cannot drift from the text it ranks: an UPDATE of
      // severity recomputes it, and a direct write is refused outright.
      await tx`update public.fraud_flags set severity = 'high' where id = ${id}::uuid`
      const [high] = await tx`
        select severity_rank from public.fraud_flags where id = ${id}::uuid`
      assert.equal(high.severity_rank, SEVERITY_ORDER.indexOf("high") + 1)

      await assert.rejects(
        () =>
          tx`update public.fraud_flags set severity_rank = 1 where id = ${id}::uuid`,
        /generated column/i
      )
    })
  }
)
