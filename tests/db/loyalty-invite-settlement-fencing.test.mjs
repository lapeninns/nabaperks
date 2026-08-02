import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * Loyalty-invite settlement must be fenced by the claim generation.
 *
 * The drain leases a recipient for five minutes and increments attempt_count.
 * If that lease expires mid-send, a second worker reclaims the row — and the
 * first worker's late settlement used to overwrite it. A stale 'retry' put a
 * delivered recipient back to 'queued' inside a 'completed' campaign, which the
 * drain predicate (it joins on c.status = 'sending') can never claim again.
 */

async function fencingReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [{ n }] = await db()`
      select count(*)::int as n
      from pg_proc
      where proname = 'settle_loyalty_invite_send' and pronargs = 6`
    return n === 1
  } catch {
    return false
  }
}

const ready = await fencingReady()
const skip = ready ? false : "fenced settle_loyalty_invite_send not deployed"

after(async () => {
  await closeDb()
})

function hex64() {
  return (randomUUID() + randomUUID()).replace(/-/g, "")
}

test(
  "a worker whose lease expired cannot overwrite the newer generation",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const invite = await sendingRecipient(tx)

      // Generation 1 leased the row. Its lease then expires and generation 2
      // reclaims it — attempt_count is now 2.
      await tx`
        update public.loyalty_invite_recipients
        set attempt_count = 2, status = 'sending'
        where id = ${invite.recipientId}::uuid`

      // Generation 1 finally comes back from a slow provider call.
      const accepted = await settle(tx, invite.recipientId, 1, "retry")

      assert.equal(accepted, false, "a stale generation must be refused")

      const [row] = await tx`
        select status, attempt_count from public.loyalty_invite_recipients
        where id = ${invite.recipientId}::uuid`
      assert.equal(row.status, "sending", "generation 2 still owns the row")
      assert.equal(row.attempt_count, 2)
    })
  }
)

test(
  "the generation that holds the lease settles normally",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const invite = await sendingRecipient(tx)

      const accepted = await settle(tx, invite.recipientId, 1, "sent", {
        providerMessageId: "msg_fenced_ok",
      })

      assert.equal(accepted, true)
      const [row] = await tx`
        select status, provider_message_id, lease_expires_at
        from public.loyalty_invite_recipients
        where id = ${invite.recipientId}::uuid`
      assert.equal(row.status, "sent")
      assert.equal(row.provider_message_id, "msg_fenced_ok")
      assert.equal(row.lease_expires_at, null, "the lease is released")
    })
  }
)

test(
  "a rejected settlement still lets the campaign complete",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const invite = await sendingRecipient(tx)

      // A concurrent unsubscribe moves the row off 'sending' while the worker
      // is still mid-send. The settle is correctly refused — but if it returned
      // early without re-deriving completion, the campaign would stay 'sending'
      // forever and permanently block the next draft for this venue.
      await tx`
        update public.loyalty_invite_recipients
        set status = 'unsubscribed', unsubscribed_at = now()
        where id = ${invite.recipientId}::uuid`

      const accepted = await settle(tx, invite.recipientId, 1, "sent")
      assert.equal(accepted, false, "the row is no longer ours to settle")

      const [row] = await tx`
        select status from public.loyalty_invite_recipients
        where id = ${invite.recipientId}::uuid`
      assert.equal(row.status, "unsubscribed", "the newer state is preserved")

      const [campaign] = await tx`
        select status from public.loyalty_invite_campaigns
        where id = ${invite.campaignId}::uuid`
      assert.equal(
        campaign.status,
        "completed",
        "completion must still be re-derived after a lost lease"
      )
    })
  }
)

test(
  "settlement without a generation is refused rather than guessed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const invite = await sendingRecipient(tx)

      const accepted = await settle(tx, invite.recipientId, null, "sent")

      assert.equal(accepted, false)
      const [row] = await tx`
        select status from public.loyalty_invite_recipients
        where id = ${invite.recipientId}::uuid`
      assert.equal(row.status, "sending", "nothing was written")
    })
  }
)

/**
 * A campaign in 'sending' with one recipient leased by generation 1.
 */
async function sendingRecipient(tx) {
  const fixture = await createRewardPoolFixture(tx)
  const campaignId = randomUUID()
  const recipientId = randomUUID()

  await tx`
    insert into public.loyalty_invite_campaigns
      (id, merchant_id, status, legal_basis, link_expires_at, confirmed_at)
    values
      (${campaignId}::uuid, ${fixture.merchantId}::uuid, 'sending',
       'venue_email_consent', now() + interval '30 days', now())`

  await tx`
    insert into public.loyalty_invite_recipients
      (id, campaign_id, merchant_id, email_hmac, email_ciphertext, email_masked,
       claim_token_hash, unsubscribe_token_hash, status, attempt_count,
       lease_expires_at)
    values
      (${recipientId}::uuid, ${campaignId}::uuid, ${fixture.merchantId}::uuid,
       ${hex64()}, 'v1.cipher.tag.body', 'r***@example.test',
       ${hex64()}, ${hex64()}, 'sending', 1, now() - interval '1 minute')`

  return { campaignId, recipientId, merchantId: fixture.merchantId }
}

async function settle(
  tx,
  recipientId,
  expectedAttemptCount,
  outcome,
  { providerMessageId = null } = {}
) {
  const [row] = await tx`
    select public.settle_loyalty_invite_send(
      ${recipientId}::uuid,
      ${expectedAttemptCount}::integer,
      ${outcome},
      ${providerMessageId},
      null,
      null
    ) as accepted`
  return row.accepted
}
