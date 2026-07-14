import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * db notification durability — Blocker 3: scheduled producers re-enqueue.
 *
 * The scheduled worker's producers select up to 100 rows and enqueue each every
 * run, passing an ad-hoc dedupe key. For the stamp producers that key was
 * `${eventType}:${membershipId}:${businessDate}` — it OMITS the cycle, so a
 * membership that rolls into a new cycle on the same day silently loses its
 * second nudge; and because the key was caller-supplied, a caller typo could
 * break dedupe entirely. The audit counted 14,455 enqueue calls collapsing to
 * 222 rows.
 *
 * The fix moves the canonical dedupe key into `enqueue_notification_event`: for
 * the scheduled producer event types it derives the key from
 * (event_type, membership, cycle, business_date), ignoring the caller key, so
 * idempotency is caller-proof and cycle-aware. Transactional event types keep
 * honouring their caller key. These tests are the executable definition of that
 * contract.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

async function enqueue(tx, fixture, opts) {
  const [row] = await tx`
    select public.enqueue_notification_event(
      ${opts.eventType},
      ${fixture.customerId}::uuid,
      ${fixture.merchantId}::uuid,
      ${fixture.membershipId}::uuid,
      ${opts.rewardEventId ?? null}::uuid,
      ${opts.cycle ?? null}::int,
      ${opts.businessDate}::date,
      now(),
      ${opts.dedupe},
      '{}'::jsonb,
      '{}'::jsonb
    ) as id`
  return row.id
}

async function countEvents(tx, fixture, eventType) {
  const [{ n }] = await tx`
    select count(*)::int as n from public.notification_events
    where membership_id = ${fixture.membershipId}::uuid
      and event_type = ${eventType}`
  return n
}

async function businessDates(tx) {
  const [row] = await tx`
    select public.uk_business_date(now()) as today,
           public.uk_business_date(now() - interval '1 day') as yesterday`
  return row
}

test(
  "a scheduled enqueue is idempotent per (event_type, membership, cycle, business_date) regardless of caller key",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const { today } = await businessDates(tx)

      const id1 = await enqueue(tx, fixture, {
        eventType: "next_stamp_available",
        cycle: 1,
        businessDate: today,
        dedupe: `caller-${randomUUID()}`,
      })
      const id2 = await enqueue(tx, fixture, {
        eventType: "next_stamp_available",
        cycle: 1,
        businessDate: today,
        dedupe: `caller-${randomUUID()}`, // a DIFFERENT caller key, same tuple
      })

      assert.equal(id1, id2, "the same tuple collapses to one event id")
      assert.equal(
        await countEvents(tx, fixture, "next_stamp_available"),
        1,
        "only one row exists for the tuple"
      )
    })
  }
)

test(
  "different cycles are distinct events even when the caller key omits the cycle",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const { today } = await businessDates(tx)
      const legacyKey = `next_stamp_available:${fixture.membershipId}:today`

      const id1 = await enqueue(tx, fixture, {
        eventType: "next_stamp_available",
        cycle: 1,
        businessDate: today,
        dedupe: legacyKey,
      })
      const id2 = await enqueue(tx, fixture, {
        eventType: "next_stamp_available",
        cycle: 2,
        businessDate: today,
        dedupe: legacyKey, // same cycle-blind caller key, new cycle
      })

      assert.notEqual(id1, id2, "cycle 1 and cycle 2 are separate events")
      assert.equal(await countEvents(tx, fixture, "next_stamp_available"), 2)
    })
  }
)

test(
  "the same tuple on a different business date is a distinct event",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const { today, yesterday } = await businessDates(tx)
      const key = `nsa-${randomUUID()}`

      const id1 = await enqueue(tx, fixture, {
        eventType: "next_stamp_available",
        cycle: 1,
        businessDate: today,
        dedupe: key,
      })
      const id2 = await enqueue(tx, fixture, {
        eventType: "next_stamp_available",
        cycle: 1,
        businessDate: yesterday,
        dedupe: key, // same caller key, earlier day
      })

      assert.notEqual(id1, id2, "each business date gets its own nudge")
      assert.equal(await countEvents(tx, fixture, "next_stamp_available"), 2)
    })
  }
)

test(
  "reward_ready collapses to one per membership-cycle-day across historic caller-key formats",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const { today } = await businessDates(tx)
      const rewardId = randomUUID()

      // events.ts transactional style: `reward_ready:${rewardEventId}` (no date).
      const id1 = await enqueue(tx, fixture, {
        eventType: "reward_ready",
        cycle: 1,
        businessDate: today,
        dedupe: `reward_ready:${rewardId}`,
      })
      // worker producer style: `reward_ready:${rewardEventId}:${businessDate}`.
      const id2 = await enqueue(tx, fixture, {
        eventType: "reward_ready",
        cycle: 1,
        businessDate: today,
        dedupe: `reward_ready:${rewardId}:${today}`,
      })

      assert.equal(id1, id2, "both paths collapse to one reward_ready")
      assert.equal(await countEvents(tx, fixture, "reward_ready"), 1)
    })
  }
)

test(
  "a transactional (non-scheduled) event type still honours its caller dedupe key",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const { today } = await businessDates(tx)

      const id1 = await enqueue(tx, fixture, {
        eventType: "one_stamp_away",
        cycle: 1,
        businessDate: today,
        dedupe: `one_stamp_away:${randomUUID()}`,
      })
      const id2 = await enqueue(tx, fixture, {
        eventType: "one_stamp_away",
        cycle: 1,
        businessDate: today,
        dedupe: `one_stamp_away:${randomUUID()}`, // distinct caller keys stay distinct
      })

      assert.notEqual(
        id1,
        id2,
        "canonicalisation is scoped to scheduled producers, not transactional events"
      )
      assert.equal(await countEvents(tx, fixture, "one_stamp_away"), 2)
    })
  }
)
