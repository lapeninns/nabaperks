import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * db notification durability — Blocker 2: claim without a lease strands rows.
 *
 * `claim_due_notification_events` flipped queued → 'delivering' with no lease or
 * expiry, so if the worker crashed (or was killed mid-drain) between the claim
 * and the terminal `markEvent`, the row sat in 'delivering' forever and its
 * notification was never delivered or retried.
 *
 * The fix stamps every claim with `claimed_at` + `lease_expires_at` and lets a
 * later claim RECLAIM a 'delivering' row whose lease has expired — a
 * visibility-timeout, like SQS. A row mid-flight under a live lease is left
 * alone; a pre-lease NULL-lease row is never grabbed (the migration one-time
 * resets those to 'queued'), so a concurrently-processing row is never
 * double-claimed on the deploy boundary.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

// Insert a notification_event with a precise status + lease so the claim
// transition is deterministic. References lease_expires_at / claimed_at, so it
// (correctly) fails until the lease migration adds them. dueSeconds/leaseSeconds
// are numbers (leaseSeconds null = never leased).
async function seedEvent(tx, customerId, { status, dueSeconds, leaseSeconds }) {
  const [row] = await tx`
    insert into public.notification_events
      (event_type, category, customer_id, status, due_at, dedupe_key, payload,
       metadata, claimed_at, lease_expires_at, created_at, updated_at)
    values (
      'reward_ready', 'transactional', ${customerId}, ${status},
      now() + make_interval(secs => ${dueSeconds}),
      ${`lease-${randomUUID()}`}, '{}'::jsonb, '{}'::jsonb,
      case when ${status} = 'delivering' then now() else null end,
      case when ${leaseSeconds}::int is null then null
           else now() + make_interval(secs => ${leaseSeconds}) end,
      now(), now())
    returning id`
  return row.id
}

// Park every other claimable row (due queued, or delivering with an
// expired/absent lease) so the claim set is exactly the rows we seed.
async function isolateQueue(tx) {
  await tx`update public.notification_events
           set due_at = now() + interval '1 day' where status = 'queued'`
  await tx`update public.notification_events
           set lease_expires_at = now() + interval '1 day'
           where status = 'delivering'
             and (lease_expires_at is null or lease_expires_at <= now())`
}

test(
  "claim reclaims a delivering row whose lease has expired and refreshes the lease",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`lease-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      await isolateQueue(tx)

      const strandedId = await seedEvent(tx, customer.id, {
        status: "delivering",
        dueSeconds: -3600,
        leaseSeconds: -60, // lease expired a minute ago
      })

      const claimed = await tx`
        select id from public.claim_due_notification_events(now(), 500)`
      const claimedIds = claimed.map((r) => r.id)
      assert.ok(
        claimedIds.includes(strandedId),
        "the expired-lease delivering row is reclaimed"
      )

      const [row] = await tx`
        select status, lease_expires_at
        from public.notification_events where id = ${strandedId}`
      assert.equal(row.status, "delivering", "the reclaimed row stays delivering")
      assert.ok(
        new Date(row.lease_expires_at).getTime() > Date.now(),
        "the reclaim stamps a fresh future lease"
      )
    })
  }
)

test(
  "claim does not reclaim a delivering row whose lease is still live",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`lease-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      await isolateQueue(tx)

      const leasedId = await seedEvent(tx, customer.id, {
        status: "delivering",
        dueSeconds: -3600,
        leaseSeconds: 300, // still leased for 5 minutes
      })

      const [before] = await tx`
        select lease_expires_at from public.notification_events where id = ${leasedId}`
      const claimed = await tx`
        select id from public.claim_due_notification_events(now(), 500)`
      assert.ok(
        !claimed.map((r) => r.id).includes(leasedId),
        "a live-lease delivering row is left alone"
      )
      const [after_] = await tx`
        select status, lease_expires_at from public.notification_events where id = ${leasedId}`
      assert.equal(after_.status, "delivering")
      assert.equal(
        new Date(after_.lease_expires_at).getTime(),
        new Date(before.lease_expires_at).getTime(),
        "the live lease is not touched"
      )
    })
  }
)

test(
  "claiming a due queued row stamps claimed_at and a fresh lease",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`lease-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      await isolateQueue(tx)

      const queuedId = await seedEvent(tx, customer.id, {
        status: "queued",
        dueSeconds: -60,
        leaseSeconds: null,
      })

      await tx`select id from public.claim_due_notification_events(now(), 500)`

      const [row] = await tx`
        select status, claimed_at, lease_expires_at
        from public.notification_events where id = ${queuedId}`
      assert.equal(row.status, "delivering", "a claimed queued row flips to delivering")
      assert.notEqual(row.claimed_at, null, "claimed_at is stamped")
      assert.ok(
        new Date(row.lease_expires_at).getTime() > Date.now(),
        "a fresh future lease is stamped"
      )
    })
  }
)

test(
  "claim never grabs a delivering row with a NULL lease (pre-lease in-flight row)",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [customer] = await tx`
        insert into public.customers (email, email_verified_at, created_at, updated_at)
        values (${`lease-${randomUUID()}@test.local`}, now(), now(), now())
        returning id`
      await isolateQueue(tx)

      const nullLeaseId = await seedEvent(tx, customer.id, {
        status: "delivering",
        dueSeconds: -3600,
        leaseSeconds: null, // never leased — an in-flight row from before the migration
      })

      const claimed = await tx`
        select id from public.claim_due_notification_events(now(), 500)`
      assert.ok(
        !claimed.map((r) => r.id).includes(nullLeaseId),
        "a NULL-lease delivering row is not reclaimed"
      )
      const [row] = await tx`
        select status from public.notification_events where id = ${nullLeaseId}`
      assert.equal(row.status, "delivering", "it is left delivering, untouched")
    })
  }
)
