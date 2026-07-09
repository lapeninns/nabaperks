import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import {
  actAsInternalAdmin,
  createRewardPoolFixture,
  expectRewardPoolRpcRejection,
} from "./helpers/reward-pool-fixture.mjs"

/**
 * MS-rewards-merchant-sent (Phase 4) — pending invites moat. Hashed-at-rest
 * matching, sticky match, dedupe, expiry/scrub, cancel, RLS, and erasure. The
 * RPCs take opaque HMACs (the app computes them), so tests pass synthetic hex.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

function hex64() {
  return (randomUUID() + randomUUID()).replace(/-/g, "")
}

async function createInvite(tx, merchantId, opts = {}) {
  const emailHmac = opts.emailHmac ?? null
  const phoneHmac = opts.phoneHmac ?? null
  const [row] = await tx`
    select * from public.create_merchant_reward_invite(
      ${merchantId}::uuid, ${emailHmac}, ${phoneHmac},
      ${emailHmac ? "r***@example.com" : null}, ${phoneHmac ? "4242" : null},
      ${opts.name ?? "A drink on us"},
      ${opts.terms ?? "A drink on us — thanks for being a regular."},
      ${opts.message ?? null}, ${opts.days ?? 30}, ${opts.tokenHash ?? hex64()})`
  return row
}

function attach(tx, customerId, { phone = null, email = null, token = null } = {}) {
  return tx`
    select * from public.attach_matched_reward_invites(
      ${customerId}::uuid, ${phone}, ${email}, ${token})`
}

async function bareCustomer(tx) {
  const authId = randomUUID()
  const customerId = randomUUID()
  await tx`insert into auth.users (id) values (${authId}::uuid)`
  await tx`
    insert into public.customers (id, auth_user_id, email, full_name, date_of_birth, email_verified_at)
    values (${customerId}::uuid, ${authId}::uuid, ${"bare-" + customerId.slice(0, 8) + "@example.test"},
      'Bare Member', date '1990-01-01', now())`
  return customerId
}

test("lifecycle: create → attach for a member mints the reward and scrubs the hashes", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const emailHmac = hex64()
    const invite = await createInvite(tx, fixture.merchantId, { emailHmac })
    assert.equal(invite.deduped, false)

    const attached = await attach(tx, fixture.customerId, { email: emailHmac })
    assert.equal(attached.length, 1, "one invite attaches")
    assert.equal(attached[0].reward_name, "A drink on us")

    const [reward] = await tx`
      select source, status from public.reward_events where id = ${attached[0].attached_reward_event_id}::uuid`
    assert.equal(reward.source, "merchant_direct")
    assert.equal(reward.status, "unlocked")

    const [row] = await tx`
      select status, email_hmac, phone_hmac, claim_token_hash, attached_customer_id
      from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    assert.equal(row.status, "attached")
    assert.equal(row.email_hmac, null, "hashes scrubbed on attach")
    assert.match(row.claim_token_hash, /^scrubbed:/)
    assert.equal(row.attached_customer_id, fixture.customerId)
  })
})

test("a matched non-member stays matched (attaches later) with hashes intact", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const other = await createRewardPoolFixture(tx)
    const emailHmac = hex64()
    const invite = await createInvite(tx, other.merchantId, { emailHmac })

    // fixture.customer is not a member of `other`'s merchant.
    const attached = await attach(tx, fixture.customerId, { email: emailHmac })
    assert.equal(attached.length, 0, "no attach without a membership")

    const [row] = await tx`
      select status, email_hmac from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    assert.equal(row.status, "matched")
    assert.equal(row.email_hmac, emailHmac, "hashes stay until attach")
  })
})

test("dedupe: a second invite for the same contact returns the first", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const emailHmac = hex64()
    const first = await createInvite(tx, fixture.merchantId, { emailHmac })
    const second = await createInvite(tx, fixture.merchantId, { emailHmac })
    assert.equal(second.deduped, true)
    assert.equal(second.invite_id, first.invite_id)
  })
})

test("create refuses billing-blocked merchants before storing an invite", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    await tx`
      update public.merchants set requires_billing = true
      where id = ${fixture.merchantId}::uuid`

    await expectRewardPoolRpcRejection(
      tx,
      (sp) => createInvite(sp, fixture.merchantId, { emailHmac: hex64() }),
      /not active yet|unavailable|billing/i,
      "billing-blocked merchants cannot create pending reward invites"
    )
  })
})

test("attach is idempotent and billing-blocked members do not attach", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const emailHmac = hex64()
    await createInvite(tx, fixture.merchantId, { emailHmac })

    const first = await attach(tx, fixture.customerId, { email: emailHmac })
    assert.equal(first.length, 1)
    const second = await attach(tx, fixture.customerId, { email: emailHmac })
    assert.equal(second.length, 0, "a re-run mints no second reward")

    const [{ n }] = await tx`
      select count(*)::int as n from public.reward_events
      where source = 'merchant_direct' and membership_id = ${fixture.membershipId}::uuid`
    assert.equal(n, 1)

    // Billing-blocked: create + attempt attach → stays matched.
    const other = await createRewardPoolFixture(tx)
    await tx`update public.merchants set requires_billing = true where id = ${other.merchantId}::uuid`
    const phoneHmac = hex64()
    const inv = await createInvite(tx, other.merchantId, { phoneHmac })
    const blocked = await attach(tx, other.customerId, { phone: phoneHmac })
    assert.equal(blocked.length, 0, "billing fail-closed blocks attach")
    const [row] = await tx`
      select status from public.pending_reward_invites where id = ${inv.invite_id}::uuid`
    assert.equal(row.status, "matched")
  })
})

test("attach honours the direct reward same-day member cap", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const emailHmac = hex64()
    const invite = await createInvite(tx, fixture.merchantId, { emailHmac })
    await tx`
      insert into public.reward_events (
        merchant_id, customer_id, membership_id, loyalty_card_id,
        status, source, reward_name, reward_terms, redeemable_from, created_at, updated_at)
      values (
        ${fixture.merchantId}::uuid, ${fixture.customerId}::uuid,
        ${fixture.membershipId}::uuid, ${fixture.cardId}::uuid,
        'unlocked', 'merchant_direct', 'Already sent',
        'Subject to availability.', public.uk_business_date(now()), now(), now())`

    const attached = await attach(tx, fixture.customerId, { email: emailHmac })
    assert.equal(attached.length, 0, "the invite stays matched when the member cap is full")

    const [row] = await tx`
      select status, email_hmac, attached_reward_event_id
      from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    assert.equal(row.status, "matched")
    assert.equal(row.email_hmac, emailHmac)
    assert.equal(row.attached_reward_event_id, null)
  })
})

test("sticky match: a token never re-targets an invite matched to someone else", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const other = await createRewardPoolFixture(tx)
    const tokenHash = hex64()
    const invite = await createInvite(tx, other.merchantId, {
      phoneHmac: hex64(),
      tokenHash,
    })

    // Neither A nor B is a member of `other`'s merchant, so both only match.
    const a = await bareCustomer(tx)
    const b = await bareCustomer(tx)

    await attach(tx, a, { token: tokenHash })
    let [row] = await tx`
      select status, matched_customer_id from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    assert.equal(row.status, "matched")
    assert.equal(row.matched_customer_id, a)

    // B follows the same token — sticky: the first match holds.
    await attach(tx, b, { token: tokenHash })
    ;[row] = await tx`
      select matched_customer_id from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    assert.equal(row.matched_customer_id, a, "the first verified match wins")
  })
})

test("expire_and_purge expires + scrubs live invites and hard-deletes old terminal ones", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const invite = await createInvite(tx, fixture.merchantId, { emailHmac: hex64() })
    await tx`
      update public.pending_reward_invites set invite_expires_at = now() - interval '1 day'
      where id = ${invite.invite_id}::uuid`

    const [{ count }] = await tx`select public.expire_and_purge_reward_invites(now()) as count`
    assert.ok(count >= 1)
    const [row] = await tx`
      select status, email_hmac, claim_token_hash from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    assert.equal(row.status, "expired")
    assert.equal(row.email_hmac, null)
    assert.match(row.claim_token_hash, /^scrubbed:/)

    // A terminal invite older than 365 days is hard-deleted. Insert it directly
    // (the set_updated_at trigger would reset a back-dated updated_at on UPDATE).
    const oldId = randomUUID()
    await tx`
      insert into public.pending_reward_invites (
        id, merchant_id, reward_name, reward_terms, claim_token_hash, status,
        created_at, updated_at)
      values (${oldId}::uuid, ${fixture.merchantId}::uuid, 'Old reward',
        'Subject to availability here.', ${"scrubbed:" + oldId}, 'expired',
        now() - interval '400 days', now() - interval '400 days')`
    await tx`select public.expire_and_purge_reward_invites(now())`
    const [{ n }] = await tx`
      select count(*)::int as n from public.pending_reward_invites where id = ${oldId}::uuid`
    assert.equal(n, 0, "terminal invites over 365 days are deleted")
  })
})

test("cancel scrubs a live invite", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const invite = await createInvite(tx, fixture.merchantId, { emailHmac: hex64() })
    const [{ ok }] = await tx`
      select public.cancel_merchant_reward_invite(${fixture.merchantId}::uuid, ${invite.invite_id}::uuid) as ok`
    assert.equal(ok, true)
    const [row] = await tx`
      select status, email_hmac from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    assert.equal(row.status, "cancelled")
    assert.equal(row.email_hmac, null)
  })
})

test("RLS: only internal admins can read invites; the audit carries no raw contact", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const emailHmac = hex64()
    const invite = await createInvite(tx, fixture.merchantId, { emailHmac })

    // The audit metadata must not leak the hashed contact.
    const [audit] = await tx`
      select metadata::text as m from public.audit_logs
      where action = 'reward_invite_created' and target_id = ${invite.invite_id}::uuid`
    assert.ok(!audit.m.includes(emailHmac), "no raw hmac in the audit")
    assert.ok(!/[a-f0-9]{64}/.test(audit.m), "no 64-hex hash in the audit")

    // The test connects as a superuser (RLS-exempt), so switch to the real
    // `authenticated` role to exercise the policy. A merchant owner is not an
    // internal admin, so the admin-only select returns nothing.
    await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await tx`select set_config('request.jwt.claim.sub', ${fixture.ownerUserId}, true)`
    await tx`set local role authenticated`
    const ownerRows = await tx`
      select id from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    await tx`reset role`
    assert.equal(ownerRows.length, 0, "RLS blocks a non-admin read")

    // An internal admin can read.
    await tx`select set_config('request.jwt.claim.sub', ${fixture.adminUserId}, true)`
    await tx`select set_config('request.jwt.claim.aal', 'aal2', true)`
    await tx`set local role authenticated`
    const adminRows = await tx`
      select id from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    await tx`reset role`
    assert.equal(adminRows.length, 1)
  })
})

test("erasure cancels + scrubs a customer's matched invites", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const other = await createRewardPoolFixture(tx)
    const emailHmac = hex64()
    const invite = await createInvite(tx, other.merchantId, { emailHmac })
    // Match (not attach) the invite to fixture.customer.
    await attach(tx, fixture.customerId, { email: emailHmac })

    await actAsInternalAdmin(tx, fixture.adminUserId)
    await tx`
      select public.admin_erase_customer_pii(
        ${fixture.customerId}::uuid, ${fixture.merchantId}::uuid, 'email', 'Erasure request test notes')`

    await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
    const [row] = await tx`
      select status, email_hmac from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    assert.equal(row.status, "cancelled", "a matched invite is cancelled on erasure")
    assert.equal(row.email_hmac, null, "the hash is scrubbed")
  })
})

test("erasure cancels + scrubs unmatched email-keyed invites through customer email_hmac", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fixture = await createRewardPoolFixture(tx)
    const emailHmac = hex64()
    await tx`
      update public.customers set email_hmac = ${emailHmac}
      where id = ${fixture.customerId}::uuid`
    const invite = await createInvite(tx, fixture.merchantId, { emailHmac })

    await actAsInternalAdmin(tx, fixture.adminUserId)
    await tx`
      select public.admin_erase_customer_pii(
        ${fixture.customerId}::uuid, ${fixture.merchantId}::uuid, 'email', 'Erasure request test notes')`

    await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
    const [row] = await tx`
      select status, email_hmac from public.pending_reward_invites where id = ${invite.invite_id}::uuid`
    assert.equal(row.status, "cancelled", "email-keyed invite is cancelled on erasure")
    assert.equal(row.email_hmac, null, "the email hash is scrubbed")
  })
})
