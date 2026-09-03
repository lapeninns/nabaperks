import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const baseReady = await isLiveDbReady()
let receiverReady = false
if (baseReady) {
  const rows = await db()`
    select count(*)::int as n
    from pg_proc
    where proname in (
      'claim_production_alert',
      'complete_production_alert_delivery',
      'fail_production_alert_delivery'
    )`
  receiverReady = rows[0]?.n === 3
}
const skip = receiverReady
  ? false
  : "production alert receiver migration not applied"

after(closeDb)

function claim(tx, deliveryId, action = "trigger", kind = "readiness") {
  const dedupKeys = {
    readiness: "nabaperks-production-readiness",
    "availability-slo": "nabaperks-production-availability-slo",
    "release-canary": "nabaperks-production-release-canary",
  }
  const dedupKey = dedupKeys[kind]
  return tx`
    select public.claim_production_alert(
      ${deliveryId}::uuid,
      ${action},
      ${kind},
      ${dedupKey},
      ${"a".repeat(64)},
      now(),
      ${"https://github.com/lapeninns/nabaperks/actions/runs/123456"},
      ${"abcdef123456"}
    ) as outcome`
}

test(
  "trigger, replay and resolve preserve incident state without duplicate pages",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const triggerId = randomUUID()
      const first = (await claim(tx, triggerId))[0].outcome
      assert.equal(first.pageRequired, true)
      assert.equal(first.duplicate, false)
      const inFlightRetry = (await claim(tx, triggerId))[0].outcome
      assert.equal(inFlightRetry.pageRequired, true)
      assert.equal(inFlightRetry.duplicate, false)
      await tx`select public.complete_production_alert_delivery(${triggerId}::uuid)`

      const replay = (await claim(tx, triggerId))[0].outcome
      assert.deepEqual(replay, { pageRequired: false, duplicate: true })

      const duplicateTrigger = (await claim(tx, randomUUID()))[0].outcome
      assert.deepEqual(duplicateTrigger, {
        pageRequired: false,
        duplicate: true,
      })

      const resolveId = randomUUID()
      const resolution = (await claim(tx, resolveId, "resolve"))[0].outcome
      assert.equal(resolution.pageRequired, true)
      await tx`select public.complete_production_alert_delivery(${resolveId}::uuid)`

      const incident = await tx`
      select state, pending_delivery_id
      from private.production_alert_incidents
      where dedup_key = 'nabaperks-production-readiness'`
      assert.deepEqual(incident[0], {
        state: "resolved",
        pending_delivery_id: null,
      })
    })
  }
)

test(
  "failed paging releases the incident without changing its durable state",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const deliveryId = randomUUID()
      assert.equal((await claim(tx, deliveryId))[0].outcome.pageRequired, true)
      await tx`select public.fail_production_alert_delivery(${deliveryId}::uuid, 'paging_failed')`

      const rows = await tx`
      select state, pending_delivery_id
      from private.production_alert_incidents
      where dedup_key = 'nabaperks-production-readiness'`
      assert.deepEqual(rows[0], {
        state: "resolved",
        pending_delivery_id: null,
      })
      assert.equal((await claim(tx, deliveryId))[0].outcome.pageRequired, true)
    })
  }
)

test(
  "authenticated callers cannot claim or complete alert deliveries",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await assert.rejects(
        () => claim(tx, randomUUID()),
        /Service role required/
      )
    })
  }
)

test(
  "release canaries cannot change operational incident state",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const readinessId = randomUUID()
      await claim(tx, readinessId)
      await tx`select public.complete_production_alert_delivery(${readinessId}::uuid)`

      const canaryId = randomUUID()
      await claim(tx, canaryId, "trigger", "release-canary")
      await tx`select public.complete_production_alert_delivery(${canaryId}::uuid)`

      const states = await tx`
      select dedup_key, state
      from private.production_alert_incidents
      where dedup_key in (
        'nabaperks-production-readiness',
        'nabaperks-production-release-canary'
      )
      order by dedup_key`
      assert.deepEqual(
        [...states],
        [
          {
            dedup_key: "nabaperks-production-readiness",
            state: "triggered",
          },
          {
            dedup_key: "nabaperks-production-release-canary",
            state: "triggered",
          },
        ]
      )
    })
  }
)
