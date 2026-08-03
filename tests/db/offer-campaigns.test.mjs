import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import postgres from "postgres"

import {
  cleanupRewardPoolFixture,
  createRewardPoolFixture,
} from "./helpers/reward-pool-fixture.mjs"
import {
  closeDb,
  db,
  dbUrl,
  inRolledBackTxn,
  isLiveDbReady,
} from "./helpers/db.mjs"

/**
 * DB integration tier for Merchant Offers and Campaign QR — the customer claim
 * journey.
 *
 * These prove what mocks cannot: that one scan of a printed poster produces
 * exactly one atomic claim; that a re-scan, a concurrent double tap, an
 * existing member and a rotated link all award nothing; that the bonus stamps
 * leave the customer's earned business day free; that issued pass terms survive
 * the campaign ending; and — the highest-consequence coupling in the feature —
 * that a promotional offer stamp can never settle a referral bonus.
 *
 * The GRANT layer and the trigger/ledger layer are proved SEPARATELY. A test
 * that stays in the transaction's default service-role context exercises the
 * function body only; `asAuthenticated` switches to the real `authenticated`
 * Postgres role so table GRANTs and RLS both apply, and `expectDenied` accepts
 * nothing but SQLSTATE 42501 or an RLS-empty result.
 *
 * Skips cleanly when the offer RPCs are not deployed, so the DB-free gates are
 * never blocked by a missing database.
 */

const LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost"])
const localDbUrl = resolveLocalDbUrl()

async function offerCampaignsDbReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [{ n }] = await db()`
      select count(*)::int as n from pg_proc where proname in (
        'create_offer_campaign_draft', 'publish_offer_campaign',
        'rotate_offer_campaign_token', 'get_offer_claim_context',
        'claim_offer_campaign')`
    return n >= 5
  } catch {
    return false
  }
}

const ready = await offerCampaignsDbReady()
const skip = ready
  ? false
  : "live Supabase DB with offer campaign RPCs not reachable"
const concurrencySkip = skip
  ? skip
  : localDbUrl
    ? false
    : "concurrent claim proof requires local Supabase Postgres"

const POLICY = "2026-08-01"

after(async () => {
  await closeDb()
})

function hex64() {
  return (randomUUID() + randomUUID()).replace(/-/g, "")
}

async function today(tx) {
  const [row] = await tx`select public.uk_business_date(now())::text as d`
  return row.d
}

function shiftDate(iso, days) {
  const stamp = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000
  return new Date(stamp).toISOString().slice(0, 10)
}

async function enableOffers(tx, merchantId) {
  await tx`
    update public.merchants set offer_campaigns_enabled = true
    where id = ${merchantId}::uuid`
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

/**
 * Draft, install the link and publish in one go — the merchant desk's whole
 * lifecycle up to the point a poster could be printed. Returns the campaign id,
 * the hash a scan presents, and the status publish settled on.
 */
async function publishCampaign(tx, merchantId, options = {}) {
  const startsOn = options.startsOn ?? (await today(tx))
  const endsOn = options.endsOn ?? shiftDate(await today(tx), 30)
  const claimHash = options.claimHash ?? hex64()

  const [draft] = await tx`
    select * from public.create_offer_campaign_draft(
      ${merchantId}::uuid, null,
      ${options.bonusStampCount ?? null}::integer,
      ${options.discountPercent ?? null}::integer,
      ${startsOn}::date, ${endsOn}::date,
      ${options.requiresIdCheck ?? false},
      ${options.extraTerms ?? null},
      null, null,
      ${options.name ?? null}::text,
      ${options.customerDescription ?? null}::text)`

  await tx`
    select public.rotate_offer_campaign_token(
      ${merchantId}::uuid, ${draft.campaign_id}::uuid,
      ${claimHash}, ${"v1.iv.body.tag"}, null)`

  const [published] = await tx`
    select public.publish_offer_campaign(
      ${merchantId}::uuid, ${draft.campaign_id}::uuid, null) as status`

  return {
    campaignId: draft.campaign_id,
    claimHash,
    status: published.status,
    startsOn,
    endsOn,
  }
}

function claim(tx, customerId, claimHash, marketingOptIn = false) {
  return tx`
    select * from public.claim_offer_campaign(
      ${customerId}::uuid, ${claimHash}, ${POLICY}, ${marketingOptIn})`
}

/**
 * Move a published campaign's window without tripping the post-publish terms
 * lock. Simulating the passage of time is the one legitimate reason to step
 * around that trigger; the trigger is re-enabled immediately, and every test
 * that does this runs inside a rolled-back transaction.
 */
async function timeTravelWindow(tx, campaignId, startsOn, endsOn) {
  await tx`alter table public.offer_campaigns disable trigger offer_campaigns_terms_locked`
  await tx`
    update public.offer_campaigns
    set starts_on = ${startsOn}::date, ends_on = ${endsOn}::date
    where id = ${campaignId}::uuid`
  await tx`alter table public.offer_campaigns enable trigger offer_campaigns_terms_locked`
}

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

/**
 * The error a statement raised, or null when it succeeded. Wrapped in a
 * savepoint so the surrounding transaction survives to make the next assertion.
 */
async function refusal(tx, fn) {
  try {
    await tx.savepoint((sp) => fn(sp))
    return null
  } catch (error) {
    return error
  }
}

/** What a customer's link resolves to, as the landing page reads it. */
async function claimContext(tx, claimHash) {
  const [row] = await tx`
    select * from public.get_offer_claim_context(${claimHash})`
  return row
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

test(
  "one scan claims atomically: membership, bonus stamps and the pass",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const customerId = await freshPhoneCustomer(tx)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 2,
        discountPercent: 10,
        requiresIdCheck: true,
        extraTerms: "Food only.",
      })
      assert.equal(campaign.status, "live")

      const [res] = await claim(tx, customerId, campaign.claimHash)
      assert.equal(res.status, "claimed")
      assert.equal(res.stamps_awarded, 2)
      assert.ok(res.membership_id)
      assert.ok(res.entitlement_id)

      const stamps = await tx`
        select metadata->>'source' as source, earned_business_date, stamps_delta
        from public.stamp_events where membership_id = ${res.membership_id}::uuid`
      assert.equal(stamps.length, 2, "exactly one row per bonus stamp")
      assert.ok(stamps.every((s) => s.source === "offer_campaign"))
      assert.ok(
        stamps.every((s) => s.earned_business_date === null),
        "a NULL business date leaves the venue QR free to add a visit stamp today"
      )

      const [m] = await tx`
        select current_stamp_count, total_stamps_earned
        from public.customer_memberships where id = ${res.membership_id}::uuid`
      assert.equal(m.current_stamp_count, 2)
      assert.equal(m.total_stamps_earned, 2)

      const [c] = await tx`
        select id, campaign_id, merchant_id, bonus_stamps_awarded
        from public.offer_campaign_claims where membership_id = ${res.membership_id}::uuid`
      assert.equal(c.campaign_id, campaign.campaignId)
      assert.equal(c.merchant_id, fx.merchantId)
      assert.equal(c.bonus_stamps_awarded, 2)

      const [e] = await tx`
        select discount_percent, requires_id_check, extra_terms, status, valid_to::text
        from public.offer_discount_entitlements where id = ${res.entitlement_id}::uuid`
      assert.deepEqual(
        {
          discount_percent: e.discount_percent,
          requires_id_check: e.requires_id_check,
          extra_terms: e.extra_terms,
          status: e.status,
          valid_to: e.valid_to,
        },
        {
          discount_percent: 10,
          requires_id_check: true,
          extra_terms: "Food only.",
          status: "active",
          valid_to: campaign.endsOn,
        },
        "the pass carries a snapshot of the campaign's terms"
      )

      const [{ n: events }] = await tx`
        select count(*)::int as n from public.product_events
        where event_name = 'offer_campaign_claimed'
          and membership_id = ${res.membership_id}::uuid`
      assert.equal(events, 1)
      const [{ n: audits }] = await tx`
        select count(*)::int as n from public.audit_logs
        where action = 'offer_campaign_claimed'
          and target_table = 'offer_campaign_claims'
          and target_id = ${c.id}::uuid`
      assert.equal(audits, 1)
    })
  }
)

test(
  "the bonus grant leaves the customer's earned business day free",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const customerId = await freshPhoneCustomer(tx)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 2,
      })

      const [res] = await claim(tx, customerId, campaign.claimHash)
      assert.equal(res.status, "claimed")

      // A real visit stamp for today must still be insertable: the one-per-UK-day
      // unique index only covers rows with a non-null business date.
      await tx`
        insert into public.stamp_events (
          merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
          event_type, stamps_delta, earned_business_date, cycle_number, metadata)
        values (
          ${fx.merchantId}::uuid, ${customerId}::uuid, ${res.membership_id}::uuid,
          ${fx.cardId}::uuid, ${fx.locationId}::uuid,
          'earned', 1, public.uk_business_date(now()), 1, '{}'::jsonb)`

      const [{ n }] = await tx`
        select count(*)::int as n from public.stamp_events
        where membership_id = ${res.membership_id}::uuid`
      assert.equal(n, 3, "two bonus stamps plus today's visit stamp")
    })
  }
)

test(
  "a re-scan awards nothing and hands back the existing card and pass",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const customerId = await freshPhoneCustomer(tx)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 1,
        discountPercent: 15,
      })

      const [first] = await claim(tx, customerId, campaign.claimHash)
      assert.equal(first.status, "claimed")

      const [second] = await claim(tx, customerId, campaign.claimHash)
      assert.equal(second.status, "already_claimed")
      assert.equal(second.stamps_awarded, 0)
      assert.equal(second.membership_id, first.membership_id)
      assert.equal(
        second.entitlement_id,
        first.entitlement_id,
        "the re-scan opens the pass they already hold"
      )

      const [{ n: stamps }] = await tx`
        select count(*)::int as n from public.stamp_events
        where membership_id = ${first.membership_id}::uuid`
      assert.equal(stamps, 1, "no second award")
      const [{ n: claims }] = await tx`
        select count(*)::int as n from public.offer_campaign_claims
        where campaign_id = ${campaign.campaignId}::uuid`
      assert.equal(claims, 1)
      const [{ n: passes }] = await tx`
        select count(*)::int as n from public.offer_discount_entitlements
        where campaign_id = ${campaign.campaignId}::uuid`
      assert.equal(passes, 1)
    })
  }
)

test(
  "the claim ledger refuses a second row for the same campaign and customer",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const customerId = await freshPhoneCustomer(tx)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 1,
      })
      const [res] = await claim(tx, customerId, campaign.claimHash)
      assert.equal(res.status, "claimed")

      let code = null
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            insert into public.offer_campaign_claims (
              campaign_id, merchant_id, customer_id, membership_id)
            values (
              ${campaign.campaignId}::uuid, ${fx.merchantId}::uuid,
              ${customerId}::uuid, ${res.membership_id}::uuid)`
        })
      } catch (error) {
        code = error?.code ?? null
      }
      assert.equal(
        code,
        "23505",
        "offer_campaign_claims_once is the ledger backstop"
      )
    })
  }
)

test(
  "an existing member is refused, and nothing at all is written",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      // fx.customerId is already a member of fx.merchantId. Give them a verified
      // phone so the claim reaches the membership check rather than the identity
      // guard.
      await tx`
        update public.customers
        set phone_hmac = ${hex64()}, phone_verified_at = now()
        where id = ${fx.customerId}::uuid`
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 2,
        discountPercent: 20,
      })

      const [res] = await claim(tx, fx.customerId, campaign.claimHash)
      assert.equal(res.status, "already_member")
      assert.equal(res.stamps_awarded, 0)
      assert.equal(res.entitlement_id, null)
      assert.equal(res.membership_id, fx.membershipId)

      const [{ n: claims }] = await tx`
        select count(*)::int as n from public.offer_campaign_claims
        where campaign_id = ${campaign.campaignId}::uuid`
      assert.equal(claims, 0)
      const [{ n: stamps }] = await tx`
        select count(*)::int as n from public.stamp_events
        where membership_id = ${fx.membershipId}::uuid`
      assert.equal(stamps, 0, "an existing member's card is untouched")
    })
  }
)

test(
  "not started, paused and expired are three different answers",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const now = await today(tx)

      const scheduled = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 1,
        startsOn: shiftDate(now, 3),
        endsOn: shiftDate(now, 30),
      })
      assert.equal(scheduled.status, "scheduled")

      const beforeStart = await freshPhoneCustomer(tx)
      const [notStarted] = await claim(tx, beforeStart, scheduled.claimHash)
      assert.equal(notStarted.status, "not_started")
      assert.equal(notStarted.stamps_awarded, 0)

      // The start date arrives: the claim promotes the campaign itself, under
      // the same lock, so activation does not depend on a sweep having run.
      await timeTravelWindow(tx, scheduled.campaignId, now, shiftDate(now, 30))
      const onOpening = await freshPhoneCustomer(tx)
      const [claimed] = await claim(tx, onOpening, scheduled.claimHash)
      assert.equal(claimed.status, "claimed")
      const [promoted] = await tx`
        select status from public.offer_campaigns where id = ${scheduled.campaignId}::uuid`
      assert.equal(promoted.status, "live")

      await tx`
        select public.pause_offer_campaign(
          ${fx.merchantId}::uuid, ${scheduled.campaignId}::uuid, null)`
      const whilePaused = await freshPhoneCustomer(tx)
      const [paused] = await claim(tx, whilePaused, scheduled.claimHash)
      assert.equal(paused.status, "paused")

      await timeTravelWindow(
        tx,
        scheduled.campaignId,
        shiftDate(now, -20),
        shiftDate(now, -1)
      )
      const afterEnd = await freshPhoneCustomer(tx)
      const [expired] = await claim(tx, afterEnd, scheduled.claimHash)
      assert.equal(
        expired.status,
        "expired",
        "past the end date is never reported as not started"
      )
    })
  }
)

test(
  "rotating the link stops the printed poster working",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 1,
      })

      const replacement = hex64()
      const [rotated] = await tx`
      select public.rotate_offer_campaign_token(
        ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid,
        ${replacement}, ${"v1.iv.body.tag"}, null) as generation`
      assert.equal(rotated.generation, 2)

      const stale = await freshPhoneCustomer(tx)
      const [old] = await claim(tx, stale, campaign.claimHash)
      assert.equal(old.status, "invalid")
      assert.equal(old.stamps_awarded, 0)

      const fresh = await freshPhoneCustomer(tx)
      const [next] = await claim(tx, fresh, replacement)
      assert.equal(next.status, "claimed")
    })
  }
)

test(
  "an ended campaign's link stops working immediately",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 1,
      })
      await tx`
      select public.end_offer_campaign(
        ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid, null)`

      const customerId = await freshPhoneCustomer(tx)
      const [res] = await claim(tx, customerId, campaign.claimHash)
      assert.equal(res.status, "invalid")
      assert.equal(res.stamps_awarded, 0)
    })
  }
)

test(
  "a venue removed from the allowlist stops issuing benefits",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 1,
      })
      await tx`
        update public.merchants set offer_campaigns_enabled = false
        where id = ${fx.merchantId}::uuid`

      const customerId = await freshPhoneCustomer(tx)
      const [res] = await claim(tx, customerId, campaign.claimHash)
      assert.equal(res.status, "unavailable")
      assert.equal(res.stamps_awarded, 0)
    })
  }
)

test(
  "the card-length rule is re-checked at claim time, not just at draft time",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      // Legal at draft time against a three-stamp card.
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 2,
      })
      // The venue then shortens its card underneath the printed poster.
      await tx`
        update public.loyalty_cards set stamps_required = 2
        where id = ${fx.cardId}::uuid`

      const customerId = await freshPhoneCustomer(tx)
      const [res] = await claim(tx, customerId, campaign.claimHash)
      assert.equal(res.status, "card_too_short")
      assert.equal(res.stamps_awarded, 0)
      const [{ n }] = await tx`
        select count(*)::int as n from public.offer_campaign_claims
        where campaign_id = ${campaign.campaignId}::uuid`
      assert.equal(n, 0, "no membership and no claim on a refusal")
    })
  }
)

test("only one non-terminal campaign per venue", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const fx = await createRewardPoolFixture(tx)
    await enableOffers(tx, fx.merchantId)
    await publishCampaign(tx, fx.merchantId, { bonusStampCount: 1 })

    await assert.rejects(
      () => publishCampaign(tx, fx.merchantId, { bonusStampCount: 1 }),
      /already has an offer running/
    )
  })
})

test(
  "an issued pass survives the campaign ending, with its terms intact",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const customerId = await freshPhoneCustomer(tx)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        discountPercent: 25,
        requiresIdCheck: true,
        extraTerms: "Not with any other offer.",
      })
      const [res] = await claim(tx, customerId, campaign.claimHash)
      assert.equal(res.status, "claimed")
      assert.equal(
        res.stamps_awarded,
        0,
        "a discount-only offer grants no stamps"
      )

      await tx`
        select public.end_offer_campaign(
          ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid, null)`

      const [e] = await tx`
        select discount_percent, requires_id_check, extra_terms, status, valid_to::text
        from public.offer_discount_entitlements where id = ${res.entitlement_id}::uuid`
      assert.deepEqual(
        {
          discount_percent: e.discount_percent,
          requires_id_check: e.requires_id_check,
          extra_terms: e.extra_terms,
          status: e.status,
          valid_to: e.valid_to,
        },
        {
          discount_percent: 25,
          requires_id_check: true,
          extra_terms: "Not with any other offer.",
          status: "active",
          valid_to: campaign.endsOn,
        }
      )
    })
  }
)

test(
  "published campaign terms cannot be rewritten underneath a poster",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        discountPercent: 10,
      })

      let code = null
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            update public.offer_campaigns set discount_percent = 25
            where id = ${campaign.campaignId}::uuid`
        })
      } catch (error) {
        code = error?.code ?? null
      }
      assert.equal(
        code,
        "42501",
        "the database refuses the edit, not just the UI"
      )
    })
  }
)

test(
  "an offer bonus stamp never settles a referral bonus",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const referredId = await freshPhoneCustomer(tx)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 2,
      })

      const [res] = await claim(tx, referredId, campaign.claimHash)
      assert.equal(res.status, "claimed")
      assert.equal(res.stamps_awarded, 2)

      // fx.customerId already holds a membership at this venue: make them the
      // referrer of the customer who just joined through the offer.
      const [edge] = await tx`
        insert into public.referrals (
          referred_membership_id, referrer_membership_id, referral_code_used,
          venue_id, referrer_customer_id, referred_customer_id, status)
        values (
          ${res.membership_id}::uuid, ${fx.membershipId}::uuid, ${"OFFERTEST"},
          ${fx.merchantId}::uuid, ${fx.customerId}::uuid, ${referredId}::uuid,
          'attributed')
        returning id`

      await tx`select public.qualify_referral_on_stamp(${res.membership_id}::uuid, null)`

      const [afterOfferStamps] = await tx`
        select status from public.referrals where id = ${edge.id}::uuid`
      assert.equal(
        afterOfferStamps.status,
        "attributed",
        "promotional offer stamps are not a qualifying visit"
      )

      // A genuine visit stamp does qualify it, proving the exclusion is scoped
      // to the offer source rather than switching qualification off.
      const [visit] = await tx`
        insert into public.stamp_events (
          merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
          event_type, stamps_delta, earned_business_date, cycle_number, metadata)
        values (
          ${fx.merchantId}::uuid, ${referredId}::uuid, ${res.membership_id}::uuid,
          ${fx.cardId}::uuid, ${fx.locationId}::uuid,
          'earned', 1, public.uk_business_date(now()), 1, '{}'::jsonb)
        returning id`

      await tx`
        select public.qualify_referral_on_stamp(
          ${res.membership_id}::uuid, ${visit.id}::uuid)`

      const [afterVisit] = await tx`
        select status, qualifying_stamp_id from public.referrals where id = ${edge.id}::uuid`
      assert.equal(afterVisit.status, "qualified")
      assert.equal(afterVisit.qualifying_stamp_id, visit.id)
    })
  }
)

test(
  "the claim RPC and the offer ledgers are closed to the authenticated role",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const customerId = await freshPhoneCustomer(tx)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        bonusStampCount: 1,
        discountPercent: 10,
      })
      const [res] = await claim(tx, customerId, campaign.claimHash)
      assert.equal(res.status, "claimed")

      assert.ok(
        await expectDenied(
          tx,
          fx.ownerUserId,
          (sp) => sp`
            select * from public.claim_offer_campaign(
              ${customerId}::uuid, ${campaign.claimHash}, ${POLICY}, false)`
        ),
        "a signed-in session cannot award itself an offer"
      )
      assert.ok(
        await expectDenied(
          tx,
          fx.ownerUserId,
          (sp) => sp`
            insert into public.offer_campaign_claims (
              campaign_id, merchant_id, customer_id, membership_id)
            values (
              ${campaign.campaignId}::uuid, ${fx.merchantId}::uuid,
              ${customerId}::uuid, ${res.membership_id}::uuid)`
        ),
        "claims are written by the RPC alone"
      )
      assert.ok(
        await expectDenied(
          tx,
          fx.ownerUserId,
          (sp) => sp`
            update public.offer_discount_entitlements set discount_percent = 25
            where id = ${res.entitlement_id}::uuid`
        ),
        "an issued pass cannot be edited from a session"
      )
    })
  }
)

test("offer records are invisible to another tenant", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const host = await createRewardPoolFixture(tx)
    const stranger = await createRewardPoolFixture(tx)
    await enableOffers(tx, host.merchantId)
    const customerId = await freshPhoneCustomer(tx)
    const campaign = await publishCampaign(tx, host.merchantId, {
      bonusStampCount: 1,
      discountPercent: 10,
    })
    const [res] = await claim(tx, customerId, campaign.claimHash)
    assert.equal(res.status, "claimed")

    const visible = await asAuthenticated(
      tx,
      stranger.ownerUserId,
      (sp) => sp`
      select
        (select count(*)::int from public.offer_campaigns
         where merchant_id = ${host.merchantId}::uuid) as campaigns,
        (select count(*)::int from public.offer_campaign_claims
         where merchant_id = ${host.merchantId}::uuid) as claims,
        (select count(*)::int from public.offer_discount_entitlements
         where merchant_id = ${host.merchantId}::uuid) as passes`
    )

    assert.deepEqual(
      { ...visible[0] },
      { campaigns: 0, claims: 0, passes: 0 },
      "another venue's owner reads none of it"
    )

    const owner = await asAuthenticated(
      tx,
      host.ownerUserId,
      (sp) => sp`
      select count(*)::int as n from public.offer_campaigns
      where merchant_id = ${host.merchantId}::uuid`
    )
    assert.equal(owner[0].n, 1, "the owning venue still reads its own campaign")
  })
})

// ─── Campaign name and customer description ──────────────────────────────────
// Merchant-authored free text shown to customers. Three separate layers hold it
// up and each is proved on its own below: the column CHECKs, the RPC that
// writes it, and the reader that decides when a customer is allowed to see it.

test(
  "the database bounds the campaign copy, not only the creator form",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        discountPercent: 10,
        name: "  Old Crown welcome  ",
        customerDescription: "  10% off while you are a new member.  ",
      })

      const [stored] = await tx`
        select name, customer_description from public.offer_campaigns
        where id = ${campaign.campaignId}::uuid`
      assert.deepEqual(
        { ...stored },
        {
          name: "Old Crown welcome",
          customer_description: "10% off while you are a new member.",
        },
        "both are stored trimmed"
      )

      // enforce_offer_campaign_terms_locked covers the benefit and the dates,
      // never these two columns, so a direct update reaches the CHECK itself
      // rather than being turned away by the trigger first.
      const bounds = [
        ["name", "offer_campaigns_name_length", 60],
        [
          "customer_description",
          "offer_campaigns_customer_description_length",
          160,
        ],
      ]

      for (const [column, constraintName, maxLength] of bounds) {
        const denied = await refusal(
          tx,
          (sp) => sp`
            update public.offer_campaigns
            set ${sp(column)} = ${"x".repeat(maxLength + 1)}
            where id = ${campaign.campaignId}::uuid`
        )
        assert.equal(
          denied?.code,
          "23514",
          `${column} over its bound is a CHECK violation`
        )
        assert.equal(
          denied?.constraint_name,
          constraintName,
          `${column} is refused by its own named constraint`
        )

        // The bound is a length limit rather than a blanket refusal: exactly
        // the maximum is accepted.
        const allowed = await refusal(
          tx,
          (sp) => sp`
            update public.offer_campaigns
            set ${sp(column)} = ${"x".repeat(maxLength)}
            where id = ${campaign.campaignId}::uuid`
        )
        assert.equal(allowed, null, `${column} accepts exactly ${maxLength}`)
      }
    })
  }
)

test(
  "create_offer_campaign_draft carries the campaign copy, in one signature",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)

      // A 10-argument overload left behind would make every existing call
      // ambiguous, so the widening had to be a drop-and-create.
      const overloads = await tx`
        select pronargs::int as nargs from pg_proc
        where proname = 'create_offer_campaign_draft'
          and pronamespace = 'public'::regnamespace`
      assert.deepEqual(
        overloads.map((row) => row.nargs),
        [12],
        "exactly one signature, taking the two identity arguments"
      )

      const startsOn = await today(tx)
      const draft = (sql, options) => sql`
        select * from public.create_offer_campaign_draft(
          ${fx.merchantId}::uuid, null, null, 10::integer,
          ${startsOn}::date, ${shiftDate(startsOn, 14)}::date,
          false, null, null, null,
          ${options.name}::text, ${options.description}::text)`

      // The function trims and bounds before the column CHECK is ever reached,
      // so the merchant gets a sentence rather than a constraint name.
      const longName = await refusal(tx, (sp) =>
        draft(sp, { name: "x".repeat(61), description: null })
      )
      assert.match(String(longName?.message), /60 characters or fewer/)

      const longDescription = await refusal(tx, (sp) =>
        draft(sp, { name: "Welcome", description: "x".repeat(161) })
      )
      assert.match(String(longDescription?.message), /160 characters or fewer/)

      const [created] = await draft(tx, {
        name: "Welcome offer",
        description: "A tenth off while you are new here.",
      })
      const [row] = await tx`
        select name, customer_description, status
        from public.offer_campaigns where id = ${created.campaign_id}::uuid`
      assert.deepEqual(
        { ...row },
        {
          name: "Welcome offer",
          customer_description: "A tenth off while you are new here.",
          status: "draft",
        },
        "the draft holds the copy the creator collected"
      )
    })
  }
)

test(
  "the claim link reveals the campaign copy only once the offer is claimable",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const name = "Old Crown welcome"
      const description = "A tenth off while you are a new member."
      const campaign = await publishCampaign(tx, fx.merchantId, {
        discountPercent: 10,
        name,
        customerDescription: description,
      })

      const live = await claimContext(tx, campaign.claimHash)
      assert.equal(live.claim_status, "available")
      assert.equal(live.campaign_name, name)
      assert.equal(live.customer_description, description)

      // A leaked or guessed link must not read out an unopened campaign's
      // wording. Every recovery state names the venue and the dates — enough to
      // be calm and honest — and nothing the merchant wrote.
      const withheld = [
        [
          "paused",
          async () => {
            await tx`
              select public.pause_offer_campaign(
                ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid, null)`
          },
        ],
        [
          "not_started",
          async () => {
            await tx`
              select public.resume_offer_campaign(
                ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid, null)`
            const start = shiftDate(await today(tx), 7)
            await timeTravelWindow(
              tx,
              campaign.campaignId,
              start,
              shiftDate(start, 7)
            )
          },
        ],
        [
          "expired",
          async () => {
            const end = shiftDate(await today(tx), -1)
            await timeTravelWindow(
              tx,
              campaign.campaignId,
              shiftDate(end, -7),
              end
            )
          },
        ],
      ]

      for (const [expected, arrange] of withheld) {
        await arrange()
        const context = await claimContext(tx, campaign.claimHash)
        assert.equal(context.claim_status, expected)
        assert.equal(
          context.campaign_name,
          null,
          `${expected} withholds the campaign name`
        )
        assert.equal(
          context.customer_description,
          null,
          `${expected} withholds the customer description`
        )
        assert.ok(
          typeof context.business_name === "string" &&
            context.business_name.length > 0,
          `${expected} still names the venue`
        )
        assert.ok(context.starts_on, `${expected} still gives the dates`)
        assert.ok(context.ends_on, `${expected} still gives the dates`)
      }

      // A hash that matches nothing gets the flat unavailable state and no copy.
      const stranger = await claimContext(tx, hex64())
      assert.equal(stranger.claim_status, "unavailable")
      assert.equal(stranger.campaign_name, null)
      assert.equal(stranger.customer_description, null)
    })
  }
)

test(
  "the campaign copy RPCs are closed to the authenticated role",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      await enableOffers(tx, fx.merchantId)
      const startsOn = await today(tx)
      const campaign = await publishCampaign(tx, fx.merchantId, {
        discountPercent: 10,
        name: "Old Crown welcome",
        customerDescription: "A tenth off while you are a new member.",
      })

      // The GRANT layer, proved on its own: both functions are service_role
      // only, so no signed-in session can write a campaign's copy or read an
      // unclaimed link's copy directly.
      assert.ok(
        await expectDenied(
          tx,
          fx.ownerUserId,
          (sp) => sp`
            select * from public.create_offer_campaign_draft(
              ${fx.merchantId}::uuid, null, null, 10::integer,
              ${startsOn}::date, ${shiftDate(startsOn, 14)}::date,
              false, null, null, null, ${"Direct"}::text, ${"Direct."}::text)`
        ),
        "a session cannot create a campaign directly"
      )
      assert.ok(
        await expectDenied(
          tx,
          fx.ownerUserId,
          (sp) => sp`
            select * from public.get_offer_claim_context(${campaign.claimHash})`
        ),
        "a session cannot read a claim link's copy directly"
      )
    })
  }
)

test(
  "two simultaneous scans of the same poster award exactly once",
  { skip: concurrencySkip, timeout: 20_000 },
  async () => {
    const setup = db()
    const fixture = await createRewardPoolFixture(setup)
    const claimHash = hex64()
    const claimant = randomUUID()
    const claimantAuthId = randomUUID()

    try {
      await enableOffers(setup, fixture.merchantId)
      await setup`insert into auth.users (id) values (${claimantAuthId}::uuid)`
      await setup`
        insert into public.customers (id, auth_user_id, phone_hmac, phone_verified_at)
        values (${claimant}::uuid, ${claimantAuthId}::uuid, ${hex64()}, now())`
      const campaign = await publishCampaign(setup, fixture.merchantId, {
        bonusStampCount: 2,
        discountPercent: 10,
        claimHash,
      })
      assert.equal(campaign.status, "live")

      const startTogether = createStartBarrier(2)
      const [first, second] = await Promise.all([
        claimOnDedicatedConnection(claimant, claimHash, startTogether),
        claimOnDedicatedConnection(claimant, claimHash, startTogether),
      ])

      const statuses = [first.status, second.status].sort()
      assert.deepEqual(
        statuses,
        ["already_claimed", "claimed"],
        "the campaign row lock serialises the two scans"
      )

      const [state] = await setup`
        select
          (select count(*)::int from public.offer_campaign_claims
           where campaign_id = ${campaign.campaignId}::uuid) as claims,
          (select count(*)::int from public.offer_discount_entitlements
           where campaign_id = ${campaign.campaignId}::uuid) as passes,
          (select count(*)::int from public.stamp_events
           where customer_id = ${claimant}::uuid) as stamps,
          (select coalesce(max(current_stamp_count), 0)::int
           from public.customer_memberships
           where customer_id = ${claimant}::uuid) as counter`
      assert.deepEqual(
        { ...state },
        { claims: 1, passes: 1, stamps: 2, counter: 2 },
        "one claim, one pass, one grant of two stamps"
      )
    } finally {
      await setup`delete from public.customers where id = ${claimant}::uuid`
      await setup`delete from auth.users where id = ${claimantAuthId}::uuid`
      await cleanupRewardPoolFixture(setup, fixture)
    }
  }
)

async function claimOnDedicatedConnection(customerId, claimHash, start) {
  assert.ok(localDbUrl)
  const sql = postgres(localDbUrl, { max: 1 })
  try {
    return await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      await start()
      const [row] = await claim(tx, customerId, claimHash)
      return row
    })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function createStartBarrier(participantCount) {
  let arrived = 0
  let release
  const opened = new Promise((resolve) => {
    release = resolve
  })

  return async () => {
    arrived += 1
    if (arrived === participantCount) release()
    await opened
  }
}

function resolveLocalDbUrl() {
  const rawUrl = dbUrl()?.trim()
  if (!rawUrl) return undefined

  try {
    const url = new URL(rawUrl)
    return LOCAL_DB_HOSTS.has(url.hostname) &&
      ["postgres:", "postgresql:"].includes(url.protocol)
      ? rawUrl
      : undefined
  } catch {
    return undefined
  }
}
