import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn } from "./helpers/db.mjs"
import {
  createRewardPoolFixture,
  isRewardPoolDbReady,
} from "./helpers/reward-pool-fixture.mjs"

const ready = await isRewardPoolDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

test("weekly digest claims are exclusive and remain sent", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await tx`select set_config('request.jwt.claim.role', 'service_role', true)`

    const [first] = await tx`
      select * from public.claim_merchant_weekly_digest(
        ${fixture.merchantId}::uuid,
        date '2099-12-28',
        timestamptz '2099-12-28 09:00:00+00'
      )`
    assert.equal(first.claim_status, "claimed")
    assert.ok(first.claim_lease_id)
    assert.equal(first.attempt_count, 1)

    const [concurrent] = await tx`
      select * from public.claim_merchant_weekly_digest(
        ${fixture.merchantId}::uuid,
        date '2099-12-28',
        timestamptz '2099-12-28 09:01:00+00'
      )`
    assert.equal(concurrent.claim_status, "busy")

    const [{ completed }] = await tx`
      select public.complete_merchant_weekly_digest(
        ${fixture.merchantId}::uuid,
        date '2099-12-28',
        ${first.claim_lease_id}::uuid,
        timestamptz '2099-12-28 09:02:00+00'
      ) as completed`
    assert.equal(completed, true)

    const [afterSend] = await tx`
      select * from public.claim_merchant_weekly_digest(
        ${fixture.merchantId}::uuid,
        date '2099-12-28',
        timestamptz '2099-12-28 09:03:00+00'
      )`
    assert.equal(afterSend.claim_status, "sent")
    assert.equal(afterSend.claim_lease_id, null)
  })
})
