import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * venue code derivation — live-DB tier.
 *
 * The daily venue code (20260907100000) is never stored: it is derived from a
 * per-venue seed and the "venue-code day", which rolls at 05:00 Europe/London.
 * This suite pins the shape (six digits), the stability within a day, the
 * variation across venues and days, the 05:00 boundary, seed rotation, and the
 * privilege posture of the seed table and derivation functions.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const PICK_TWO = /* sql */ `
  select id, business_slug
  from public.merchants
  where business_slug in ('old-crown-girton', 'bubble-yard')
  order by business_slug`

async function codeFor(tx, merchantId, at) {
  const [row] = at
    ? await tx`select private.venue_code_for(${merchantId}::uuid, ${at}::timestamptz) as code`
    : await tx`select private.venue_code_for(${merchantId}::uuid) as code`
  return row.code
}

test(
  "the code is six digits and stable within a venue-code day",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [[venue]] = [await tx.unsafe(PICK_TWO)]
      assert.ok(venue, "a seeded venue exists")

      const first = await codeFor(tx, venue.id)
      const second = await codeFor(tx, venue.id)

      assert.match(first, /^[0-9]{6}$/, "six zero-padded digits")
      assert.equal(second, first, "the same day yields the same code")
    })
  }
)

test("codes differ across venues and across days", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const venues = await tx.unsafe(PICK_TWO)
    assert.equal(venues.length, 2, "both seeded venues exist")

    const [a, b] = venues
    const today = await codeFor(tx, a.id, "2026-09-07T12:00:00Z")
    const other = await codeFor(tx, b.id, "2026-09-07T12:00:00Z")
    const tomorrow = await codeFor(tx, a.id, "2026-09-08T12:00:00Z")

    // Two 1-in-a-million draws colliding is possible but vanishingly unlikely;
    // a failure here almost certainly means the merchant id or day dropped out
    // of the HMAC input.
    assert.notEqual(other, today, "another venue has a different code")
    assert.notEqual(tomorrow, today, "the next day has a different code")
  })
})

test(
  "the venue-code day rolls at 05:00 Europe/London, not midnight",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      // Cast to text: the client would otherwise hand back a JS Date in local time.
      const [row] = await tx`
      select
        private.venue_code_day('2026-09-07T04:59:00+01:00'::timestamptz)::text as before_five,
        private.venue_code_day('2026-09-07T05:00:00+01:00'::timestamptz)::text as at_five,
        private.venue_code_day('2026-09-07T00:10:00+01:00'::timestamptz)::text as after_midnight`

      assert.equal(
        String(row.before_five),
        "2026-09-06",
        "04:59 is still yesterday's code"
      )
      assert.equal(
        String(row.at_five),
        "2026-09-07",
        "05:00 starts today's code"
      )
      assert.equal(
        String(row.after_midnight),
        "2026-09-06",
        "a pub still open after midnight keeps the evening's code"
      )
    })
  }
)

test("rotating the seed changes the code immediately", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [[venue]] = [await tx.unsafe(PICK_TWO)]
    const before = await codeFor(tx, venue.id)

    await tx`
      update private.venue_code_seeds
      set seed = extensions.gen_random_bytes(32), rotated_at = now()
      where merchant_id = ${venue.id}::uuid`

    const after_ = await codeFor(tx, venue.id)
    assert.notEqual(after_, before, "a new seed yields a new code")
    assert.match(after_, /^[0-9]{6}$/)
  })
})

test("an unknown merchant yields no code and no seed", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const ghost = randomUUID()
    const code = await codeFor(tx, ghost)
    assert.equal(code, null, "no code for a merchant that does not exist")

    const [{ n }] = await tx`
      select count(*)::int as n from private.venue_code_seeds
      where merchant_id = ${ghost}::uuid`
    assert.equal(n, 0, "no seed row is created for a ghost merchant")
  })
})

test("no API role can read the seed or derive a code", { skip }, async () => {
  const sql = db()
  for (const role of ["anon", "authenticated", "service_role"]) {
    const [row] = await sql`
      select
        has_table_privilege(${role}, 'private.venue_code_seeds', 'SELECT') as seed_select,
        has_function_privilege(
          ${role}, 'private.venue_code_for(uuid, timestamptz)', 'EXECUTE'
        ) as derive,
        has_function_privilege(
          ${role}, 'private.venue_code_day(timestamptz)', 'EXECUTE'
        ) as day`
    // Schema-level USAGE is deliberately granted (20260902138000) so PostgREST
    // can call the private pre-request guard on every request; containment here
    // is per object, and USAGE alone reaches nothing.
    assert.equal(row.seed_select, false, `${role} cannot read seeds`)
    assert.equal(row.derive, false, `${role} cannot derive a code`)
    assert.equal(row.day, false, `${role} cannot call venue_code_day`)
  }

  const [rls] = await sql`
    select c.relrowsecurity as rls, c.relforcerowsecurity as forced
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'private' and c.relname = 'venue_code_seeds'`
  assert.equal(rls?.rls, true, "seeds enable RLS")
  assert.equal(rls?.forced, true, "seeds force RLS")
})
