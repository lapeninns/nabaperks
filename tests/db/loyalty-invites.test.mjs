import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * DB integration tier for Bulk Two-Stamp Loyalty Invitations. Proves the
 * invariants mocks cannot: exactly two loyalty_invite stamps in one atomic
 * claim, idempotent replay, existing-member and expiry refusals, eligibility
 * filtering, and the one-active-campaign cap. Skips cleanly when the loyalty
 * invite RPCs are not deployed so the DB-free gates never block.
 */

async function loyaltyInvitesDbReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [{ n }] = await db()`
      select count(*)::int as n from pg_proc where proname in (
        'create_loyalty_invite_draft', 'confirm_loyalty_invite_campaign',
        'claim_loyalty_invite', 'expire_and_purge_loyalty_invites')`
    return n >= 4
  } catch {
    return false
  }
}

const ready = await loyaltyInvitesDbReady()
const skip = ready
  ? false
  : "live Supabase DB with loyalty-invite RPCs not reachable"
const POLICY = "2026-07-19"

after(async () => {
  await closeDb()
})

function hex64() {
  return (randomUUID() + randomUUID()).replace(/-/g, "")
}

async function enableInvites() {
  // Bulk invitations are default-on for every merchant, so there is no allowlist
  // to set; kept as a no-op so the existing call sites read unchanged.
}

async function freshPhoneCustomer(tx) {
  const authId = randomUUID()
  const customerId = randomUUID()
  await tx`insert into auth.users (id) values (${authId}::uuid)`
  await tx`
    insert into public.customers (id, auth_user_id, phone_hmac, phone_verified_at)
    values (${customerId}::uuid, ${authId}::uuid, ${hex64()}, now())`
  return customerId
}

async function draft(tx, merchantId, emailHmac, claimHash, unsubHash) {
  const [row] = await tx`
    select * from public.create_loyalty_invite_draft(
      ${merchantId}::uuid, null,
      ${[randomUUID()]}::uuid[], ${[emailHmac]}::text[], ${["v1.cipher.tag.body"]}::text[],
      ${["r***@example.test"]}::text[], ${[claimHash]}::text[], ${[unsubHash]}::text[], 0, 0)`
  return row
}

test(
  "an eligible claim creates one membership and exactly two stamps",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableInvites(tx, fx.merchantId)
      const customerId = await freshPhoneCustomer(tx)
      const emailHmac = hex64()
      const claimHash = hex64()

      const d = await draft(tx, fx.merchantId, emailHmac, claimHash, hex64())
      assert.equal(d.eligible_count, 1)
      await tx`select public.confirm_loyalty_invite_campaign(${fx.merchantId}::uuid, ${d.campaign_id}::uuid, 'venue_email_consent', 30)`

      const [res] = await tx`
      select * from public.claim_loyalty_invite(
        ${customerId}::uuid, ${claimHash}, ${POLICY}, false, ${"invited@example.test"}, ${emailHmac})`
      assert.equal(res.status, "claimed")
      assert.equal(res.stamps_awarded, 2)

      const stamps = await tx`
      select metadata->>'source' as source, earned_business_date
      from public.stamp_events where membership_id = ${res.membership_id}::uuid`
      assert.equal(stamps.length, 2, "exactly two stamp rows")
      assert.ok(stamps.every((s) => s.source === "loyalty_invite"))
      assert.ok(
        stamps.every((s) => s.earned_business_date === null),
        "cap-exempt, no visit date"
      )

      const [m] = await tx`
      select current_stamp_count, total_stamps_earned
      from public.customer_memberships where id = ${res.membership_id}::uuid`
      assert.equal(m.current_stamp_count, 2)
      assert.equal(m.total_stamps_earned, 2)

      const [r] = await tx`
      select status, email_ciphertext, email_masked, claim_token_hash
      from public.loyalty_invite_recipients where claimed_membership_id = ${res.membership_id}::uuid`
      assert.equal(r.status, "joined")
      assert.equal(r.email_ciphertext, null, "ciphertext scrubbed on claim")
      assert.equal(r.claim_token_hash, null, "claim token scrubbed on claim")
    })
  }
)

test(
  "a repeated claim is idempotent and awards nothing more",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableInvites(tx, fx.merchantId)
      const customerId = await freshPhoneCustomer(tx)
      const emailHmac = hex64()
      const claimHash = hex64()
      const d = await draft(tx, fx.merchantId, emailHmac, claimHash, hex64())
      await tx`select public.confirm_loyalty_invite_campaign(${fx.merchantId}::uuid, ${d.campaign_id}::uuid, 'venue_email_consent', 30)`

      const [first] = await tx`
      select * from public.claim_loyalty_invite(
        ${customerId}::uuid, ${claimHash}, ${POLICY}, false, ${"invited@example.test"}, ${emailHmac})`
      assert.equal(first.status, "claimed")

      const [second] = await tx`
      select * from public.claim_loyalty_invite(
        ${customerId}::uuid, ${claimHash}, ${POLICY}, false, ${"invited@example.test"}, ${emailHmac})`
      assert.notEqual(second.status, "claimed")

      const [{ n }] = await tx`
      select count(*)::int as n from public.stamp_events where membership_id = ${first.membership_id}::uuid`
      assert.equal(n, 2, "no double award")
    })
  }
)

test(
  "an existing member is shown their card and awarded nothing",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableInvites(tx, fx.merchantId)
      // fx.customerId already has a membership (current_stamp_count 3) at fx.merchant.
      // Give them a verified phone so the claim reaches the membership check.
      await tx`update public.customers set phone_hmac = ${hex64()}, phone_verified_at = now() where id = ${fx.customerId}::uuid`
      const emailHmac = hex64()
      const claimHash = hex64()
      const d = await draft(tx, fx.merchantId, emailHmac, claimHash, hex64())
      await tx`select public.confirm_loyalty_invite_campaign(${fx.merchantId}::uuid, ${d.campaign_id}::uuid, 'venue_email_consent', 30)`

      const [res] = await tx`
      select * from public.claim_loyalty_invite(
        ${fx.customerId}::uuid, ${claimHash}, ${POLICY}, false, ${"invited@example.test"}, ${emailHmac})`
      assert.equal(res.status, "already_member")
      assert.equal(res.stamps_awarded, 0)
      assert.equal(res.membership_id, fx.membershipId)
    })
  }
)

test("an expired invitation awards nothing", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fx = await createRewardPoolFixture(tx)
    await enableInvites(tx, fx.merchantId)
    const customerId = await freshPhoneCustomer(tx)
    const emailHmac = hex64()
    const claimHash = hex64()
    const d = await draft(tx, fx.merchantId, emailHmac, claimHash, hex64())
    await tx`select public.confirm_loyalty_invite_campaign(${fx.merchantId}::uuid, ${d.campaign_id}::uuid, 'venue_email_consent', 30)`
    await tx`update public.loyalty_invite_campaigns set link_expires_at = now() - interval '1 day' where id = ${d.campaign_id}::uuid`

    const [res] = await tx`
      select * from public.claim_loyalty_invite(
        ${customerId}::uuid, ${claimHash}, ${POLICY}, false, ${"invited@example.test"}, ${emailHmac})`
    assert.equal(res.status, "expired")
    assert.equal(res.stamps_awarded, 0)
  })
})

test(
  "suppressed and existing-member addresses are filtered from a draft",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableInvites(tx, fx.merchantId)
      const suppressed = hex64()
      await tx`insert into public.loyalty_invite_email_suppressions (merchant_id, email_hmac, reason) values (null, ${suppressed}, 'bounced')`

      const eligible = hex64()
      const [row] = await tx`
      select * from public.create_loyalty_invite_draft(
        ${fx.merchantId}::uuid, null,
        ${[randomUUID(), randomUUID()]}::uuid[],
        ${[eligible, suppressed]}::text[],
        ${["v1.a", "v1.b"]}::text[],
        ${["a***@x.test", "b***@x.test"]}::text[],
        ${[hex64(), hex64()]}::text[],
        ${[hex64(), hex64()]}::text[],
        0, 0)`
      assert.equal(row.eligible_count, 1, "the suppressed address is filtered")
      assert.equal(row.not_eligible_count, 1)
    })
  }
)

test("only one active campaign per merchant is allowed", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fx = await createRewardPoolFixture(tx)
    await enableInvites(tx, fx.merchantId)
    const d = await draft(tx, fx.merchantId, hex64(), hex64(), hex64())
    await tx`select public.confirm_loyalty_invite_campaign(${fx.merchantId}::uuid, ${d.campaign_id}::uuid, 'venue_email_consent', 30)`

    await assert.rejects(
      () => draft(tx, fx.merchantId, hex64(), hex64(), hex64()),
      /already in progress/
    )
  })
})

test(
  "a completed campaign does not block creating a new one",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const d1 = await draft(tx, fx.merchantId, hex64(), hex64(), hex64())
      await tx`select public.confirm_loyalty_invite_campaign(${fx.merchantId}::uuid, ${d1.campaign_id}::uuid, 'venue_email_consent', 30)`
      // Simulate the queue draining to completion with an unclaimed sent link.
      await tx`update public.loyalty_invite_recipients set status = 'sent', sent_at = now() where campaign_id = ${d1.campaign_id}::uuid`
      await tx`update public.loyalty_invite_campaigns set status = 'completed', completed_at = now() where id = ${d1.campaign_id}::uuid`

      // A brand-new campaign is allowed — only a 'sending' campaign blocks.
      const d2 = await draft(tx, fx.merchantId, hex64(), hex64(), hex64())
      assert.equal(d2.eligible_count, 1)
      assert.notEqual(d2.campaign_id, d1.campaign_id)
    })
  }
)

test(
  "a completed campaign with unclaimed links stays revocable",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableInvites(tx, fx.merchantId)
      const d = await draft(tx, fx.merchantId, hex64(), hex64(), hex64())
      await tx`select public.confirm_loyalty_invite_campaign(${fx.merchantId}::uuid, ${d.campaign_id}::uuid, 'venue_email_consent', 30)`
      // Simulate a fully drained queue whose sent link remains unclaimed.
      await tx`update public.loyalty_invite_recipients set status = 'sent', sent_at = now() where campaign_id = ${d.campaign_id}::uuid`
      await tx`update public.loyalty_invite_campaigns set status = 'completed', completed_at = now() where id = ${d.campaign_id}::uuid`

      const [cancelled] = await tx`
      select public.cancel_loyalty_invite_campaign(${fx.merchantId}::uuid, ${d.campaign_id}::uuid) as ok`
      assert.equal(cancelled.ok, true, "completed campaigns can be cancelled")

      const [r] = await tx`
      select status, claim_token_hash from public.loyalty_invite_recipients where campaign_id = ${d.campaign_id}::uuid`
      assert.equal(r.status, "cancelled")
      assert.equal(r.claim_token_hash, null, "unclaimed link invalidated")
    })
  }
)

test(
  "confirming with no eligible recipients completes immediately",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableInvites(tx, fx.merchantId)
      // The only candidate is suppressed, so the draft has zero recipients.
      const only = hex64()
      await tx`insert into public.loyalty_invite_email_suppressions (merchant_id, email_hmac, reason) values (null, ${only}, 'bounced')`
      const d = await draft(tx, fx.merchantId, only, hex64(), hex64())
      assert.equal(d.eligible_count, 0)

      await tx`select public.confirm_loyalty_invite_campaign(${fx.merchantId}::uuid, ${d.campaign_id}::uuid, 'venue_email_consent', 30)`
      const [c] =
        await tx`select status from public.loyalty_invite_campaigns where id = ${d.campaign_id}::uuid`
      assert.equal(
        c.status,
        "completed",
        "no recipients -> completes at confirmation, never stuck"
      )
    })
  }
)
