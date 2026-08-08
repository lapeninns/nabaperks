import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"

import { closeDb, db, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

/**
 * DB integration tier for the offer campaign window ceiling.
 *
 * Two things are proved here that nothing else could reach. First, the general
 * rule: `offer_campaigns_window_valid` allows 366 inclusive days by default and
 * exactly `max_window_days` when an approval has raised it, and the ceiling is
 * frozen after publication like the rest of the terms. Second, the Old Crown
 * correction itself — 20260808000000 and 20260808120000 both name a production
 * campaign that exists in no seed and no fixture, so before this file every
 * guard, the trigger bypass and both updates ran for the first time in
 * production. The suite seeds that exact row inside a rolled-back transaction
 * and replays the migrations over it.
 *
 * The two behaviours that regressed under review get their own cases: a SECOND
 * active pass must be extended rather than abort the migration, and a campaign
 * a venue paused must be skipped rather than fail the deploy.
 */

const CAMPAIGN_ID = "c1dfbf7d-8166-40d6-884c-1c659826d996"
const MERCHANT_ID = "cccd7192-bc88-4d65-b69d-4922e39fd906"
const CAMPAIGN_NAME = "Student & Staff Welcome Pass"

const EXTEND_MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260808000000_old_crown_student_staff_three_year_window.sql"
)
const OVERRIDE_MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260808120000_offer_campaign_window_override.sql"
)

async function windowOverrideDbReady() {
  if (!(await isLiveDbReady())) return false
  try {
    const [{ n }] = await db()`
      select count(*)::int as n
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'offer_campaigns'
        and column_name = 'max_window_days'`
    return n === 1
  } catch {
    return false
  }
}

const ready = await windowOverrideDbReady()
const skip = ready
  ? false
  : "live Supabase DB with offer_campaigns.max_window_days not reachable"

after(async () => {
  await closeDb()
})

function hex64() {
  return (randomUUID() + randomUUID()).replace(/-/g, "")
}

/** A venue owned by a fresh auth user. `merchantId` may be pinned by a caller. */
async function seedMerchant(tx, merchantId = randomUUID()) {
  const ownerId = randomUUID()
  await tx`insert into auth.users (id) values (${ownerId}::uuid)`
  await tx`
    insert into public.merchants (
      id, owner_user_id, business_name, business_slug, business_type, email
    ) values (
      ${merchantId}::uuid, ${ownerId}::uuid, 'Old Crown',
      ${`old-crown-${merchantId.slice(0, 8)}`}, 'pub',
      ${`owner-${merchantId.slice(0, 8)}@example.test`}
    )`
  return merchantId
}

/** A verified customer with a membership at `merchantId`. */
async function seedMember(tx, merchantId) {
  const authId = randomUUID()
  const customerId = randomUUID()
  const membershipId = randomUUID()
  await tx`insert into auth.users (id) values (${authId}::uuid)`
  await tx`
    insert into public.customers (id, auth_user_id, phone_hmac, phone_verified_at)
    values (${customerId}::uuid, ${authId}::uuid, ${hex64()}, now())`
  await tx`
    insert into public.customer_memberships (id, merchant_id, customer_id)
    values (${membershipId}::uuid, ${merchantId}::uuid, ${customerId}::uuid)`
  return { customerId, membershipId }
}

/**
 * The Old Crown campaign exactly as the correction expects to find it: live,
 * published, linked, one-year window opening 4 August 2026.
 */
async function seedOldCrownCampaign(tx, overrides = {}) {
  await seedMerchant(tx, MERCHANT_ID)
  await tx`
    insert into public.offer_campaigns (
      id, merchant_id, status, name, customer_description,
      discount_percent, starts_on, ends_on, requires_id_check, extra_terms,
      claim_token_hash, claim_token_ciphertext, token_generation, published_at
    ) values (
      ${CAMPAIGN_ID}::uuid, ${MERCHANT_ID}::uuid,
      ${overrides.status ?? "live"},
      ${"name" in overrides ? overrides.name : CAMPAIGN_NAME},
      ${overrides.customerDescription ?? "Show your university or college ID."},
      10, date '2026-08-04', date '2027-08-04', true, 'Food only.',
      ${hex64()}, 'v1.iv.body.tag', ${overrides.tokenGeneration ?? 1}, now()
    )`
  return CAMPAIGN_ID
}

/** An issued discount pass on the Old Crown campaign. */
async function issuePass(
  tx,
  { validFrom = "2026-08-04", validTo = "2027-08-04", status = "active" } = {}
) {
  const { customerId, membershipId } = await seedMember(tx, MERCHANT_ID)
  const claimId = randomUUID()
  const entitlementId = randomUUID()
  await tx`
    insert into public.offer_campaign_claims (
      id, campaign_id, merchant_id, customer_id, membership_id
    ) values (
      ${claimId}::uuid, ${CAMPAIGN_ID}::uuid, ${MERCHANT_ID}::uuid,
      ${customerId}::uuid, ${membershipId}::uuid
    )`
  await tx`
    insert into public.offer_discount_entitlements (
      id, claim_id, campaign_id, merchant_id, customer_id, membership_id,
      discount_percent, requires_id_check, extra_terms, status,
      valid_from, valid_to
    ) values (
      ${entitlementId}::uuid, ${claimId}::uuid, ${CAMPAIGN_ID}::uuid,
      ${MERCHANT_ID}::uuid, ${customerId}::uuid, ${membershipId}::uuid,
      10, true, 'Food only.', ${status}, ${validFrom}::date, ${validTo}::date
    )`
  return entitlementId
}

/**
 * A migration that commits with offer_campaigns_terms_locked disabled would
 * leave every published campaign's frozen terms silently editable, and every
 * other assertion in this file would still pass.
 */
async function assertTermsLockEnabled(tx, label) {
  const [row] = await tx`
    select tgenabled from pg_trigger
    where tgrelid = 'public.offer_campaigns'::regclass
      and tgname = 'offer_campaigns_terms_locked'`
  assert.equal(
    row.tgenabled,
    "O",
    `${label}: offer_campaigns_terms_locked must be re-enabled`
  )
}

function migrationSql(path) {
  assert.ok(existsSync(path), `${path} exists`)
  return readFileSync(path, "utf8")
}

async function readCampaign(tx) {
  const [row] = await tx`
    select starts_on::text, ends_on::text, status, max_window_days,
           token_generation, claim_token_hash
    from public.offer_campaigns where id = ${CAMPAIGN_ID}::uuid`
  return row
}

async function insertCampaignWindow(
  tx,
  merchantId,
  startsOn,
  endsOn,
  maxWindowDays
) {
  await tx`
    insert into public.offer_campaigns (
      merchant_id, status, discount_percent, starts_on, ends_on, max_window_days
    ) values (
      ${merchantId}::uuid, 'draft', 10,
      ${startsOn}::date, ${endsOn}::date, ${maxWindowDays}::integer
    )`
}

async function expectWindowRejected(
  tx,
  merchantId,
  startsOn,
  endsOn,
  maxWindowDays
) {
  let message = ""
  try {
    await tx.savepoint(async (sp) => {
      await insertCampaignWindow(
        sp,
        merchantId,
        startsOn,
        endsOn,
        maxWindowDays
      )
    })
  } catch (error) {
    message = String(error.message)
  }
  assert.match(
    message,
    /offer_campaigns_window_valid/,
    `${startsOn}..${endsOn} with max_window_days=${maxWindowDays} must violate offer_campaigns_window_valid`
  )
}

test(
  "the default ceiling is still 366 inclusive days when no window is approved",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchantId = await seedMerchant(tx)

      // 2026-08-04 -> 2027-08-04 is 365 days apart, so 366 inclusive: the
      // widest window a venue can give itself.
      await insertCampaignWindow(
        tx,
        merchantId,
        "2026-08-04",
        "2027-08-04",
        null
      )

      await expectWindowRejected(
        tx,
        merchantId,
        "2026-08-04",
        "2027-08-05",
        null
      )
    })
  }
)

test(
  "max_window_days is the inclusive ceiling, and only that campaign is widened",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const merchantId = await seedMerchant(tx)

      // 1100 is the inclusive length of 2026-08-04 -> 2029-08-07 (1099 apart).
      await insertCampaignWindow(
        tx,
        merchantId,
        "2026-08-04",
        "2029-08-07",
        1100
      )

      // One short of the approval is refused, so the ceiling is exact rather
      // than "anything long is fine".
      await expectWindowRejected(
        tx,
        merchantId,
        "2026-08-04",
        "2029-08-07",
        1099
      )

      // And a campaign with no approval is unaffected by another's.
      await expectWindowRejected(
        tx,
        merchantId,
        "2026-08-04",
        "2029-08-07",
        null
      )
    })
  }
)

test(
  "an approved ceiling is frozen after publication like the rest of the terms",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await seedOldCrownCampaign(tx)

      let message = ""
      try {
        await tx.savepoint(async (sp) => {
          await sp`
            update public.offer_campaigns
            set max_window_days = 1100
            where id = ${CAMPAIGN_ID}::uuid`
        })
      } catch (error) {
        message = String(error.message)
      }

      assert.match(
        message,
        /Published offer terms cannot be changed/,
        "max_window_days must be held by offer_campaigns_terms_locked"
      )
    })
  }
)

test(
  "both corrections replay as a no-op on a database without the campaign",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const extend = migrationSql(EXTEND_MIGRATION)
      const override = migrationSql(OVERRIDE_MIGRATION)

      await tx.unsafe(extend)
      await tx.unsafe(override)
      // Replay must be a no-op, not an error.
      await tx.unsafe(extend)
      await tx.unsafe(override)

      const [{ n }] = await tx`
        select count(*)::int as n from public.offer_campaigns
        where id = ${CAMPAIGN_ID}::uuid`
      assert.equal(n, 0)
    })
  }
)

test(
  "the correction extends EVERY active pass, not only the first one",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await seedOldCrownCampaign(tx)
      // The poster is in the wild: a second customer claimed before the
      // migration landed. Both passes must move, and the deploy must not fail.
      const first = await issuePass(tx)
      const second = await issuePass(tx)
      // A pass the venue withdrew, and one that already lapsed. Neither may be
      // resurrected to 2029 by a correction aimed at live passes.
      const revoked = await issuePass(tx, { status: "revoked" })
      const expired = await issuePass(tx, { status: "expired" })

      const extend = migrationSql(EXTEND_MIGRATION)
      await tx.unsafe(extend)
      await assertTermsLockEnabled(tx, "after the correction")

      const campaign = await readCampaign(tx)
      assert.equal(campaign.ends_on, "2029-08-07")

      const byId = new Map(
        (
          await tx`
            select id, valid_to::text, status
            from public.offer_discount_entitlements
            where campaign_id = ${CAMPAIGN_ID}::uuid`
        ).map((row) => [row.id, row])
      )
      assert.equal(byId.size, 4)
      for (const id of [first, second]) {
        assert.equal(byId.get(id).valid_to, "2029-08-07", `${id} must extend`)
      }
      for (const id of [revoked, expired]) {
        assert.equal(
          byId.get(id).valid_to,
          "2027-08-04",
          `${id} is not active and must be left alone`
        )
      }

      const [event] = await tx`
        select metadata from public.product_events
        where event_name = 'offer_campaign_window_extended'`
      assert.equal(event.metadata.active_passes_extended, 2)

      // Replay over the SAME seeded campaign: nothing moves, nothing doubles.
      await tx.unsafe(extend)
      await assertTermsLockEnabled(tx, "after the replay")

      const [{ n: eventCount }] = await tx`
        select count(*)::int as n from public.product_events
        where event_name = 'offer_campaign_window_extended'`
      assert.equal(eventCount, 1)

      const [{ n: moved }] = await tx`
        select count(*)::int as n from public.offer_discount_entitlements
        where campaign_id = ${CAMPAIGN_ID}::uuid and valid_to <> '2029-08-07'::date`
      assert.equal(
        moved,
        2,
        "the revoked and expired passes still have not moved"
      )
    })
  }
)

test(
  "a campaign the venue paused or re-linked is skipped, never a failed deploy",
  { skip },
  async () => {
    for (const drift of [
      { label: "paused", overrides: { status: "paused" } },
      { label: "re-linked", overrides: { tokenGeneration: 2 } },
      { label: "renamed", overrides: { name: "Welcome Pass" } },
      { label: "unnamed", overrides: { name: null } },
      {
        label: "re-scoped to Girton",
        overrides: { customerDescription: "Girton members only." },
      },
    ]) {
      await inRolledBackTxn(async (tx) => {
        await seedOldCrownCampaign(tx, drift.overrides)
        await issuePass(tx)

        // Neither migration may throw, and neither may act.
        await tx.unsafe(migrationSql(EXTEND_MIGRATION))
        await tx.unsafe(migrationSql(OVERRIDE_MIGRATION))
        await assertTermsLockEnabled(tx, drift.label)

        const campaign = await readCampaign(tx)
        assert.equal(
          campaign.ends_on,
          "2027-08-04",
          `${drift.label}: the window must be left alone`
        )
        assert.equal(
          campaign.starts_on,
          "2026-08-04",
          `${drift.label}: the start must be left alone`
        )

        const [{ n }] = await tx`
          select count(*)::int as n from public.product_events
          where event_name = 'offer_campaign_window_extended'`
        assert.equal(n, 0, `${drift.label}: no correction event`)

        const [{ n: audits }] = await tx`
          select count(*)::int as n from public.audit_logs
          where action = 'offer_campaign_window_extended'`
        assert.equal(audits, 0, `${drift.label}: no correction audit`)
      })
    }
  }
)

test(
  "a venue that drifts BETWEEN the two corrections keeps its start date",
  { skip },
  async () => {
    for (const drift of [
      {
        label: "paused",
        set: (tx) =>
          tx`update public.offer_campaigns set status = 'paused' where id = ${CAMPAIGN_ID}::uuid`,
      },
      {
        label: "re-linked",
        set: (tx) =>
          tx`update public.offer_campaigns set token_generation = 2 where id = ${CAMPAIGN_ID}::uuid`,
      },
      {
        label: "re-scoped to Girton",
        set: (tx) =>
          tx`update public.offer_campaigns set customer_description = 'Girton members only.' where id = ${CAMPAIGN_ID}::uuid`,
      },
    ]) {
      await inRolledBackTxn(async (tx) => {
        await seedOldCrownCampaign(tx)
        await issuePass(tx)

        // 20260808000000 is already in production, so the venue's next move
        // lands between the two migrations.
        await tx.unsafe(migrationSql(EXTEND_MIGRATION))
        await drift.set(tx)

        await tx.unsafe(migrationSql(OVERRIDE_MIGRATION))
        await assertTermsLockEnabled(tx, drift.label)

        const campaign = await readCampaign(tx)
        assert.equal(
          campaign.starts_on,
          "2026-08-07",
          `${drift.label}: the start must NOT be restored under drift`
        )
        // The ceiling still has to be recorded, or the general rule could not
        // be re-validated over a window the old carve-out had permitted.
        assert.equal(campaign.max_window_days, 1100)

        const [audit] = await tx`
          select metadata from public.audit_logs
          where action = 'offer_campaign_window_extended'
            and target_id = ${CAMPAIGN_ID}::uuid`
        assert.equal(
          audit.metadata.start_restored,
          false,
          `${drift.label}: the audit must not claim a restore that did not happen`
        )
      })
    }
  }
)

test(
  "a student offer that mentions a college ID is still corrected",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await seedOldCrownCampaign(tx, {
        customerDescription: "Show a valid university or college student ID.",
      })
      await issuePass(tx)

      await tx.unsafe(migrationSql(EXTEND_MIGRATION))

      const campaign = await readCampaign(tx)
      assert.equal(campaign.ends_on, "2029-08-07")
    })
  }
)

test(
  "the override migration restores the claimed start date and audits it",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await seedOldCrownCampaign(tx)
      await issuePass(tx)

      const extend = migrationSql(EXTEND_MIGRATION)
      const override = migrationSql(OVERRIDE_MIGRATION)

      await tx.unsafe(extend)
      const moved = await readCampaign(tx)
      assert.equal(moved.starts_on, "2026-08-07")

      await tx.unsafe(override)
      await assertTermsLockEnabled(tx, "after the override migration")

      const restored = await readCampaign(tx)
      assert.equal(
        restored.starts_on,
        "2026-08-04",
        "the start must match the date the first pass was claimed"
      )
      assert.equal(restored.ends_on, "2029-08-07")
      assert.equal(restored.max_window_days, 1100)

      // The general rule is added NOT VALID and re-validated in the same
      // migration. A constraint left unvalidated would pass every assertion
      // above while tripping the schema-integrity gate on a real deploy.
      const [constraint] = await tx`
        select convalidated from pg_constraint
        where conrelid = 'public.offer_campaigns'::regclass
          and conname = 'offer_campaigns_window_valid'`
      assert.equal(constraint.convalidated, true)
      assert.equal(
        restored.token_generation,
        1,
        "the printed link must survive both corrections"
      )

      const [{ valid_from: validFrom }] = await tx`
        select valid_from::text from public.offer_discount_entitlements
        where campaign_id = ${CAMPAIGN_ID}::uuid`
      assert.equal(
        validFrom,
        "2026-08-04",
        "the pass was claimed on 4 August and must not predate its campaign"
      )

      const audits = await tx`
        select metadata from public.audit_logs
        where action = 'offer_campaign_window_extended'
          and target_id = ${CAMPAIGN_ID}::uuid`
      assert.equal(audits.length, 1)
      assert.equal(audits[0].metadata.max_window_days, 1100)

      // A forced re-apply (a restored snapshot, a branch database provisioned
      // with an empty ledger) replays BOTH files in order over data the second
      // one has already corrected. 20260808000000's carve-out therefore has to
      // accept the restored 4 August start, or its ADD CONSTRAINT aborts before
      // any guard runs; it then reads the window as superseded and skips.
      await tx.unsafe(extend)
      const afterExtendReplay = await readCampaign(tx)
      assert.equal(
        afterExtendReplay.starts_on,
        "2026-08-04",
        "replaying the superseded migration must not undo the restore"
      )

      await tx.unsafe(override)
      await assertTermsLockEnabled(tx, "after the full replay")

      const replayed = await readCampaign(tx)
      assert.deepEqual(
        {
          startsOn: replayed.starts_on,
          endsOn: replayed.ends_on,
          maxWindowDays: replayed.max_window_days,
        },
        { startsOn: "2026-08-04", endsOn: "2029-08-07", maxWindowDays: 1100 }
      )

      const [{ n: auditCount }] = await tx`
        select count(*)::int as n from public.audit_logs
        where action = 'offer_campaign_window_extended'`
      assert.equal(auditCount, 1)

      const [{ n: eventCount }] = await tx`
        select count(*)::int as n from public.product_events
        where event_name = 'offer_campaign_window_extended'`
      assert.equal(eventCount, 1)
    })
  }
)
