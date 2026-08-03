import assert from "node:assert/strict"
import { afterEach, test } from "node:test"

import { isOfferCampaignsEnabled } from "@/lib/offers/access"
import {
  OFFER_BENEFIT_KINDS,
  OFFER_BONUS_STAMP_MAX,
  OFFER_BONUS_STAMP_MIN,
  OFFER_CAMPAIGN_MAX_DURATION_DAYS,
  OFFER_CAMPAIGN_STATUSES,
  OFFER_DISCOUNT_PERCENT_MAX,
  OFFER_DISCOUNT_PERCENT_MIN,
  OFFER_PASS_SCAN_TOKEN_TTL_MS,
  OFFER_STAMP_SOURCE,
  isOfferBenefitKind,
  isOfferCampaignStatus,
} from "@/lib/offers/constants"

const FLAG_ENV = "NABAPERKS_FEATURE_MERCHANT_OFFER_CAMPAIGNS"

function setFlag(value) {
  if (value === undefined) {
    delete process.env[FLAG_ENV]
    return
  }
  process.env[FLAG_ENV] = value
}

afterEach(() => {
  setFlag(undefined)
})

test("Given the flag is off and the venue is not allowlisted When the gate is read Then offers stay hidden", () => {
  setFlag("false")

  assert.equal(isOfferCampaignsEnabled(false), false)
})

test("Given the flag is on but the venue is not allowlisted When the gate is read Then offers stay hidden", () => {
  setFlag("true")

  assert.equal(isOfferCampaignsEnabled(false), false)
})

test("Given the flag is off but the venue is allowlisted When the gate is read Then offers stay hidden", () => {
  setFlag("false")

  assert.equal(isOfferCampaignsEnabled(true), false)
})

test("Given the flag is on and the venue is allowlisted When the gate is read Then offers are available", () => {
  setFlag("true")

  assert.equal(isOfferCampaignsEnabled(true), true)
})

test("Given no override is set When the gate is read Then the default-off flag keeps offers hidden", () => {
  setFlag(undefined)

  assert.equal(isOfferCampaignsEnabled(true), false)
})

test("Given a non-boolean override When the gate is read Then it fails closed", () => {
  setFlag("sometimes")

  assert.equal(isOfferCampaignsEnabled(true), false)
})

test("Given the campaign vocabularies When they are read Then they mirror the database CHECK constraints", () => {
  assert.deepEqual(OFFER_CAMPAIGN_STATUSES, [
    "draft",
    "scheduled",
    "live",
    "paused",
    "ended",
  ])
  assert.deepEqual(OFFER_BENEFIT_KINDS, ["bonus_stamps", "discount", "both"])
  assert.equal(OFFER_STAMP_SOURCE, "offer_campaign")
})

test("Given an arbitrary value When the campaign guards narrow it Then only registry members pass", () => {
  assert.equal(isOfferCampaignStatus("live"), true)
  assert.equal(isOfferCampaignStatus("sending"), false)
  assert.equal(isOfferCampaignStatus(null), false)
  assert.equal(isOfferBenefitKind("discount"), true)
  assert.equal(isOfferBenefitKind("free_drink"), false)
  assert.equal(isOfferBenefitKind(25), false)
})

test("Given the discount bounds When they are read Then they span one to twenty-five per cent", () => {
  assert.equal(OFFER_DISCOUNT_PERCENT_MIN, 1)
  assert.equal(OFFER_DISCOUNT_PERCENT_MAX, 25)
  assert.ok(OFFER_DISCOUNT_PERCENT_MIN < OFFER_DISCOUNT_PERCENT_MAX)
})

test("Given the bonus stamp bounds When they are read Then they stay inside the card-length ceiling", () => {
  assert.equal(OFFER_BONUS_STAMP_MIN, 1)
  assert.equal(OFFER_BONUS_STAMP_MAX, 98)
  // A loyalty card allows 1..99 stamps, so the largest possible bonus award has
  // to leave at least one stamp for the customer to earn.
  assert.equal(OFFER_BONUS_STAMP_MAX, 99 - 1)
})

test("Given the campaign window ceiling When it is read Then it is 366 inclusive days", () => {
  assert.equal(OFFER_CAMPAIGN_MAX_DURATION_DAYS, 366)
})

test("Given the pass scan token TTL When it is read Then it matches the ten-minute SQL default", () => {
  assert.equal(OFFER_PASS_SCAN_TOKEN_TTL_MS, 600_000)
  assert.equal(OFFER_PASS_SCAN_TOKEN_TTL_MS, 10 * 60 * 1000)
})
