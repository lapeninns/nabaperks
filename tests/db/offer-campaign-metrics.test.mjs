import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"
import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * DB integration tier for the merchant Offers desk totals
 * (`offer_campaign_metrics`, 20260804103000).
 *
 * These five numbers used to be assembled in the application, and two of them —
 * the claim count and the welcome-stamp sum — were derived from a full read of
 * public.offer_campaign_claims through PostgREST. supabase/config.toml sets
 * `max_rows = 1000`, so that read was silently capped: a campaign with more
 * than a thousand claims reported exactly 1000, and the stamp sum of only the
 * first thousand, with nothing in the response to say the list had been cut.
 *
 * The first test is therefore the point of the whole file: it puts MORE than
 * `max_rows` claims behind one campaign and asserts the totals come back exact.
 * It is deliberately sized just over the limit rather than far past it, because
 * what is being proved is that the boundary is no longer there at all.
 *
 * Everything is written inside `inRolledBackTxn`, so the shared local database
 * is never mutated, and the file skips cleanly when the RPC is not deployed.
 */

/** supabase/config.toml `max_rows`. The truncation point being disproved. */
const POSTGREST_MAX_ROWS = 1000
const CLAIMS_PAST_THE_LIMIT = POSTGREST_MAX_ROWS + 200
const STAMPS_PER_CLAIM = 2

async function metricsDbReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [{ n }] = await db()`
      select count(*)::int as n from pg_proc where proname in (
        'offer_campaign_metrics', 'create_offer_campaign_draft',
        'rotate_offer_campaign_token', 'publish_offer_campaign',
        'record_offer_campaign_open')`
    return n >= 5
  } catch {
    return false
  }
}

const ready = await metricsDbReady()
const skip = ready
  ? false
  : "live Supabase DB with the offer metrics RPC not reachable"

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

/**
 * Draft, install a link and publish — the desk's own path to a live campaign.
 *
 * No allowlist step: Offers is on for every venue, so an active loyalty card is
 * the whole of what `create_offer_campaign_draft` requires of the merchant.
 */
async function publishCampaign(tx, merchantId, options = {}) {
  const startsOn = options.startsOn ?? (await today(tx))
  const endsOn = options.endsOn ?? shiftDate(await today(tx), 30)
  const claimHash = options.claimHash ?? hex64()

  const [draft] = await tx`
    select * from public.create_offer_campaign_draft(
      ${merchantId}::uuid, null,
      ${options.bonusStampCount ?? null}::integer,
      ${options.discountPercent ?? 10}::integer,
      ${startsOn}::date, ${endsOn}::date,
      false, null, null, null,
      ${"Metrics test"}::text,
      ${"A test offer."}::text)`

  await tx`
    select public.rotate_offer_campaign_token(
      ${merchantId}::uuid, ${draft.campaign_id}::uuid,
      ${claimHash}, ${"v1.iv.body.tag"}, null)`

  await tx`
    select public.publish_offer_campaign(
      ${merchantId}::uuid, ${draft.campaign_id}::uuid, null)`

  return { campaignId: draft.campaign_id, claimHash, startsOn, endsOn }
}

/**
 * `count` extra members of the venue, each with one claim on the campaign.
 * Built in three set-based statements rather than a loop so the fixture cost
 * stays flat as the count crosses the row limit.
 */
async function seedClaims(tx, fixture, campaignId, count) {
  const runId = randomUUID().slice(0, 8)

  await tx`
    insert into public.customers (id, email, full_name, date_of_birth)
    select
      extensions.gen_random_uuid(),
      'metrics-' || ${runId} || '-' || g.i || '@example.test',
      'Metrics Customer ' || g.i,
      date '1990-01-01'
    from generate_series(1, ${count}) as g(i)`

  await tx`
    insert into public.customer_memberships (
      merchant_id, customer_id,
      current_stamp_count, total_stamps_earned, active_cycle_number
    )
    select ${fixture.merchantId}::uuid, c.id, ${STAMPS_PER_CLAIM}, ${STAMPS_PER_CLAIM}, 1
    from public.customers as c
    where c.email like 'metrics-' || ${runId} || '-%'`

  await tx`
    insert into public.offer_campaign_claims (
      campaign_id, merchant_id, customer_id, membership_id, bonus_stamps_awarded
    )
    select
      ${campaignId}::uuid, ${fixture.merchantId}::uuid,
      m.customer_id, m.id, ${STAMPS_PER_CLAIM}
    from public.customer_memberships as m
    where m.merchant_id = ${fixture.merchantId}::uuid
      and m.customer_id <> ${fixture.customerId}::uuid`
}

async function readMetrics(tx, campaignId) {
  const [row] = await tx`
    select
      link_opens::int as link_opens,
      claims::int as claims,
      bonus_stamps_issued::int as bonus_stamps_issued,
      active_passes::int as active_passes,
      pass_redemptions::int as pass_redemptions
    from public.offer_campaign_metrics(${campaignId}::uuid)`
  return row
}

test(
  "claim and welcome-stamp totals stay exact past the PostgREST row limit",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaign = await publishCampaign(tx, fx.merchantId)

      await seedClaims(tx, fx, campaign.campaignId, CLAIMS_PAST_THE_LIMIT)

      // The fixture's own customer is not a claimant, so the ledger holds
      // exactly the seeded rows — and more of them than one PostgREST page.
      const [ledger] = await tx`
        select count(*)::int as rows,
               coalesce(sum(bonus_stamps_awarded), 0)::int as stamps
        from public.offer_campaign_claims
        where campaign_id = ${campaign.campaignId}::uuid`
      assert.equal(ledger.rows, CLAIMS_PAST_THE_LIMIT)
      assert.ok(
        ledger.rows > POSTGREST_MAX_ROWS,
        "the fixture must exceed max_rows or it proves nothing"
      )

      // `max_rows` caps a COLLECTION response. A single-row response has no
      // page to be cut off, so the shape is half the fix and is asserted as
      // such: 1200 claims still answer in one row.
      const shape = await tx`
        select * from public.offer_campaign_metrics(${campaign.campaignId}::uuid)`
      assert.equal(shape.length, 1)

      const metrics = await readMetrics(tx, campaign.campaignId)
      assert.equal(
        metrics.claims,
        CLAIMS_PAST_THE_LIMIT,
        "the claim count must be the whole ledger, not one page of it"
      )
      assert.equal(
        metrics.bonus_stamps_issued,
        CLAIMS_PAST_THE_LIMIT * STAMPS_PER_CLAIM
      )
      assert.equal(metrics.bonus_stamps_issued, ledger.stamps)

      // The failure this replaces would have reported exactly these instead.
      assert.notEqual(metrics.claims, POSTGREST_MAX_ROWS)
      assert.notEqual(
        metrics.bonus_stamps_issued,
        POSTGREST_MAX_ROWS * STAMPS_PER_CLAIM
      )
    })
  }
)

test(
  "every tile counts the ledger the merchant desk says it counts",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaign = await publishCampaign(tx, fx.merchantId)
      const stamp = await today(tx)

      // Three claimants: one pass in date, one already out of date, one revoked.
      await seedClaims(tx, fx, campaign.campaignId, 3)
      const claims = await tx`
        select id, customer_id, membership_id
        from public.offer_campaign_claims
        where campaign_id = ${campaign.campaignId}::uuid
        order by id`
      assert.equal(claims.length, 3)

      const windows = [
        { status: "active", validTo: shiftDate(stamp, 10) },
        { status: "active", validTo: shiftDate(stamp, -1) },
        { status: "revoked", validTo: shiftDate(stamp, 10) },
      ]
      for (const [index, claim] of claims.entries()) {
        const shape = windows[index]
        await tx`
          insert into public.offer_discount_entitlements (
            claim_id, campaign_id, merchant_id, customer_id, membership_id,
            discount_percent, requires_id_check, status, valid_from, valid_to
          ) values (
            ${claim.id}::uuid, ${campaign.campaignId}::uuid,
            ${fx.merchantId}::uuid, ${claim.customer_id}::uuid,
            ${claim.membership_id}::uuid,
            10, false, ${shape.status},
            ${shiftDate(stamp, -5)}::date, ${shape.validTo}::date
          )`
      }

      // Two landing-page loads and one honoured pass.
      await tx`select public.record_offer_campaign_open(${campaign.claimHash})`
      await tx`select public.record_offer_campaign_open(${campaign.claimHash})`

      const [entitlement] = await tx`
        select id, customer_id, membership_id
        from public.offer_discount_entitlements
        where campaign_id = ${campaign.campaignId}::uuid
          and status = 'active' and valid_to >= ${stamp}::date`
      const [token] = await tx`
        insert into public.offer_pass_scan_tokens (
          entitlement_id, merchant_id, customer_id, membership_id
        ) values (
          ${entitlement.id}::uuid, ${fx.merchantId}::uuid,
          ${entitlement.customer_id}::uuid, ${entitlement.membership_id}::uuid
        ) returning id`
      await tx`
        insert into public.offer_redemptions (
          entitlement_id, campaign_id, merchant_id, customer_id, membership_id,
          scan_token_id, discount_percent,
          id_check_attested, no_stacking_attested
        ) values (
          ${entitlement.id}::uuid, ${campaign.campaignId}::uuid,
          ${fx.merchantId}::uuid, ${entitlement.customer_id}::uuid,
          ${entitlement.membership_id}::uuid, ${token.id}::uuid,
          10, false, true
        )`

      assert.deepEqual(await readMetrics(tx, campaign.campaignId), {
        link_opens: 2,
        claims: 3,
        bonus_stamps_issued: 3 * STAMPS_PER_CLAIM,
        // Out-of-date and revoked passes are not "in date"; only the first is.
        active_passes: 1,
        pass_redemptions: 1,
      })
    })
  }
)

test(
  "an unknown campaign reports zeroes, not an empty result",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      assert.deepEqual(await readMetrics(tx, randomUUID()), {
        link_opens: 0,
        claims: 0,
        bonus_stamps_issued: 0,
        active_passes: 0,
        pass_redemptions: 0,
      })
    })
  }
)

test("the totals RPC is reachable by service_role only", { skip }, async () => {
  await inRolledBackTxn(async (tx) => {
    const [grants] = await tx`
      select
        has_function_privilege('anon',
          'public.offer_campaign_metrics(uuid)', 'EXECUTE') as anon_exec,
        has_function_privilege('authenticated',
          'public.offer_campaign_metrics(uuid)', 'EXECUTE') as authenticated_exec,
        has_function_privilege('service_role',
          'public.offer_campaign_metrics(uuid)', 'EXECUTE') as service_exec`

    assert.deepEqual(grants, {
      anon_exec: false,
      authenticated_exec: false,
      service_exec: true,
    })
  })
})
