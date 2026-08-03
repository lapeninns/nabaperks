import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, db, isLiveDbReady } from "./helpers/db.mjs"

const expectedIndexes = Object.freeze([
  "customer_join_stamp_recoveries_merchant_id_idx",
  "customer_terms_customer_id_idx",
  "customer_terms_loyalty_card_id_idx",
  "customer_terms_merchant_id_idx",
  "customer_terms_qr_code_id_idx",
  "loyalty_invite_recipients_claimed_customer_id_idx",
  "loyalty_invite_recipients_claimed_membership_id_idx",
  "loyalty_invite_recipients_merchant_id_idx",
  "offer_campaign_claims_customer_id_idx",
  "offer_campaign_claims_membership_id_idx",
  "offer_campaign_claims_merchant_id_idx",
  "offer_discount_entitlements_campaign_id_idx",
  "offer_discount_entitlements_customer_id_idx",
  "offer_discount_entitlements_membership_id_idx",
  "offer_discount_entitlements_merchant_id_idx",
  // The only entitlement-leading index on offer_pass_scan_tokens is partial
  // (offer_pass_scan_tokens_reusable_idx: where consumed_at is null), so the
  // entitlement_id FK needs a complete index to cover consumed rows too.
  "offer_pass_scan_tokens_consumed_by_merchant_id_idx",
  "offer_pass_scan_tokens_customer_id_idx",
  "offer_pass_scan_tokens_entitlement_id_idx",
  "offer_pass_scan_tokens_membership_id_idx",
  "offer_pass_scan_tokens_merchant_id_idx",
  "offer_redemptions_campaign_id_idx",
  "offer_redemptions_customer_id_idx",
  "offer_redemptions_entitlement_id_idx",
  "offer_redemptions_membership_id_idx",
  "offer_redemptions_merchant_id_idx",
  "referrals_qualifying_stamp_id_idx",
  "referrals_referred_customer_id_idx",
  "referrals_referrer_customer_id_idx",
  "referrals_referrer_stamp_event_id_idx",
])

after(closeDb)

test("later-added foreign keys retain their support indexes", async (t) => {
  if (!(await isLiveDbReady())) return t.skip("no live DB")

  const rows = await db()`
    select indexname
    from pg_indexes
    where schemaname = 'public'
      and indexname = any(${expectedIndexes})
    order by indexname`

  assert.deepEqual(
    rows.map((row) => row.indexname),
    [...expectedIndexes].sort(),
    "all later-added FK support indexes must exist"
  )
})
