import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * DB integration tier for the discount pass: minting, staff reading and staff
 * redemption. These are the invariants no mock can hold —
 *
 *   * one scan TOKEN is honoured exactly once, while the PASS itself is never
 *     consumed and can be used again with a fresh token;
 *   * a redemption row cannot be edited or deleted afterwards;
 *   * both attestations are enforced in the database, not only in the form;
 *   * the token table is bearer material with no authenticated grant;
 *   * the purge never destroys a token that is evidence of a redemption.
 *
 * Skips cleanly when the offer pass RPCs are not deployed so the DB-free gates
 * never block.
 */

async function offerPassDbReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [{ n }] = await db()`
      select count(*)::int as n from pg_proc where proname in (
        'create_offer_pass_scan_token', 'purge_expired_offer_pass_scan_tokens',
        'get_offer_pass_scan_context', 'redeem_offer_pass')`
    return n >= 4
  } catch {
    return false
  }
}

const ready = await offerPassDbReady()
const skip = ready
  ? false
  : "live Supabase DB with offer pass RPCs not reachable"

after(async () => {
  await closeDb()
})

/**
 * A published campaign, a claim and the issued pass, written directly so this
 * suite does not depend on the customer claim transaction landing first.
 */
async function issuePass(tx, fx, overrides = {}) {
  const campaignId = randomUUID()
  const claimId = randomUUID()
  const entitlementId = randomUUID()

  await tx`
    insert into public.offer_campaigns (
      id, merchant_id, status, discount_percent, starts_on, ends_on,
      requires_id_check, extra_terms, published_at
    ) values (
      ${campaignId}::uuid, ${fx.merchantId}::uuid, 'live', 10,
      public.uk_business_date(now()) - 1, public.uk_business_date(now()) + 30,
      ${overrides.requiresIdCheck ?? false}, 'Food only.', now()
    )`

  await tx`
    insert into public.offer_campaign_claims (
      id, campaign_id, merchant_id, customer_id, membership_id,
      bonus_stamps_awarded
    ) values (
      ${claimId}::uuid, ${campaignId}::uuid, ${fx.merchantId}::uuid,
      ${fx.customerId}::uuid, ${fx.membershipId}::uuid, 0
    )`

  await tx`
    insert into public.offer_discount_entitlements (
      id, claim_id, campaign_id, merchant_id, customer_id, membership_id,
      discount_percent, requires_id_check, extra_terms, status,
      valid_from, valid_to
    ) values (
      ${entitlementId}::uuid, ${claimId}::uuid, ${campaignId}::uuid,
      ${fx.merchantId}::uuid, ${fx.customerId}::uuid, ${fx.membershipId}::uuid,
      10, ${overrides.requiresIdCheck ?? false}, 'Food only.',
      ${overrides.status ?? "active"},
      public.uk_business_date(now()) - 1, public.uk_business_date(now()) + 30
    )`

  return { campaignId, claimId, entitlementId }
}

async function mint(tx, entitlementId, customerId) {
  const [row] = await tx`
    select * from public.create_offer_pass_scan_token(
      ${entitlementId}::uuid, ${customerId}::uuid)`
  return row
}

async function context(tx, scanToken, merchantId) {
  const [row] = await tx`
    select * from public.get_offer_pass_scan_context(
      ${scanToken}::uuid, ${merchantId}::uuid)`
  return row
}

async function redeem(tx, scanToken, merchantId, idChecked, noStacking) {
  const [row] = await tx`
    select * from public.redeem_offer_pass(
      ${scanToken}::uuid, ${merchantId}::uuid, ${idChecked}, ${noStacking}, null)`
  return row
}

async function refusal(tx, fn) {
  let captured = null
  try {
    await tx.savepoint(async (sp) => {
      await fn(sp)
    })
  } catch (error) {
    captured = error
  }
  return captured
}

test(
  "a scanned pass reads ready, redeems once, and leaves the pass active",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)

      const minted = await mint(tx, pass.entitlementId, fx.customerId)
      assert.ok(minted.scan_token, "a scan token is minted")

      const before = await context(tx, minted.scan_token, fx.merchantId)
      assert.equal(before.scan_status, "ready")
      assert.equal(before.discount_percent, 10)
      assert.equal(before.entitlement_id, pass.entitlementId)
      assert.equal(before.membership_id, fx.membershipId)

      const result = await redeem(
        tx,
        minted.scan_token,
        fx.merchantId,
        false,
        true
      )
      assert.ok(result.redemption_id)
      assert.equal(result.discount_percent, 10)
      assert.equal(result.membership_id, fx.membershipId)

      const [row] = await tx`
        select entitlement_id, campaign_id, scan_token_id,
               id_check_attested, no_stacking_attested
        from public.offer_redemptions where id = ${result.redemption_id}::uuid`
      assert.equal(row.entitlement_id, pass.entitlementId)
      assert.equal(row.campaign_id, pass.campaignId)
      assert.equal(row.scan_token_id, minted.scan_token)
      assert.equal(row.id_check_attested, false)
      assert.equal(row.no_stacking_attested, true)

      const [token] = await tx`
        select consumed_at, consumed_by_merchant_id
        from public.offer_pass_scan_tokens where id = ${minted.scan_token}::uuid`
      assert.ok(token.consumed_at, "the scan token is consumed")
      assert.equal(token.consumed_by_merchant_id, fx.merchantId)

      // The entitlement is NEVER consumed — this is what separates a discount
      // pass from a reward.
      const [entitlement] = await tx`
        select status from public.offer_discount_entitlements
        where id = ${pass.entitlementId}::uuid`
      assert.equal(entitlement.status, "active")

      const after = await context(tx, minted.scan_token, fx.merchantId)
      assert.equal(after.scan_status, "redeemed")
    })
  }
)

test(
  "one token redeems once, but the pass allows unlimited uses",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)

      const first = await mint(tx, pass.entitlementId, fx.customerId)
      await redeem(tx, first.scan_token, fx.merchantId, false, true)

      const replay = await refusal(tx, (sp) =>
        redeem(sp, first.scan_token, fx.merchantId, false, true)
      )
      assert.match(String(replay?.message), /already used/)

      // A fresh token is available immediately: the previous one is consumed,
      // so the reuse branch cannot hand it back.
      const second = await mint(tx, pass.entitlementId, fx.customerId)
      assert.notEqual(second.scan_token, first.scan_token)

      const again = await redeem(
        tx,
        second.scan_token,
        fx.merchantId,
        false,
        true
      )
      assert.ok(again.redemption_id)

      const [{ n }] = await tx`
        select count(*)::int as n from public.offer_redemptions
        where entitlement_id = ${pass.entitlementId}::uuid`
      assert.equal(n, 2, "the same pass redeemed twice")

      const [entitlement] = await tx`
        select status from public.offer_discount_entitlements
        where id = ${pass.entitlementId}::uuid`
      assert.equal(entitlement.status, "active")
    })
  }
)

test(
  "minting reuses a live unconsumed token rather than piling up bearer rows",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)

      const first = await mint(tx, pass.entitlementId, fx.customerId)
      const second = await mint(tx, pass.entitlementId, fx.customerId)
      assert.equal(second.scan_token, first.scan_token)

      const [{ n }] = await tx`
        select count(*)::int as n from public.offer_pass_scan_tokens
        where entitlement_id = ${pass.entitlementId}::uuid`
      assert.equal(n, 1)
    })
  }
)

test(
  "the no-stacking attestation is always required, in the database",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)
      const minted = await mint(tx, pass.entitlementId, fx.customerId)

      const refused = await refusal(tx, (sp) =>
        redeem(sp, minted.scan_token, fx.merchantId, true, false)
      )
      assert.match(String(refused?.message), /not being combined/)

      const [{ n }] = await tx`
        select count(*)::int as n from public.offer_redemptions
        where entitlement_id = ${pass.entitlementId}::uuid`
      assert.equal(n, 0, "nothing is recorded when the confirmation is missing")

      const [token] = await tx`
        select consumed_at from public.offer_pass_scan_tokens
        where id = ${minted.scan_token}::uuid`
      assert.equal(token.consumed_at, null, "the token survives a refusal")
    })
  }
)

test(
  "the ID attestation is required exactly when the campaign asked for one",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx, { requiresIdCheck: true })
      const minted = await mint(tx, pass.entitlementId, fx.customerId)

      const scan = await context(tx, minted.scan_token, fx.merchantId)
      assert.equal(scan.requires_id_check, true)

      const refused = await refusal(tx, (sp) =>
        redeem(sp, minted.scan_token, fx.merchantId, false, true)
      )
      assert.match(String(refused?.message), /requires an ID check/)

      const allowed = await redeem(
        tx,
        minted.scan_token,
        fx.merchantId,
        true,
        true
      )
      const [row] = await tx`
        select id_check_attested from public.offer_redemptions
        where id = ${allowed.redemption_id}::uuid`
      assert.equal(row.id_check_attested, true)
    })
  }
)

test(
  "a pass scanned by the wrong venue is unauthorised and cannot be redeemed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const other = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)
      const minted = await mint(tx, pass.entitlementId, fx.customerId)

      const scan = await context(tx, minted.scan_token, other.merchantId)
      assert.equal(scan.scan_status, "unauthorized")
      assert.equal(scan.entitlement_id, null, "no pass detail leaks sideways")

      const refused = await refusal(tx, (sp) =>
        redeem(sp, minted.scan_token, other.merchantId, false, true)
      )
      assert.match(String(refused?.message), /different merchant/)
    })
  }
)

test(
  "an expired code reads expired and refuses redemption",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)
      const staleToken = randomUUID()

      await tx`
      insert into public.offer_pass_scan_tokens (
        id, entitlement_id, merchant_id, customer_id, membership_id, expires_at
      ) values (
        ${staleToken}::uuid, ${pass.entitlementId}::uuid, ${fx.merchantId}::uuid,
        ${fx.customerId}::uuid, ${fx.membershipId}::uuid, now() - interval '1 minute'
      )`

      const scan = await context(tx, staleToken, fx.merchantId)
      assert.equal(scan.scan_status, "expired")

      const refused = await refusal(tx, (sp) =>
        redeem(sp, staleToken, fx.merchantId, false, true)
      )
      assert.match(String(refused?.message), /expired/)
    })
  }
)

test(
  "a revoked pass is blocked to staff and refused on redemption",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)
      const minted = await mint(tx, pass.entitlementId, fx.customerId)

      await tx`
        update public.offer_discount_entitlements set status = 'revoked'
        where id = ${pass.entitlementId}::uuid`

      const scan = await context(tx, minted.scan_token, fx.merchantId)
      assert.equal(scan.scan_status, "blocked")
      assert.match(String(scan.blocked_reason), /no longer active/)

      const refused = await refusal(tx, (sp) =>
        redeem(sp, minted.scan_token, fx.merchantId, false, true)
      )
      assert.match(String(refused?.message), /no longer active/)
    })
  }
)

test("redemption records are append-only once written", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fx = await createRewardPoolFixture(tx)
    const pass = await issuePass(tx, fx)
    const minted = await mint(tx, pass.entitlementId, fx.customerId)
    const result = await redeem(
      tx,
      minted.scan_token,
      fx.merchantId,
      false,
      true
    )

    const updated = await refusal(
      tx,
      (sp) => sp`
          update public.offer_redemptions set discount_percent = 25
          where id = ${result.redemption_id}::uuid`
    )
    assert.match(String(updated?.message), /append-only/)

    const deleted = await refusal(
      tx,
      (sp) => sp`
          delete from public.offer_redemptions
          where id = ${result.redemption_id}::uuid`
    )
    assert.match(String(deleted?.message), /append-only/)
  })
})

test(
  "the purge clears dead codes but never destroys redemption evidence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)

      const redeemed = await mint(tx, pass.entitlementId, fx.customerId)
      await redeem(tx, redeemed.scan_token, fx.merchantId, false, true)
      await tx`
        update public.offer_pass_scan_tokens set expires_at = now() - interval '1 hour'
        where id = ${redeemed.scan_token}::uuid`

      const abandoned = randomUUID()
      await tx`
        insert into public.offer_pass_scan_tokens (
          id, entitlement_id, merchant_id, customer_id, membership_id, expires_at
        ) values (
          ${abandoned}::uuid, ${pass.entitlementId}::uuid, ${fx.merchantId}::uuid,
          ${fx.customerId}::uuid, ${fx.membershipId}::uuid, now() - interval '1 hour'
        )`

      const [{ purged }] = await tx`
        select public.purge_expired_offer_pass_scan_tokens(now()) as purged`
      assert.ok(purged >= 1)

      const [{ n: abandonedLeft }] = await tx`
        select count(*)::int as n from public.offer_pass_scan_tokens
        where id = ${abandoned}::uuid`
      assert.equal(abandonedLeft, 0, "the abandoned code is purged")

      const [{ n: evidenceLeft }] = await tx`
        select count(*)::int as n from public.offer_pass_scan_tokens
        where id = ${redeemed.scan_token}::uuid`
      assert.equal(evidenceLeft, 1, "a redeemed code is evidence and survives")
    })
  }
)

test(
  "scan tokens are bearer material with no authenticated grant",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const pass = await issuePass(tx, fx)
      await mint(tx, pass.entitlementId, fx.customerId)

      // The role change and the failing read share one savepoint: rolling it
      // back restores both the role and the request context, and only a genuine
      // 42501 counts as a pass.
      let denied = false
      try {
        await tx.savepoint(async (sp) => {
          await sp`set local role authenticated`
          await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
          await sp`select set_config('request.jwt.claim.sub', ${fx.customerUserId}, true)`
          await sp`select id from public.offer_pass_scan_tokens limit 1`
        })
      } catch (error) {
        denied = error?.code === "42501"
      }

      assert.ok(denied, "authenticated must not hold select on the token table")
    })
  }
)

test("the four pass RPCs are service-role only", { skip }, async () => {
  const rows = await db()`
      select p.proname,
             has_function_privilege('authenticated', p.oid, 'execute') as authenticated_can,
             has_function_privilege('anon', p.oid, 'execute') as anon_can,
             has_function_privilege('service_role', p.oid, 'execute') as service_can
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in (
          'create_offer_pass_scan_token', 'purge_expired_offer_pass_scan_tokens',
          'get_offer_pass_scan_context', 'redeem_offer_pass')`

  assert.equal(rows.length, 4)
  for (const row of rows) {
    assert.equal(
      row.authenticated_can,
      false,
      `${row.proname} vs authenticated`
    )
    assert.equal(row.anon_can, false, `${row.proname} vs anon`)
    assert.equal(row.service_can, true, `${row.proname} vs service_role`)
  }
})
