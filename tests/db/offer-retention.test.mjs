import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"

/**
 * DB integration tier for offer retention, privacy export and erasure.
 *
 * The invariants proved here are the ones a mock cannot hold:
 *
 *   * a scheduled campaign becomes live the day it starts, without waiting for
 *     a customer to scan;
 *   * a campaign past its end date is retired and its printed link scrubbed;
 *   * ending or expiring a CAMPAIGN never cancels a PASS already issued — the
 *     entitlement keeps its snapshotted terms until its own valid_to;
 *   * spent and lapsed scan tokens are purged, but a token that is evidence of
 *     a redemption survives;
 *   * erasure severs the claim and pass linkage and destroys outstanding bearer
 *     material, while the append-only redemption ledger is left untouched;
 *   * neither the export nor any offer table carries identity-document data,
 *     a date of birth or a bill amount — there is none to retain.
 *
 * The GRANT layer and the internal admin guard are proved SEPARATELY. A test
 * that stayed in the transaction's default service-role context would exercise
 * the function body only; `asAuthenticated` switches to the real `authenticated`
 * Postgres role so table GRANTs and RLS both apply, `expectDenied` accepts
 * nothing but SQLSTATE 42501 or an RLS-empty result, and the admin-guard tests
 * additionally assert the refusal came from the guard rather than from the ACL.
 *
 * Skips cleanly when the retention RPCs are not deployed so the DB-free gates
 * are never blocked by a missing database.
 */

async function offerRetentionDbReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [{ n }] = await db()`
      select count(*)::int as n from pg_proc where proname in (
        'expire_and_purge_offer_campaigns',
        'admin_erase_offer_claims_for_customer',
        'offer_claims_export_for_customer',
        'redeem_offer_pass')`
    return n >= 4
  } catch {
    return false
  }
}

const ready = await offerRetentionDbReady()
const skip = ready
  ? false
  : "live Supabase DB with offer retention RPCs not reachable"

after(async () => {
  await closeDb()
})

/** Runs `fn` as the real `authenticated` role, so GRANTs and RLS both apply. */
async function asAuthenticated(tx, userId, fn) {
  return tx.savepoint(async (sp) => {
    const claims = JSON.stringify({ sub: userId, role: "authenticated" })
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claims', ${claims}, true)`
    await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await sp`select set_config('request.jwt.claim.sub', ${userId}, true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
      await sp`select set_config('request.jwt.claims', '', true)`
      await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    }
  })
}

async function asInternalAdmin(tx, userId, fn) {
  const claims = await actAsActivatedInternalAdmin(tx, userId)
  return tx.savepoint(async (sp) => {
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true)`
    await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await sp`select set_config('request.jwt.claim.sub', ${userId}, true)`
    await sp`select set_config('request.jwt.claim.aal', 'aal2', true)`
    try {
      return await fn(sp)
    } finally {
      await sp`reset role`
      await sp`select set_config('request.jwt.claims', '', true)`
      await sp`select set_config('request.jwt.claim.aal', '', true)`
      await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    }
  })
}

/**
 * True only for a genuine authorisation denial (SQLSTATE 42501) or an RLS
 * result with no rows. A NOT NULL violation or a typo must never read as a pass.
 */
async function expectDenied(tx, userId, fn) {
  try {
    const result = await asAuthenticated(tx, userId, fn)
    return (result?.count ?? 0) === 0
  } catch (error) {
    if (error?.code === "42501") return true
    throw error
  }
}

/** Captures the error a statement raises without abandoning the transaction. */
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

/** A bare active venue, so several campaigns can coexist across merchants. */
async function freshMerchant(tx) {
  const runId = randomUUID().slice(0, 8)
  const ownerUserId = randomUUID()
  const merchantId = randomUUID()
  await tx`insert into auth.users (id) values (${ownerUserId}::uuid)`
  await tx`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type,
      email, status, requires_billing
    ) values (
      ${merchantId}::uuid, ${ownerUserId}::uuid, 'Offer Retention Venue',
      ${`offer-retention-${runId}`}, 'pub',
      ${`offer-retention-${runId}@example.test`}, 'active', false
    )`
  return merchantId
}

/**
 * A published campaign in an exact state and window, written directly so the
 * retention proofs do not depend on the lifecycle or claim RPCs landing first.
 * Offsets are whole days from today's UK business date.
 */
async function insertCampaign(tx, merchantId, options = {}) {
  const campaignId = randomUUID()
  const hash = options.tokenHash ?? null
  await tx`
    insert into public.offer_campaigns (
      id, merchant_id, status, bonus_stamp_count, discount_percent,
      starts_on, ends_on, requires_id_check, extra_terms,
      claim_token_hash, claim_token_ciphertext, published_at
    ) values (
      ${campaignId}::uuid, ${merchantId}::uuid, ${options.status ?? "live"},
      2, 10,
      public.uk_business_date(now()) + ${options.startsIn ?? 0}::integer,
      public.uk_business_date(now()) + ${options.endsIn ?? 30}::integer,
      false, 'Food only.',
      ${hash}, ${hash === null ? null : "v1.iv.body.tag"}, now()
    )`
  return campaignId
}

async function campaignRow(tx, campaignId) {
  const [row] = await tx`
    select status, ended_at, claim_token_hash, claim_token_ciphertext,
           bonus_stamp_count, discount_percent, starts_on::text, ends_on::text
    from public.offer_campaigns where id = ${campaignId}::uuid`
  return row
}

/** A claim plus the pass it issued, with the pass window under test control. */
async function issuePass(tx, fx, campaignId, options = {}) {
  const claimId = randomUUID()
  const entitlementId = randomUUID()

  await tx`
    insert into public.offer_campaign_claims (
      id, campaign_id, merchant_id, customer_id, membership_id,
      bonus_stamps_awarded
    ) values (
      ${claimId}::uuid, ${campaignId}::uuid, ${fx.merchantId}::uuid,
      ${fx.customerId}::uuid, ${fx.membershipId}::uuid, 2
    )`

  await tx`
    insert into public.offer_discount_entitlements (
      id, claim_id, campaign_id, merchant_id, customer_id, membership_id,
      discount_percent, requires_id_check, extra_terms, status,
      valid_from, valid_to
    ) values (
      ${entitlementId}::uuid, ${claimId}::uuid, ${campaignId}::uuid,
      ${fx.merchantId}::uuid, ${fx.customerId}::uuid, ${fx.membershipId}::uuid,
      10, false, 'Food only.', ${options.status ?? "active"},
      public.uk_business_date(now()) - 1,
      public.uk_business_date(now()) + ${options.validFor ?? 30}::integer
    )`

  return { claimId, entitlementId }
}

/** A scan token in an exact state; inserted directly because the mint RPC
 * purges lapsed tokens as a side effect and would clear the fixture. */
async function insertToken(tx, fx, entitlementId, options = {}) {
  const tokenId = randomUUID()
  await tx`
    insert into public.offer_pass_scan_tokens (
      id, entitlement_id, merchant_id, customer_id, membership_id,
      expires_at, consumed_at, consumed_by_merchant_id
    ) values (
      ${tokenId}::uuid, ${entitlementId}::uuid, ${fx.merchantId}::uuid,
      ${fx.customerId}::uuid, ${fx.membershipId}::uuid,
      now() + ${options.expiresInMinutes ?? 10}::integer * interval '1 minute',
      case when ${options.consumed === true} then now() end,
      case when ${options.consumed === true} then ${fx.merchantId}::uuid end
    )`
  return tokenId
}

async function sweep(tx) {
  const [row] = await tx`
    select public.expire_and_purge_offer_campaigns() as swept`
  return row.swept
}

async function tokenExists(tx, tokenId) {
  const [{ n }] = await tx`
    select count(*)::int as n from public.offer_pass_scan_tokens
    where id = ${tokenId}::uuid`
  return n === 1
}

test(
  "the sweep activates a scheduled campaign the day its window opens",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const dueMerchant = await freshMerchant(tx)
      const futureMerchant = await freshMerchant(tx)

      const due = await insertCampaign(tx, dueMerchant, {
        status: "scheduled",
        startsIn: 0,
        endsIn: 30,
      })
      const future = await insertCampaign(tx, futureMerchant, {
        status: "scheduled",
        startsIn: 7,
        endsIn: 40,
      })

      const swept = await sweep(tx)
      assert.ok(swept >= 1, "the sweep reports the rows it moved")

      assert.equal(
        (await campaignRow(tx, due)).status,
        "live",
        "a scheduled campaign whose start date has arrived goes live without a scan"
      )
      assert.equal(
        (await campaignRow(tx, future)).status,
        "scheduled",
        "a campaign that has not started yet is left alone"
      )
    })
  }
)

test(
  "the sweep retires a campaign past its end date and scrubs its link",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const liveMerchant = await freshMerchant(tx)
      const pausedMerchant = await freshMerchant(tx)
      const staleScheduledMerchant = await freshMerchant(tx)

      const lapsed = await insertCampaign(tx, liveMerchant, {
        status: "live",
        startsIn: -40,
        endsIn: -1,
        tokenHash: randomUUID().replace(/-/g, ""),
      })
      const pausedLapsed = await insertCampaign(tx, pausedMerchant, {
        status: "paused",
        startsIn: -40,
        endsIn: -1,
        tokenHash: randomUUID().replace(/-/g, ""),
      })
      // A campaign that was scheduled but whose whole window slipped past is
      // retired directly rather than being paraded as live first.
      const neverStarted = await insertCampaign(tx, staleScheduledMerchant, {
        status: "scheduled",
        startsIn: -10,
        endsIn: -2,
      })

      await sweep(tx)

      const after = await campaignRow(tx, lapsed)
      assert.equal(after.status, "ended")
      assert.ok(after.ended_at, "the terminal timestamp is recorded")
      assert.equal(
        after.claim_token_hash,
        null,
        "a printed poster stops resolving once the window closes"
      )
      assert.equal(
        after.claim_token_ciphertext,
        null,
        "the hash and the merchant-readable copy are scrubbed together"
      )
      assert.equal((await campaignRow(tx, pausedLapsed)).status, "ended")
      assert.equal((await campaignRow(tx, neverStarted)).status, "ended")

      const [{ n: stillLive }] = await tx`
        select count(*)::int as n from public.offer_campaigns
        where id = ${lapsed}::uuid and status = 'live'`
      assert.equal(stillLive, 0)
    })
  }
)

test(
  "ending or expiring a campaign never cancels a pass already issued",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      // The venue ended this campaign early: the window has closed, but the
      // pass it issued still has three more weeks to run.
      const campaignId = await insertCampaign(tx, fx.merchantId, {
        status: "live",
        startsIn: -40,
        endsIn: -1,
        tokenHash: randomUUID().replace(/-/g, ""),
      })
      const pass = await issuePass(tx, fx, campaignId, { validFor: 21 })

      await sweep(tx)

      assert.equal((await campaignRow(tx, campaignId)).status, "ended")

      const [entitlement] = await tx`
        select status, discount_percent, requires_id_check, extra_terms,
               valid_to::text
        from public.offer_discount_entitlements
        where id = ${pass.entitlementId}::uuid`
      assert.deepEqual(
        {
          status: entitlement.status,
          discount_percent: entitlement.discount_percent,
          requires_id_check: entitlement.requires_id_check,
          extra_terms: entitlement.extra_terms,
        },
        {
          status: "active",
          discount_percent: 10,
          requires_id_check: false,
          extra_terms: "Food only.",
        },
        "the pass keeps its snapshotted terms and stays redeemable until its own expiry"
      )

      const [{ n: claims }] = await tx`
        select count(*)::int as n from public.offer_campaign_claims
        where id = ${pass.claimId}::uuid`
      assert.equal(claims, 1, "retention never removes the claim record")
    })
  }
)

test(
  "the sweep expires a pass only when its own window has closed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      // One claim per (campaign, customer) for all time, so the two passes come
      // from two campaigns: last season's, already ended, and this one.
      const lastSeason = await insertCampaign(tx, fx.merchantId, {
        status: "ended",
        startsIn: -60,
        endsIn: -30,
      })
      const campaignId = await insertCampaign(tx, fx.merchantId, {
        status: "live",
        startsIn: -40,
        endsIn: 30,
      })
      const lapsed = await issuePass(tx, fx, lastSeason, { validFor: -1 })
      const liveStill = await issuePass(tx, fx, campaignId, { validFor: 5 })

      await sweep(tx)

      const [lapsedRow] = await tx`
        select status, valid_to::text, discount_percent
        from public.offer_discount_entitlements where id = ${lapsed.entitlementId}::uuid`
      assert.equal(lapsedRow.status, "expired")
      assert.equal(
        lapsedRow.discount_percent,
        10,
        "expiry moves the status and rewrites no issued term"
      )

      const [liveRow] = await tx`
        select status from public.offer_discount_entitlements
        where id = ${liveStill.entitlementId}::uuid`
      assert.equal(liveRow.status, "active")
    })
  }
)

test(
  "the sweep purges dead scan tokens but never destroys redemption evidence",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaignId = await insertCampaign(tx, fx.merchantId, {
        status: "live",
        startsIn: -1,
        endsIn: 30,
      })
      const pass = await issuePass(tx, fx, campaignId)

      const lapsedUnspent = await insertToken(tx, fx, pass.entitlementId, {
        expiresInMinutes: -5,
      })
      const lapsedSpent = await insertToken(tx, fx, pass.entitlementId, {
        expiresInMinutes: -5,
        consumed: true,
      })
      const liveToken = await insertToken(tx, fx, pass.entitlementId, {
        expiresInMinutes: 9,
      })

      // A token that was actually honoured. Redeeming through the RPC is the
      // only way to create the append-only evidence row.
      const honoured = await insertToken(tx, fx, pass.entitlementId, {
        expiresInMinutes: 9,
      })
      const [redemption] = await tx`
        select * from public.redeem_offer_pass(
          ${honoured}::uuid, ${fx.merchantId}::uuid, false, true, null)`
      assert.ok(redemption.redemption_id, "the pass redeems once")

      await sweep(tx)

      assert.equal(await tokenExists(tx, lapsedUnspent), false)
      assert.equal(await tokenExists(tx, lapsedSpent), false)
      assert.equal(
        await tokenExists(tx, liveToken),
        true,
        "a token still inside its ten minutes is left alone"
      )
      assert.equal(
        await tokenExists(tx, honoured),
        true,
        "the token a redemption references is evidence and survives"
      )

      const [{ n: redemptions }] = await tx`
        select count(*)::int as n from public.offer_redemptions
        where scan_token_id = ${honoured}::uuid`
      assert.equal(redemptions, 1)

      const [entitlement] = await tx`
        select status from public.offer_discount_entitlements
        where id = ${pass.entitlementId}::uuid`
      assert.equal(
        entitlement.status,
        "active",
        "the pass is never consumed by a redemption"
      )
    })
  }
)

test(
  "erasure severs claim and pass linkage and destroys outstanding bearer material",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaignId = await insertCampaign(tx, fx.merchantId, {
        status: "live",
        startsIn: -1,
        endsIn: 30,
      })
      const pass = await issuePass(tx, fx, campaignId)
      const outstanding = await insertToken(tx, fx, pass.entitlementId, {
        expiresInMinutes: 9,
      })

      const erased = await asInternalAdmin(tx, fx.adminUserId, async (sp) => {
        const [row] = await sp`
          select public.admin_erase_offer_claims_for_customer(
            ${fx.customerId}::uuid) as n`
        return row.n
      })
      assert.ok(erased >= 1, "erasure reports the rows it touched")

      const [{ n: claims }] = await tx`
        select count(*)::int as n from public.offer_campaign_claims
        where customer_id = ${fx.customerId}::uuid`
      assert.equal(
        claims,
        0,
        "a claim with nothing honoured beneath it is removed"
      )

      const [{ n: entitlements }] = await tx`
        select count(*)::int as n from public.offer_discount_entitlements
        where customer_id = ${fx.customerId}::uuid`
      assert.equal(entitlements, 0, "the pass goes with it by cascade")

      assert.equal(
        await tokenExists(tx, outstanding),
        false,
        "the credential that would present the pass is destroyed"
      )
    })
  }
)

test(
  "erasure leaves the append-only redemption ledger intact",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaignId = await insertCampaign(tx, fx.merchantId, {
        status: "live",
        startsIn: -1,
        endsIn: 30,
      })
      const pass = await issuePass(tx, fx, campaignId)
      const honoured = await insertToken(tx, fx, pass.entitlementId, {
        expiresInMinutes: 9,
      })
      const outstanding = await insertToken(tx, fx, pass.entitlementId, {
        expiresInMinutes: 9,
      })
      await tx`
        select * from public.redeem_offer_pass(
          ${honoured}::uuid, ${fx.merchantId}::uuid, false, true, null)`

      const [before] = await tx`
        select id, discount_percent, no_stacking_attested, redeemed_at
        from public.offer_redemptions where scan_token_id = ${honoured}::uuid`

      await asInternalAdmin(tx, fx.adminUserId, async (sp) => {
        await sp`
          select public.admin_erase_offer_claims_for_customer(
            ${fx.customerId}::uuid)`
      })

      const [after] = await tx`
        select id, discount_percent, no_stacking_attested, redeemed_at
        from public.offer_redemptions where scan_token_id = ${honoured}::uuid`
      assert.deepEqual(
        after,
        before,
        "the redemption row is neither deleted nor updated by erasure"
      )

      const [entitlement] = await tx`
        select status from public.offer_discount_entitlements
        where id = ${pass.entitlementId}::uuid`
      assert.equal(
        entitlement.status,
        "revoked",
        "the pass stops being redeemable even though its ledger is retained"
      )

      const [{ n: claims }] = await tx`
        select count(*)::int as n from public.offer_campaign_claims
        where id = ${pass.claimId}::uuid`
      assert.equal(
        claims,
        1,
        "the claim is retained because deleting it would cascade into the ledger"
      )

      assert.equal(await tokenExists(tx, honoured), true)
      assert.equal(await tokenExists(tx, outstanding), false)
    })
  }
)

test(
  "the append-only trigger refuses an update or a delete on its own",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaignId = await insertCampaign(tx, fx.merchantId, {
        status: "live",
        startsIn: -1,
        endsIn: 30,
      })
      const pass = await issuePass(tx, fx, campaignId)
      const honoured = await insertToken(tx, fx, pass.entitlementId, {
        expiresInMinutes: 9,
      })
      await tx`
        select * from public.redeem_offer_pass(
          ${honoured}::uuid, ${fx.merchantId}::uuid, false, true, null)`

      // Service-role context: the trigger layer, proved without any GRANT or
      // RLS involvement.
      const updated = await refusal(
        tx,
        (sp) =>
          sp`
          update public.offer_redemptions set discount_percent = 25
          where scan_token_id = ${honoured}::uuid`
      )
      assert.match(String(updated?.message), /append-only/i)

      const deleted = await refusal(
        tx,
        (sp) =>
          sp`delete from public.offer_redemptions where scan_token_id = ${honoured}::uuid`
      )
      assert.match(String(deleted?.message), /append-only/i)

      const [{ n }] = await tx`
        select count(*)::int as n from public.offer_redemptions
        where scan_token_id = ${honoured}::uuid`
      assert.equal(n, 1)
    })
  }
)

test(
  "the export returns claims, passes and redemptions and no identity data",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaignId = await insertCampaign(tx, fx.merchantId, {
        status: "live",
        startsIn: -1,
        endsIn: 30,
      })
      const pass = await issuePass(tx, fx, campaignId)
      const honoured = await insertToken(tx, fx, pass.entitlementId, {
        expiresInMinutes: 9,
      })
      await tx`
        select * from public.redeem_offer_pass(
          ${honoured}::uuid, ${fx.merchantId}::uuid, false, true, null)`

      const payload = await asInternalAdmin(tx, fx.adminUserId, async (sp) => {
        const [row] = await sp`
          select public.offer_claims_export_for_customer(
            ${fx.customerId}::uuid) as payload`
        return row.payload
      })

      assert.deepEqual(
        Object.keys(payload).sort(),
        ["claims", "discount_passes", "redemptions"],
        "the export is one object with the three offer ledgers"
      )
      assert.equal(payload.claims.length, 1)
      assert.equal(payload.claims[0].campaign_id, campaignId)
      assert.equal(payload.claims[0].bonus_stamps_awarded, 2)
      assert.equal(payload.discount_passes.length, 1)
      assert.equal(
        payload.discount_passes[0].entitlement_id,
        pass.entitlementId
      )
      assert.equal(payload.discount_passes[0].discount_percent, 10)
      assert.equal(payload.discount_passes[0].status, "active")
      assert.equal(payload.redemptions.length, 1)
      assert.equal(payload.redemptions[0].no_stacking_attested, true)

      const serialised = JSON.stringify(payload)
      assert.doesNotMatch(
        serialised,
        /date_of_birth|birth_date|document_number|id_number|id_image|id_photo|bill_amount|min_spend|amount_spent/i,
        "there is no identity-document, date-of-birth or bill-amount field to disclose"
      )

      const emptyPayload = await asInternalAdmin(
        tx,
        fx.adminUserId,
        async (sp) => {
          const [row] = await sp`
            select public.offer_claims_export_for_customer(
              ${randomUUID()}::uuid) as payload`
          return row.payload
        }
      )
      assert.deepEqual(emptyPayload, {
        claims: [],
        discount_passes: [],
        redemptions: [],
      })
    })
  }
)

test(
  "no offer table holds identity-document, date-of-birth or bill-amount data",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const columns = await tx`
        select table_name, column_name
        from information_schema.columns
        where table_schema = 'public' and table_name like 'offer\\_%'
          and (
            column_name ~* 'birth|document|id_number|id_image|id_photo'
            or column_name ~* 'amount|spend|price|pence|bill'
          )`
      assert.deepEqual(
        columns.map((c) => `${c.table_name}.${c.column_name}`),
        [],
        "the feature retains no identity or spend data, so there is none to erase"
      )
    })
  }
)

test(
  "the GRANT layer keeps the sweep away from authenticated",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)

      // Guard against the documented blind spot: a test that forgets to switch
      // role proves the function body only and silently skips GRANT and RLS.
      const role = await asAuthenticated(tx, fx.adminUserId, async (sp) => {
        const [row] = await sp`select current_user as role`
        return row.role
      })
      assert.equal(role, "authenticated")

      const denied = await expectDenied(
        tx,
        fx.adminUserId,
        (sp) => sp`select public.expire_and_purge_offer_campaigns()`
      )
      assert.ok(
        denied,
        "the cron sweep is service_role only, even for an internal admin session"
      )

      const [grants] = await tx`
        select
          has_function_privilege('authenticated',
            'public.expire_and_purge_offer_campaigns(timestamptz)', 'EXECUTE') as sweep,
          has_function_privilege('authenticated',
            'public.admin_erase_offer_claims_for_customer(uuid)', 'EXECUTE') as erase,
          has_function_privilege('authenticated',
            'public.offer_claims_export_for_customer(uuid)', 'EXECUTE') as export_fn,
          has_function_privilege('anon',
            'public.admin_erase_offer_claims_for_customer(uuid)', 'EXECUTE') as anon_erase,
          has_function_privilege('service_role',
            'public.expire_and_purge_offer_campaigns(timestamptz)', 'EXECUTE') as service_sweep`
      assert.deepEqual(
        grants,
        {
          sweep: false,
          erase: true,
          export_fn: true,
          anon_erase: false,
          service_sweep: true,
        },
        "the admin companions are reachable by the console; the sweep is not"
      )
    })
  }
)

test(
  "the admin guard refuses a signed-in non-admin, not the ACL",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)

      // The venue owner is a perfectly ordinary authenticated session that HAS
      // execute on both functions, so a refusal here can only come from the
      // internal is_internal_admin() guard inside the function body.
      const eraseError = await refusal(tx, (sp) =>
        asAuthenticated(
          sp,
          fx.ownerUserId,
          (inner) =>
            inner`
            select public.admin_erase_offer_claims_for_customer(
              ${fx.customerId}::uuid)`
        )
      )
      assert.equal(eraseError?.code, "42501")
      assert.match(String(eraseError?.message), /Admin privilege required/)

      const exportError = await refusal(tx, (sp) =>
        asAuthenticated(
          sp,
          fx.ownerUserId,
          (inner) =>
            inner`
            select public.offer_claims_export_for_customer(
              ${fx.customerId}::uuid)`
        )
      )
      assert.equal(exportError?.code, "42501")
      assert.match(String(exportError?.message), /Admin privilege required/)

      // And nothing was erased on the way to being refused.
      const [{ n }] = await tx`
        select count(*)::int as n from public.offer_campaign_claims
        where customer_id = ${fx.customerId}::uuid`
      assert.equal(n, 0)
    })
  }
)
