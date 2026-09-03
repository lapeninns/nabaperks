import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { actAsActivatedInternalAdmin } from "./helpers/admin-auth.mjs"

/**
 * referral ops visibility — live-DB invariant tier (primary proof).
 *
 * Proves the support operational view (admin_referral_ops, internal-admin-only) and
 * the merchant aggregate summary (merchant_referral_summary, owner-only, PII-free).
 * Covers OV-1…OV-7. Seeds run in the service-role context; the RPC access checks run
 * under a switched authenticated JWT context, with savepoints around expected raises.
 */

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

const ADMIN_UID = "00000000-0000-0000-0000-000000000001"
const MERCHANT_ID = "10000000-0000-0000-0000-000000000001"

async function actAsService(tx) {
  await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
}
async function actAsAuthenticated(tx, userId, aal = "aal2") {
  await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
  await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`
  await tx`select set_config('request.jwt.claim.aal', ${aal}, true)`
}
function isRejection(error) {
  return /privilege|admin|owner|authori|access/i.test(String(error.message))
}

async function makeCustomer(tx) {
  const [c] = await tx`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`ops-${randomUUID()}@test.local`}, now(), now(), now()) returning id, email`
  return c
}
async function makeMembership(tx, merchantId, customerId) {
  const [m] = await tx`
    insert into public.customer_memberships (merchant_id, customer_id)
    values (${merchantId}::uuid, ${customerId}::uuid) returning id`
  return m.id
}

async function merchantOwnerUserId(tx, merchantId) {
  const [merchant] = await tx`
    select owner_user_id::text as owner_user_id
    from public.merchants
    where id = ${merchantId}::uuid`
  assert.ok(
    merchant?.owner_user_id,
    "the referral fixture merchant has an owner"
  )
  return merchant.owner_user_id
}

// Insert a referral edge in a chosen status for a merchant, with distinct
// referrer/referred customers. The denormalise trigger fills venue/customer ids.
async function seedReferral(tx, merchantId, status) {
  const referrer = await makeCustomer(tx)
  const referrerM = await makeMembership(tx, merchantId, referrer.id)
  const friend = await makeCustomer(tx)
  const friendM = await makeMembership(tx, merchantId, friend.id)
  const [edge] = await tx`
    insert into public.referrals (
      referred_membership_id, referrer_membership_id, referral_code_used, status,
      qualified_at, referrer_bonus_awarded_at)
    values (${friendM}::uuid, ${referrerM}::uuid, 'seed-code', ${status},
      ${status === "attributed" ? null : tx`now()`},
      ${status === "awarded" ? tx`now()` : null})
    returning id`
  return { edgeId: edge.id, referrer, friend, referrerM, friendM }
}

test(
  "OV-1/OV-2/OV-3: admin_referral_ops returns full detail to an admin only",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await actAsService(tx)
      const q = await seedReferral(tx, MERCHANT_ID, "qualified")

      // Non-admin caller is rejected (OV-2).
      let rejected = false
      try {
        await tx.savepoint(async (sp) => {
          await actAsAuthenticated(sp, randomUUID())
          await sp`select * from public.admin_referral_ops(${MERCHANT_ID}::uuid, null, 100, 0)`
        })
      } catch (error) {
        rejected = isRejection(error)
      }
      assert.ok(rejected, "a non-admin cannot read the ops view (OV-2)")

      // Admin sees the seeded referral's detail (OV-1).
      await actAsActivatedInternalAdmin(tx, ADMIN_UID)
      const rows =
        await tx`select * from public.admin_referral_ops(${MERCHANT_ID}::uuid, null, 200, 0)`
      const found = rows.find((r) => r.referral_id === q.edgeId)
      assert.ok(
        found,
        "the seeded referral appears in the admin ops view (OV-1)"
      )
      assert.equal(found.status, "qualified", "status is reported")
      assert.equal(
        found.referrer_customer_id,
        q.referrer.id,
        "referrer identity is reported (support detail)"
      )
      assert.equal(
        found.referred_customer_id,
        q.friend.id,
        "referred identity is reported (support detail)"
      )
      assert.ok("fraud_flag_count" in found, "a fraud-flag count is reported")
      assert.ok("retry_count" in found, "a retry count is reported")

      // Status filter narrows the result (OV-3).
      const heldSeed = await (async () => {
        await actAsService(tx)
        return seedReferral(tx, MERCHANT_ID, "held")
      })()
      await actAsActivatedInternalAdmin(tx, ADMIN_UID)
      const heldRows =
        await tx`select * from public.admin_referral_ops(${MERCHANT_ID}::uuid, 'held', 200, 0)`
      assert.ok(
        heldRows.every((r) => r.status === "held"),
        "the status filter returns only held rows (OV-3)"
      )
      assert.ok(
        heldRows.some((r) => r.referral_id === heldSeed.edgeId),
        "the held referral is present"
      )
    })
  }
)

test(
  "OV-4/OV-5/OV-6: merchant_referral_summary is owner-only aggregate with no PII",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await actAsService(tx)
      await seedReferral(tx, MERCHANT_ID, "attributed")
      await seedReferral(tx, MERCHANT_ID, "qualified")
      await seedReferral(tx, MERCHANT_ID, "awarded")
      await seedReferral(tx, MERCHANT_ID, "held")
      const ownerUserId = await merchantOwnerUserId(tx, MERCHANT_ID)

      // A non-owner is rejected (OV-6).
      let rejected = false
      try {
        await tx.savepoint(async (sp) => {
          await actAsAuthenticated(sp, randomUUID())
          await sp`select * from public.merchant_referral_summary(${MERCHANT_ID}::uuid)`
        })
      } catch (error) {
        rejected = isRejection(error)
      }
      assert.ok(rejected, "a non-owner cannot read the summary (OV-6)")

      // The owner gets aggregate counts (OV-4).
      await actAsAuthenticated(tx, ownerUserId)
      const [summary] =
        await tx`select * from public.merchant_referral_summary(${MERCHANT_ID}::uuid)`
      assert.ok(summary, "the owner gets a summary row (OV-4)")
      assert.ok(Number(summary.attributed_count) >= 1, "attributed counted")
      assert.ok(Number(summary.qualified_count) >= 1, "qualified counted")
      assert.ok(Number(summary.awarded_count) >= 1, "awarded counted")
      assert.ok(Number(summary.held_count) >= 1, "held counted")

      // The aggregate exposes no customer identifier (OV-5).
      const keys = Object.keys(summary)
      const leaks = keys.filter((k) =>
        /customer|email|phone|membership|referrer|referred/i.test(k)
      )
      assert.deepEqual(
        leaks,
        [],
        `summary must be counts only, found identifier-like keys: ${leaks.join(", ")}`
      )
    })
  }
)
