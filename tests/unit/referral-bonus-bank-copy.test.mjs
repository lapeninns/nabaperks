import assert from "node:assert/strict"
import { test } from "node:test"

import {
  REFERRAL_BONUS_DAILY_CAP,
  referralBonusBankCopy,
} from "@/lib/customer/referral-bonus-bank-copy"

test("bank copy explains the venue stamp lands before available referral bonuses", () => {
  const copy = referralBonusBankCopy({ banked: 3, awardedToday: 0 })

  assert.equal(REFERRAL_BONUS_DAILY_CAP, 2)
  assert.equal(copy.headline, "3 referral bonuses banked")
  assert.equal(copy.badgeLabel, "0 / 2 today")
  assert.equal(copy.stats[0]?.label, "Banked")
  assert.equal(copy.stats[0]?.value, "3")
  assert.equal(copy.stats[2]?.label, "Next scan")
  assert.equal(copy.stats[2]?.value, "2")
  assert.equal(
    copy.detail,
    "Your venue stamp lands first. Then 2 banked referral bonuses can be added today; 1 stays banked."
  )
  assert.equal(
    copy.compactDetail,
    "Venue stamp first, then 2 bonus stamps today; 1 stays banked."
  )
  assert.equal(
    copy.ruleSummary,
    "Venue stamp first. Up to 2 referral bonus stamps can land per UK business day; the rest stay banked."
  )
})

test("bank copy shows no referral bonuses apply when the daily cap is already used", () => {
  const copy = referralBonusBankCopy({ banked: 3, awardedToday: 2 })

  assert.equal(copy.headline, "3 referral bonuses banked")
  assert.equal(copy.badgeLabel, "2 / 2 today")
  assert.equal(copy.stats[2]?.value, "0")
  assert.equal(
    copy.detail,
    "Your venue stamp can still land today. Referral bonus limit is full, so these stay banked for another UK business day."
  )
  assert.equal(
    copy.compactDetail,
    "Venue stamp can still land; bonuses stay banked after 2 today."
  )
  assert.equal(
    copy.ruleSummary,
    "Venue stamp first. Up to 2 referral bonus stamps can land per UK business day; the rest stay banked."
  )
})

test("bank copy distinguishes applied bonuses when nothing is waiting", () => {
  const copy = referralBonusBankCopy({ banked: 0, awardedToday: 1 })

  assert.equal(copy.headline, "1 referral bonus applied today")
  assert.equal(copy.badgeLabel, "1 / 2 today")
  assert.equal(
    copy.detail,
    "You still keep your venue stamp separately. Referral bonuses are capped at 2 per UK business day."
  )
  assert.equal(
    copy.compactDetail,
    "Venue stamps are separate. Referral bonus limit: 2 per UK business day."
  )
  assert.equal(
    copy.ruleSummary,
    "Venue stamps stay separate from the 2-per-day referral bonus limit."
  )
})
