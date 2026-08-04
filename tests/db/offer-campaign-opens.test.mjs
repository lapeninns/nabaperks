import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"
import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * DB integration tier for the "offer link opened" signal (20260803101000).
 *
 * The merchant desk shows a link-opens tile, and the only thing that makes that
 * tile honest rather than invented is the ledger underneath it. These tests
 * prove what the ledger actually promises:
 *   * an open of a CLAIMABLE link increments a counter, on the right campaign
 *     and the right UK business date, and repeat opens accumulate on one row;
 *   * an unknown, rotated, draft, paused, unopened, finished or ended link
 *     records nothing — the recorder decides claimability for itself and never
 *     trusts the caller;
 *   * the definition matches get_offer_claim_context exactly, asserted by
 *     calling both against the same link rather than by reading the source;
 *   * counts already recorded survive pause, resume and end, because they are
 *     history rather than state.
 *
 * The GRANT layer is proved SEPARATELY from the function body. The writes below
 * run in the transaction's default service-role context, which exercises the
 * body only; `asAuthenticated` switches to the real `authenticated` Postgres
 * role so table GRANTs and RLS both apply, and `expectDenied` accepts nothing
 * but SQLSTATE 42501 or an RLS-empty result.
 *
 * Every write is inside `inRolledBackTxn`, so the shared local database is
 * never mutated. Skips cleanly when the RPC is not deployed.
 */

async function openSignalDbReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [{ n }] = await db()`
      select count(*)::int as n from pg_proc where proname in (
        'record_offer_campaign_open', 'get_offer_claim_context',
        'publish_offer_campaign', 'rotate_offer_campaign_token',
        'create_offer_campaign_draft')`
    return n >= 5
  } catch {
    return false
  }
}

const ready = await openSignalDbReady()
const skip = ready
  ? false
  : "live Supabase DB with the offer open-signal RPC not reachable"

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

/** Draft, install a link and publish — the desk's whole path to a printable QR. */
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
      ${options.name ?? "Opens test"}::text,
      ${options.customerDescription ?? "A test offer."}::text)`

  await tx`
    select public.rotate_offer_campaign_token(
      ${merchantId}::uuid, ${draft.campaign_id}::uuid,
      ${claimHash}, ${"v1.iv.body.tag"}, null)`

  if (options.publish === false) {
    return { campaignId: draft.campaign_id, claimHash, status: "draft" }
  }

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

/** One landing-page load, as `after()` records it. Returns whether it counted. */
async function recordOpen(tx, claimHash) {
  const [row] = await tx`
    select public.record_offer_campaign_open(${claimHash}) as counted`
  return row.counted
}

/** What the landing page itself resolves the same link to. */
async function claimStatus(tx, claimHash) {
  const [row] = await tx`
    select claim_status from public.get_offer_claim_context(${claimHash})`
  return row?.claim_status ?? null
}

async function openRows(tx, campaignId) {
  return tx`
    select merchant_id, opened_on::text as opened_on, open_count::int as open_count,
           first_opened_at, last_opened_at
    from public.offer_campaign_open_counts
    where campaign_id = ${campaignId}::uuid
    order by opened_on`
}

async function openTotal(tx, campaignId) {
  const [row] = await tx`
    select coalesce(sum(open_count), 0)::int as total
    from public.offer_campaign_open_counts
    where campaign_id = ${campaignId}::uuid`
  return row.total
}

/**
 * Move a published campaign's window without tripping the post-publish terms
 * lock. Simulating the passage of time is the one legitimate reason to step
 * around that trigger; it is re-enabled immediately and the whole transaction
 * is rolled back.
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
  "an open of a claimable link increments today's counter, and repeats accumulate",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaign = await publishCampaign(tx, fx.merchantId)
      assert.equal(campaign.status, "live")
      assert.equal(
        await claimStatus(tx, campaign.claimHash),
        "available",
        "the link the customer opens must be claimable for this to count"
      )

      assert.equal(await recordOpen(tx, campaign.claimHash), true)
      assert.equal(await recordOpen(tx, campaign.claimHash), true)
      assert.equal(await recordOpen(tx, campaign.claimHash), true)

      const rows = await openRows(tx, campaign.campaignId)
      assert.equal(
        rows.length,
        1,
        "three opens on one day must roll up to one row, not three"
      )
      assert.equal(rows[0].open_count, 3)
      assert.equal(rows[0].opened_on, await today(tx))
      assert.equal(rows[0].merchant_id, fx.merchantId)
      assert.ok(
        rows[0].last_opened_at >= rows[0].first_opened_at,
        "the last open is never before the first"
      )
    })
  }
)

test(
  "an unknown token records nothing, and a rotated one stops counting at once",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaign = await publishCampaign(tx, fx.merchantId)

      assert.equal(
        await recordOpen(tx, hex64()),
        false,
        "a hash that belongs to no campaign counts nothing"
      )
      assert.equal(await recordOpen(tx, ""), false)
      assert.equal(await recordOpen(tx, null), false)

      assert.equal(await recordOpen(tx, campaign.claimHash), true)

      const rotatedHash = hex64()
      await tx`
        select public.rotate_offer_campaign_token(
          ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid,
          ${rotatedHash}, ${"v1.iv.body.tag"}, null)`

      assert.equal(
        await recordOpen(tx, campaign.claimHash),
        false,
        "the old poster's link is dead for the counter as well as for claims"
      )
      assert.equal(await recordOpen(tx, rotatedHash), true)

      assert.equal(
        await openTotal(tx, campaign.campaignId),
        2,
        "the reprint keeps the campaign's history; only the dead link is refused"
      )
    })
  }
)

test(
  "the counter is scoped to the campaign behind the link that was opened",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const host = await createRewardPoolFixture(tx)
      const neighbour = await createRewardPoolFixture(tx)

      const hostCampaign = await publishCampaign(tx, host.merchantId)
      const neighbourCampaign = await publishCampaign(tx, neighbour.merchantId)

      await recordOpen(tx, hostCampaign.claimHash)
      await recordOpen(tx, hostCampaign.claimHash)
      await recordOpen(tx, neighbourCampaign.claimHash)

      assert.equal(await openTotal(tx, hostCampaign.campaignId), 2)
      assert.equal(await openTotal(tx, neighbourCampaign.campaignId), 1)

      const [row] = await openRows(tx, neighbourCampaign.campaignId)
      assert.equal(
        row.merchant_id,
        neighbour.merchantId,
        "the rollup is stamped with the venue that owns the campaign"
      )
    })
  }
)

test(
  "nothing is counted unless the link is claimable, on the same definition the landing page uses",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const start = await today(tx)

      // Draft: the link exists but was never published, so it is not public.
      const draft = await publishCampaign(tx, fx.merchantId, {
        publish: false,
      })
      assert.equal(await claimStatus(tx, draft.claimHash), "unavailable")
      assert.equal(await recordOpen(tx, draft.claimHash), false)
      assert.equal(await openTotal(tx, draft.campaignId), 0)

      // Re-drafting supersedes the unpublished draft, which is how the desk
      // itself clears one; a draft has promised nothing so nothing is lost.
      const campaign = await publishCampaign(tx, fx.merchantId)

      // Paused: the venue has stopped new claims.
      await tx`
        select public.pause_offer_campaign(
          ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid, null)`
      assert.equal(await claimStatus(tx, campaign.claimHash), "paused")
      assert.equal(await recordOpen(tx, campaign.claimHash), false)

      await tx`
        select public.resume_offer_campaign(
          ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid, null)`

      // Not yet open: published ahead of its start date.
      await timeTravelWindow(
        tx,
        campaign.campaignId,
        shiftDate(start, 5),
        shiftDate(start, 20)
      )
      assert.equal(await claimStatus(tx, campaign.claimHash), "not_started")
      assert.equal(await recordOpen(tx, campaign.claimHash), false)

      // Finished: the window has passed.
      await timeTravelWindow(
        tx,
        campaign.campaignId,
        shiftDate(start, -20),
        shiftDate(start, -1)
      )
      assert.equal(await claimStatus(tx, campaign.claimHash), "expired")
      assert.equal(await recordOpen(tx, campaign.claimHash), false)

      // Back inside the window, so the link is claimable again and this load
      // is the one that counts.
      await timeTravelWindow(
        tx,
        campaign.campaignId,
        start,
        shiftDate(start, 20)
      )
      assert.equal(await claimStatus(tx, campaign.claimHash), "available")
      assert.equal(await recordOpen(tx, campaign.claimHash), true)

      assert.equal(
        await openTotal(tx, campaign.campaignId),
        1,
        "exactly one of those loads was an open of a claimable link"
      )
    })
  }
)

test(
  "counts already recorded survive pause, resume and the end of the campaign",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaign = await publishCampaign(tx, fx.merchantId)

      await recordOpen(tx, campaign.claimHash)
      await recordOpen(tx, campaign.claimHash)

      await tx`
        select public.pause_offer_campaign(
          ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid, null)`
      assert.equal(
        await openTotal(tx, campaign.campaignId),
        2,
        "pausing stops new counts; it does not erase the ones already recorded"
      )
      assert.equal(await recordOpen(tx, campaign.claimHash), false)

      await tx`
        select public.resume_offer_campaign(
          ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid, null)`
      assert.equal(await recordOpen(tx, campaign.claimHash), true)
      assert.equal(
        await openTotal(tx, campaign.campaignId),
        3,
        "resuming continues the same day's row rather than starting a new one"
      )

      await tx`
        select public.end_offer_campaign(
          ${fx.merchantId}::uuid, ${campaign.campaignId}::uuid, null)`

      const [ended] = await tx`
        select status, claim_token_hash from public.offer_campaigns
        where id = ${campaign.campaignId}::uuid`
      assert.equal(ended.status, "ended")
      assert.equal(
        ended.claim_token_hash,
        null,
        "ending scrubs the hash, so the recorder can no longer resolve the link"
      )

      assert.equal(await recordOpen(tx, campaign.claimHash), false)
      assert.equal(
        await openTotal(tx, campaign.campaignId),
        3,
        "the ended campaign's history is what the read-only panel reports"
      )

      const rows = await openRows(tx, campaign.campaignId)
      assert.equal(rows.length, 1, "one row per campaign per day, throughout")
    })
  }
)

test(
  "the rollup is removed with its campaign, and holds no customer column",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fx = await createRewardPoolFixture(tx)
      const campaign = await publishCampaign(tx, fx.merchantId)
      await recordOpen(tx, campaign.claimHash)

      // Introspected rather than grepped: a column added later would be caught.
      const columns = await tx`
        select column_name from information_schema.columns
        where table_schema = 'public'
          and table_name = 'offer_campaign_open_counts'
        order by column_name`
      assert.deepEqual(
        columns.map((row) => row.column_name),
        [
          "campaign_id",
          "first_opened_at",
          "last_opened_at",
          "merchant_id",
          "open_count",
          "opened_on",
        ],
        "the rollup identifies the campaign and the day, and nothing else"
      )

      await tx`
        delete from public.offer_campaigns where id = ${campaign.campaignId}::uuid`
      assert.equal(
        await openTotal(tx, campaign.campaignId),
        0,
        "the retention sweep's cascade takes the rollup with the campaign"
      )
    })
  }
)

test(
  "only service_role may record an open, and only the owning venue may read the rollup",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const host = await createRewardPoolFixture(tx)
      const stranger = await createRewardPoolFixture(tx)
      const campaign = await publishCampaign(tx, host.merchantId)
      await recordOpen(tx, campaign.claimHash)

      assert.ok(
        await expectDenied(
          tx,
          host.ownerUserId,
          (sp) => sp`
            select public.record_offer_campaign_open(${campaign.claimHash})`
        ),
        "a merchant session cannot inflate its own count by calling the RPC"
      )
      assert.ok(
        await expectDenied(
          tx,
          host.ownerUserId,
          (sp) => sp`
            insert into public.offer_campaign_open_counts
              (campaign_id, merchant_id, opened_on, open_count)
            values (${campaign.campaignId}::uuid, ${host.merchantId}::uuid,
                    public.uk_business_date(now()), 5000)`
        ),
        "a merchant session cannot write the rollup directly"
      )
      assert.ok(
        await expectDenied(
          tx,
          host.ownerUserId,
          (sp) => sp`
            update public.offer_campaign_open_counts set open_count = 5000
            where campaign_id = ${campaign.campaignId}::uuid`
        ),
        "a merchant session cannot edit the rollup"
      )
      assert.ok(
        await expectDenied(
          tx,
          stranger.ownerUserId,
          // Rows, not an aggregate: `count(*)` returns one row whatever RLS
          // filters away, so it can never read as a denial.
          (sp) => sp`
            select campaign_id from public.offer_campaign_open_counts
            where merchant_id = ${host.merchantId}::uuid`
        ),
        "another venue's owner reads none of this venue's rollup"
      )

      const owner = await asAuthenticated(
        tx,
        host.ownerUserId,
        (sp) => sp`
          select sum(open_count)::int as total
          from public.offer_campaign_open_counts
          where merchant_id = ${host.merchantId}::uuid`
      )
      assert.equal(
        owner[0].total,
        1,
        "the owning venue still reads its own campaign's opens"
      )

      const [{ n: openTotals }] = await tx`
        select count(*)::int as n
        from public.offer_campaign_open_counts
        where merchant_id = ${host.merchantId}::uuid`
      assert.equal(openTotals, 1)
    })
  }
)
