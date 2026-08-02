import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * Delivery events must apply monotonically.
 *
 * A signed Resend event is authentic, but authenticity is not consumption: the
 * ±300s Standard-Webhooks window is a freshness check, so the same envelope can
 * be replayed inside it — and a late event can arrive after the recipient has
 * already reached a terminal state by another route entirely.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

// Every terminal state, and why regressing it matters.
const TERMINAL = [
  [
    "failed",
    "failure evidence and the suppression row would survive a resurrection",
  ],
  ["unsubscribed", "the recipient withdrew consent"],
  ["expired", "the invitation window closed"],
  [
    "cancelled",
    "the lifetime-once index is `where status <> 'cancelled'`, so resurrecting re-arms dedupe",
  ],
  ["joined", "the recipient already claimed"],
]

for (const [status, why] of TERMINAL) {
  test(
    `a replayed delivered event cannot resurrect a ${status} recipient`,
    { skip },
    async () => {
      await inRolledBackTxn(async (tx) => {
        const invite = await recipientInState(tx, status)

        const applied = await applyEvent(
          tx,
          invite.providerMessageId,
          "delivered"
        )

        const [row] = await tx`
          select status from public.loyalty_invite_recipients
          where id = ${invite.recipientId}::uuid`
        assert.equal(row.status, status, why)
        void applied
      })
    }
  )
}

test(
  "a delivered event still advances a recipient that is genuinely in flight",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const invite = await recipientInState(tx, "sent")

      const applied = await applyEvent(
        tx,
        invite.providerMessageId,
        "delivered"
      )
      assert.equal(applied, true)

      const [row] = await tx`
        select status, delivered_at from public.loyalty_invite_recipients
        where id = ${invite.recipientId}::uuid`
      assert.equal(row.status, "delivered")
      assert.ok(row.delivered_at, "the delivery timestamp is recorded")
    })
  }
)

test(
  "a bounce still claims an in-flight recipient and suppresses the address",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const invite = await recipientInState(tx, "delivered")

      const applied = await applyEvent(tx, invite.providerMessageId, "bounced")
      assert.equal(applied, true)

      const [row] = await tx`
        select status, failure_reason, claim_token_hash
        from public.loyalty_invite_recipients
        where id = ${invite.recipientId}::uuid`
      assert.equal(row.status, "failed")
      assert.equal(row.failure_reason, "bounced")
      assert.equal(
        row.claim_token_hash,
        null,
        "contact and tokens are scrubbed"
      )

      const [suppression] = await tx`
        select count(*)::int as n from public.loyalty_invite_email_suppressions
        where email_hmac = ${invite.emailHmac}`
      assert.equal(suppression.n, 1, "bounces must still suppress")
    })
  }
)

test(
  "a failure event cannot overwrite a recipient who already joined",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const invite = await recipientInState(tx, "joined")

      await applyEvent(tx, invite.providerMessageId, "bounced")

      const [row] = await tx`
        select status, claim_token_hash from public.loyalty_invite_recipients
        where id = ${invite.recipientId}::uuid`
      assert.equal(row.status, "joined")
      assert.ok(
        row.claim_token_hash,
        "a claimed invite is not scrubbed by a late bounce"
      )
    })
  }
)

test("an unknown provider message id stays a non-error", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    // Resend also sends events for OTP mail and merchant digests, which have
    // no recipient row. That must not become a 500 the provider retries.
    const applied = await applyEvent(
      tx,
      `msg_unknown_${randomUUID()}`,
      "delivered"
    )
    assert.equal(applied, false)
  })
})

async function recipientInState(tx, status) {
  const fixture = await createRewardPoolFixture(tx)
  const campaignId = randomUUID()
  const recipientId = randomUUID()
  const providerMessageId = `msg_${randomUUID()}`
  const emailHmac = hex64()

  await tx`
    insert into public.loyalty_invite_campaigns
      (id, merchant_id, status, legal_basis, link_expires_at, confirmed_at)
    values
      (${campaignId}::uuid, ${fixture.merchantId}::uuid, 'sending',
       'venue_email_consent', now() + interval '30 days', now())`

  await tx`
    insert into public.loyalty_invite_recipients
      (id, campaign_id, merchant_id, email_hmac, email_ciphertext, email_masked,
       claim_token_hash, unsubscribe_token_hash, status, provider_message_id,
       failure_reason, failed_at)
    values
      (${recipientId}::uuid, ${campaignId}::uuid, ${fixture.merchantId}::uuid,
       ${emailHmac}, 'v1.cipher.tag.body', 'r***@example.test',
       ${hex64()}, ${hex64()}, ${status}, ${providerMessageId},
       ${status === "failed" ? "bounced" : null},
       ${status === "failed" ? new Date().toISOString() : null})`

  return { campaignId, recipientId, providerMessageId, emailHmac }
}

async function applyEvent(tx, providerMessageId, event) {
  const [row] = await tx`
    select public.apply_loyalty_invite_delivery_event(
      ${providerMessageId}, ${event}) as applied`
  return row.applied
}

function hex64() {
  return (randomUUID() + randomUUID()).replace(/-/g, "")
}
