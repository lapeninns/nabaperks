import assert from "node:assert/strict"
import { test } from "node:test"

import {
  OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH,
  OFFER_CAMPAIGN_NAME_MAX_LENGTH,
  OFFER_EXTRA_TERMS_MAX_LENGTH,
  campaignWindowDays,
  maxBonusStampCount,
  offerBenefitRequires,
  parseIsoDate,
  validateOfferCampaignDraft,
} from "@/lib/offers/campaign-core"
import {
  OFFER_CAMPAIGN_STATUSES,
  isNonTerminalOfferStatus,
  isOfferCampaignStatus,
} from "@/lib/offers/constants"
import {
  validateOfferCampaignFields,
  readOfferCampaignFields,
} from "@/lib/merchant/offer-campaign-fields"

const TODAY = "2026-08-03"

function draftInput(overrides = {}) {
  return {
    name: "Summer welcome",
    customerDescription: "Join us this summer and start your card ahead.",
    benefitKind: "both",
    bonusStampCount: 2,
    discountPercent: 10,
    startsOn: "2026-08-03",
    endsOn: "2026-09-03",
    requiresIdCheck: false,
    extraTerms: null,
    stampsRequired: 6,
    today: TODAY,
    ...overrides,
  }
}

function expectErrors(result) {
  assert.equal(result.ok, false)
  return result.errors
}

function expectDraft(result) {
  assert.equal(result.ok, true, JSON.stringify(result.errors ?? {}))
  return result.draft
}

test("Given a complete draft When it is validated Then the normalised identity, benefit, window and terms come back", () => {
  const draft = expectDraft(
    validateOfferCampaignDraft(
      draftInput({
        name: "  Summer welcome  ",
        customerDescription: "  Two stamps and 10% off when you join.  ",
        extraTerms: "  Food only.  ",
        requiresIdCheck: true,
      })
    )
  )

  assert.deepEqual(draft, {
    name: "Summer welcome",
    customerDescription: "Two stamps and 10% off when you join.",
    benefitKind: "both",
    bonusStampCount: 2,
    discountPercent: 10,
    startsOn: "2026-08-03",
    endsOn: "2026-09-03",
    requiresIdCheck: true,
    extraTerms: "Food only.",
  })
})

test("Given the bonus-stamps preset When a discount is still on the form Then it is dropped rather than persisted", () => {
  const draft = expectDraft(
    validateOfferCampaignDraft(
      draftInput({ benefitKind: "bonus_stamps", discountPercent: 20 })
    )
  )

  assert.equal(draft.bonusStampCount, 2)
  assert.equal(draft.discountPercent, null)
})

test("Given the discount preset When bonus stamps are still on the form Then they are dropped rather than persisted", () => {
  const draft = expectDraft(
    validateOfferCampaignDraft(
      draftInput({ benefitKind: "discount", bonusStampCount: 3 })
    )
  )

  assert.equal(draft.bonusStampCount, null)
  assert.equal(draft.discountPercent, 10)
})

test("Given each preset When its requirements are read Then only the chosen values are demanded", () => {
  assert.deepEqual(offerBenefitRequires("bonus_stamps"), {
    bonusStamps: true,
    discount: false,
  })
  assert.deepEqual(offerBenefitRequires("discount"), {
    bonusStamps: false,
    discount: true,
  })
  assert.deepEqual(offerBenefitRequires("both"), {
    bonusStamps: true,
    discount: true,
  })
})

test("Given an unknown benefit preset When the draft is validated Then the preset itself is reported", () => {
  const errors = expectErrors(
    validateOfferCampaignDraft(draftInput({ benefitKind: "free_drinks" }))
  )

  assert.ok(errors.benefitKind)
  assert.equal(errors.bonusStampCount, undefined)
})

test("Given the bonus preset When the count is missing or below one Then it is refused", () => {
  for (const bonusStampCount of [null, 0, -1]) {
    const errors = expectErrors(
      validateOfferCampaignDraft(
        draftInput({ benefitKind: "bonus_stamps", bonusStampCount })
      )
    )
    assert.ok(
      errors.bonusStampCount,
      `expected a refusal for ${bonusStampCount}`
    )
  }
})

test("Given a six-stamp card When bonus stamps are chosen Then the ceiling is stamps_required minus one", () => {
  assert.equal(maxBonusStampCount(6), 5)

  const accepted = expectDraft(
    validateOfferCampaignDraft(
      draftInput({
        benefitKind: "bonus_stamps",
        bonusStampCount: 5,
        stampsRequired: 6,
      })
    )
  )
  assert.equal(accepted.bonusStampCount, 5)

  const errors = expectErrors(
    validateOfferCampaignDraft(
      draftInput({
        benefitKind: "bonus_stamps",
        bonusStampCount: 6,
        stampsRequired: 6,
      })
    )
  )
  assert.match(errors.bonusStampCount, /between 1 and 5/)
})

test("Given a one-stamp card When bonus stamps are chosen Then the card is reported as too short", () => {
  assert.equal(maxBonusStampCount(1), 0)

  const errors = expectErrors(
    validateOfferCampaignDraft(
      draftInput({
        benefitKind: "bonus_stamps",
        bonusStampCount: 1,
        stampsRequired: 1,
      })
    )
  )
  assert.match(errors.bonusStampCount, /too short/)
})

test("Given the longest possible card When the ceiling is read Then the column bound still caps it", () => {
  assert.equal(maxBonusStampCount(99), 98)
  assert.equal(maxBonusStampCount(2), 1)
  assert.equal(maxBonusStampCount(0), 0)
  assert.equal(maxBonusStampCount(6.5), 0)
})

test("Given a discount When it sits outside one to twenty-five per cent Then it is refused", () => {
  for (const discountPercent of [null, 0, 26, 100, 10.5]) {
    const errors = expectErrors(
      validateOfferCampaignDraft(
        draftInput({ benefitKind: "discount", discountPercent })
      )
    )
    assert.ok(
      errors.discountPercent,
      `expected a refusal for ${discountPercent}`
    )
  }

  for (const discountPercent of [1, 25]) {
    const draft = expectDraft(
      validateOfferCampaignDraft(
        draftInput({ benefitKind: "discount", discountPercent })
      )
    )
    assert.equal(draft.discountPercent, discountPercent)
  }
})

test("Given a window When its length is counted Then both end days are included", () => {
  assert.equal(campaignWindowDays("2026-08-03", "2026-08-03"), 1)
  assert.equal(campaignWindowDays("2026-01-01", "2026-12-31"), 365)
  assert.equal(campaignWindowDays("2026-01-01", "2027-01-01"), 366)
  // 2028 is a leap year, so the same calendar span is one day longer.
  assert.equal(campaignWindowDays("2028-01-01", "2028-12-31"), 366)
  assert.equal(campaignWindowDays("2026-08-03", "not-a-date"), null)
})

test("Given a window of exactly 366 days When the draft is validated Then it is accepted", () => {
  const draft = expectDraft(
    validateOfferCampaignDraft(
      draftInput({ startsOn: "2026-08-03", endsOn: "2027-08-03" })
    )
  )

  assert.equal(campaignWindowDays(draft.startsOn, draft.endsOn), 366)
})

test("Given a window one day too long When the draft is validated Then the end date is refused", () => {
  const errors = expectErrors(
    validateOfferCampaignDraft(
      draftInput({ startsOn: "2026-08-03", endsOn: "2027-08-04" })
    )
  )

  assert.match(errors.endsOn, /at most 366 days/)
})

test("Given an end date before the start When the draft is validated Then the order is reported", () => {
  const errors = expectErrors(
    validateOfferCampaignDraft(
      draftInput({ startsOn: "2026-09-03", endsOn: "2026-08-03" })
    )
  )

  assert.match(errors.endsOn, /before the start date/)
})

test("Given a window that has already closed When the draft is validated Then the end date is refused", () => {
  const errors = expectErrors(
    validateOfferCampaignDraft(
      draftInput({ startsOn: "2026-07-01", endsOn: "2026-08-02" })
    )
  )

  assert.match(errors.endsOn, /already passed/)
})

test("Given a window that ends today When the draft is validated Then it is still accepted", () => {
  const draft = expectDraft(
    validateOfferCampaignDraft(
      draftInput({ startsOn: "2026-07-01", endsOn: TODAY })
    )
  )

  assert.equal(draft.endsOn, TODAY)
})

test("Given a date that is not a real calendar day When it is parsed Then it is rejected", () => {
  assert.equal(parseIsoDate("2026-02-30"), null)
  assert.equal(parseIsoDate("2026-13-01"), null)
  assert.equal(parseIsoDate("03/08/2026"), null)
  assert.equal(parseIsoDate("2026-8-3"), null)
  assert.equal(parseIsoDate(" 2026-08-03 "), Date.UTC(2026, 7, 3))

  const errors = expectErrors(
    validateOfferCampaignDraft(draftInput({ startsOn: "2026-02-30" }))
  )
  assert.ok(errors.startsOn)
})

test("Given additional terms When they exceed the stored maximum Then they are refused", () => {
  const errors = expectErrors(
    validateOfferCampaignDraft(
      draftInput({ extraTerms: "a".repeat(OFFER_EXTRA_TERMS_MAX_LENGTH + 1) })
    )
  )
  assert.match(errors.extraTerms, /500 characters or fewer/)

  const draft = expectDraft(
    validateOfferCampaignDraft(
      draftInput({ extraTerms: "a".repeat(OFFER_EXTRA_TERMS_MAX_LENGTH) })
    )
  )
  assert.equal(draft.extraTerms.length, OFFER_EXTRA_TERMS_MAX_LENGTH)
})

test("Given blank additional terms When the draft is validated Then they are stored as nothing at all", () => {
  const draft = expectDraft(
    validateOfferCampaignDraft(draftInput({ extraTerms: "   " }))
  )

  assert.equal(draft.extraTerms, null)
})

test("Given the lifecycle vocabulary When it is read Then scheduled sits between draft and live", () => {
  assert.deepEqual(OFFER_CAMPAIGN_STATUSES, [
    "draft",
    "scheduled",
    "live",
    "paused",
    "ended",
  ])
  assert.equal(isOfferCampaignStatus("scheduled"), true)
  assert.equal(isOfferCampaignStatus("sending"), false)
  assert.equal(isOfferCampaignStatus(3), false)

  for (const status of ["draft", "scheduled", "live", "paused"]) {
    assert.equal(isNonTerminalOfferStatus(status), true, status)
  }
  assert.equal(isNonTerminalOfferStatus("ended"), false)
})

test("Given raw form strings When the merchant fields are validated Then they reach the same rules", () => {
  const result = validateOfferCampaignFields(
    {
      name: " Sunday welcome ",
      customerDescription: " Two stamps and 15% off when you join us. ",
      benefitKind: " both ",
      bonusStampCount: "2",
      discountPercent: "15",
      startsOn: "2026-08-03",
      endsOn: "2026-09-03",
      requiresIdCheck: true,
      extraTerms: " Sunday roast only. ",
    },
    { stampsRequired: 6, today: TODAY }
  )

  assert.deepEqual(expectDraft(result), {
    name: "Sunday welcome",
    customerDescription: "Two stamps and 15% off when you join us.",
    benefitKind: "both",
    bonusStampCount: 2,
    discountPercent: 15,
    startsOn: "2026-08-03",
    endsOn: "2026-09-03",
    requiresIdCheck: true,
    extraTerms: "Sunday roast only.",
  })
})

test("Given a number that is not a whole count When the merchant fields are validated Then the field is reported", () => {
  for (const bonusStampCount of ["", "2.5", "two", "-1", " 3 4 "]) {
    const errors = expectErrors(
      validateOfferCampaignFields(
        {
          name: "Sunday welcome",
          customerDescription: "Two stamps when you join us.",
          benefitKind: "bonus_stamps",
          bonusStampCount,
          discountPercent: "",
          startsOn: "2026-08-03",
          endsOn: "2026-09-03",
          requiresIdCheck: false,
          extraTerms: "",
        },
        { stampsRequired: 6, today: TODAY }
      )
    )
    assert.ok(
      errors.bonusStampCount,
      `expected a refusal for "${bonusStampCount}"`
    )
  }
})

test("Given a posted form When the offer fields are read Then missing entries become empty strings", () => {
  const form = new FormData()
  form.set("benefitKind", "discount")
  form.set("discountPercent", "20")
  form.set("requiresIdCheck", "on")

  assert.deepEqual(readOfferCampaignFields(form), {
    name: "",
    customerDescription: "",
    benefitKind: "discount",
    bonusStampCount: "",
    discountPercent: "20",
    startsOn: "",
    endsOn: "",
    requiresIdCheck: true,
    extraTerms: "",
  })
})

test("Given a nameless or undescribed offer When the draft is validated Then both fields are reported", () => {
  const errors = expectErrors(
    validateOfferCampaignDraft(
      draftInput({ name: "   ", customerDescription: "" })
    )
  )

  assert.match(errors.name, /name/i)
  assert.match(errors.customerDescription, /short line/i)
})

test("Given identity copy longer than the stored maximum When the draft is validated Then it is refused", () => {
  const tooLongName = expectErrors(
    validateOfferCampaignDraft(
      draftInput({ name: "a".repeat(OFFER_CAMPAIGN_NAME_MAX_LENGTH + 1) })
    )
  )
  assert.match(
    tooLongName.name,
    new RegExp(`${OFFER_CAMPAIGN_NAME_MAX_LENGTH} characters or fewer`)
  )

  const tooLongDescription = expectErrors(
    validateOfferCampaignDraft(
      draftInput({
        customerDescription: "a".repeat(
          OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH + 1
        ),
      })
    )
  )
  assert.match(
    tooLongDescription.customerDescription,
    new RegExp(`${OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH} characters or fewer`)
  )

  // The bounds themselves are accepted, so the form and the column CHECK agree.
  const accepted = expectDraft(
    validateOfferCampaignDraft(
      draftInput({
        name: "a".repeat(OFFER_CAMPAIGN_NAME_MAX_LENGTH),
        customerDescription: "b".repeat(OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH),
      })
    )
  )
  assert.equal(accepted.name.length, OFFER_CAMPAIGN_NAME_MAX_LENGTH)
  assert.equal(
    accepted.customerDescription.length,
    OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH
  )
})

test("Given identity copy that is refused When the whole draft is validated Then the benefit and window are still reported", () => {
  const errors = expectErrors(
    validateOfferCampaignDraft(
      draftInput({
        name: "",
        customerDescription: "",
        benefitKind: "discount",
        discountPercent: 90,
      })
    )
  )

  assert.ok(errors.name)
  assert.ok(errors.customerDescription)
  assert.ok(errors.discountPercent)
})
