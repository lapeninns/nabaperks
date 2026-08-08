import {
  OFFER_BONUS_STAMP_MAX,
  OFFER_BONUS_STAMP_MIN,
  OFFER_CAMPAIGN_MAX_DURATION_DAYS,
  OFFER_DISCOUNT_PERCENT_MAX,
  OFFER_DISCOUNT_PERCENT_MIN,
  isOfferBenefitKind,
  type OfferBenefitKind,
} from "@/lib/offers/constants"

/**
 * Pure rules for an offer campaign draft: which benefit values the chosen
 * preset requires, how long a window may run, and how the free-text terms are
 * bounded. No `server-only` and no Supabase, so the merchant form, the server
 * action and the unit tests all share one implementation.
 *
 * The database CHECK constraints remain the last word; these rules exist so a
 * merchant sees a sentence rather than a constraint violation, and they must
 * move in step with those migrations — 20260803100000 for the column shapes,
 * 20260808120000 for the window ceiling.
 */

/** Longest terms a merchant may add, mirroring the extra_terms CHECK. */
export const OFFER_EXTRA_TERMS_MAX_LENGTH = 500

/**
 * Longest campaign name, mirroring the `name` CHECK in 20260803100600. Short
 * enough to sit on one line of a poster hero and in the merchant's own list.
 */
export const OFFER_CAMPAIGN_NAME_MAX_LENGTH = 60

/**
 * Longest customer-facing description, mirroring the `customer_description`
 * CHECK in 20260803100600. A sentence or two, not a terms page — the terms have
 * their own field.
 */
export const OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH = 160

/**
 * The highest bonus grant a card can carry. The grant must never complete a
 * card on its own, so the ceiling is one stamp short of a reward, capped by the
 * column CHECK. A card requiring a single stamp has no valid grant at all and
 * yields zero.
 */
export function maxBonusStampCount(stampsRequired: number): number {
  if (!Number.isInteger(stampsRequired) || stampsRequired < 2) return 0
  return Math.min(stampsRequired - 1, OFFER_BONUS_STAMP_MAX)
}

/** Which values a preset requires. Anything else is dropped, never persisted. */
export function offerBenefitRequires(kind: OfferBenefitKind): {
  readonly bonusStamps: boolean
  readonly discount: boolean
} {
  return {
    bonusStamps: kind === "bonus_stamps" || kind === "both",
    discount: kind === "discount" || kind === "both",
  }
}

/**
 * Inclusive length of a campaign window in days: a single-day campaign is 1,
 * and the SQL rule `ends_on <= starts_on + coalesce(max_window_days, 366) - 1`
 * is the same as `max_window_days` here, so the 366 default matches this
 * module's ceiling. Returns null when either date is not a real calendar date.
 */
export function campaignWindowDays(
  startsOn: string,
  endsOn: string
): number | null {
  const start = parseIsoDate(startsOn)
  const end = parseIsoDate(endsOn)
  if (start === null || end === null) return null
  return Math.round((end - start) / 86_400_000) + 1
}

/** UTC midnight epoch for a strict `YYYY-MM-DD`, or null when it is not one. */
export function parseIsoDate(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const [, year, month, day] = match
  const stamp = Date.UTC(Number(year), Number(month) - 1, Number(day))
  const date = new Date(stamp)
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null
  }
  return stamp
}

export type OfferCampaignDraft = {
  /** Merchant-authored campaign name, shown to the customer too. */
  readonly name: string
  /** One or two sentences the customer reads on the claim landing. */
  readonly customerDescription: string
  readonly benefitKind: OfferBenefitKind
  readonly bonusStampCount: number | null
  readonly discountPercent: number | null
  readonly startsOn: string
  readonly endsOn: string
  readonly requiresIdCheck: boolean
  readonly extraTerms: string | null
}

export type OfferCampaignDraftInput = {
  readonly name: string
  readonly customerDescription: string
  readonly benefitKind: string
  readonly bonusStampCount: number | null
  readonly discountPercent: number | null
  readonly startsOn: string
  readonly endsOn: string
  readonly requiresIdCheck: boolean
  readonly extraTerms: string | null
  /** The venue's active card length, used for the bonus-stamp ceiling. */
  readonly stampsRequired: number
  /** Today's UK business date as `YYYY-MM-DD`, injected to keep this pure. */
  readonly today: string
}

export type OfferCampaignDraftErrors = {
  name?: string
  customerDescription?: string
  benefitKind?: string
  bonusStampCount?: string
  discountPercent?: string
  startsOn?: string
  endsOn?: string
  extraTerms?: string
}

export type OfferCampaignDraftResult =
  | { readonly ok: true; readonly draft: OfferCampaignDraft }
  | { readonly ok: false; readonly errors: OfferCampaignDraftErrors }

/**
 * Validate and normalise a draft. On success the returned draft carries only
 * the values the chosen preset uses — a discount typed before the merchant
 * switched to "bonus stamps only" is dropped rather than rejected, so the
 * database can never receive a benefit the merchant did not choose.
 *
 * The name and the description are merchant-authored free text that customers
 * read, so both are trimmed and bounded here as well as in the database. They
 * are stored and rendered as text; no surface in this feature interprets
 * merchant copy as markup.
 */
export function validateOfferCampaignDraft(
  input: OfferCampaignDraftInput
): OfferCampaignDraftResult {
  if (!isOfferBenefitKind(input.benefitKind)) {
    return {
      ok: false,
      errors: { benefitKind: "Choose what this offer gives." },
    }
  }

  const kind = input.benefitKind
  const requires = offerBenefitRequires(kind)
  const errors: OfferCampaignDraftErrors = {
    ...identityErrors(input),
    ...benefitErrors(input, requires),
    ...windowErrors(input),
  }

  const terms = (input.extraTerms ?? "").trim()
  if (terms.length > OFFER_EXTRA_TERMS_MAX_LENGTH) {
    errors.extraTerms = `Additional terms must be ${OFFER_EXTRA_TERMS_MAX_LENGTH} characters or fewer.`
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }

  return {
    ok: true,
    draft: {
      name: input.name.trim(),
      customerDescription: input.customerDescription.trim(),
      benefitKind: kind,
      bonusStampCount: requires.bonusStamps ? input.bonusStampCount : null,
      discountPercent: requires.discount ? input.discountPercent : null,
      startsOn: input.startsOn.trim(),
      endsOn: input.endsOn.trim(),
      requiresIdCheck: input.requiresIdCheck,
      extraTerms: terms === "" ? null : terms,
    },
  }
}

/**
 * The campaign's own words. Both are required: the name is how the merchant and
 * the customer both refer to the offer, and the description is the sentence the
 * customer reads before deciding to claim, so an offer with neither would reach
 * a poster unnamed and unexplained.
 */
function identityErrors(
  input: OfferCampaignDraftInput
): OfferCampaignDraftErrors {
  const errors: OfferCampaignDraftErrors = {}
  const name = input.name.trim()
  const description = input.customerDescription.trim()

  if (name === "") {
    errors.name = "Give this offer a name."
  } else if (name.length > OFFER_CAMPAIGN_NAME_MAX_LENGTH) {
    errors.name = `The name must be ${OFFER_CAMPAIGN_NAME_MAX_LENGTH} characters or fewer.`
  }

  if (description === "") {
    errors.customerDescription =
      "Write a short line telling customers what this offer is."
  } else if (description.length > OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH) {
    errors.customerDescription = `The description must be ${OFFER_CAMPAIGN_DESCRIPTION_MAX_LENGTH} characters or fewer.`
  }

  return errors
}

function benefitErrors(
  input: OfferCampaignDraftInput,
  requires: { readonly bonusStamps: boolean; readonly discount: boolean }
): OfferCampaignDraftErrors {
  const errors: OfferCampaignDraftErrors = {}
  const ceiling = maxBonusStampCount(input.stampsRequired)

  if (requires.bonusStamps) {
    const stamps = input.bonusStampCount
    if (ceiling < OFFER_BONUS_STAMP_MIN) {
      errors.bonusStampCount =
        "This card is too short to give bonus stamps. Lengthen the card or choose the discount instead."
    } else if (
      stamps === null ||
      !Number.isInteger(stamps) ||
      stamps < OFFER_BONUS_STAMP_MIN ||
      stamps > ceiling
    ) {
      errors.bonusStampCount = `Choose between ${OFFER_BONUS_STAMP_MIN} and ${ceiling} bonus stamps.`
    }
  }

  if (requires.discount) {
    const percent = input.discountPercent
    if (
      percent === null ||
      !Number.isInteger(percent) ||
      percent < OFFER_DISCOUNT_PERCENT_MIN ||
      percent > OFFER_DISCOUNT_PERCENT_MAX
    ) {
      errors.discountPercent = `Choose a discount between ${OFFER_DISCOUNT_PERCENT_MIN}% and ${OFFER_DISCOUNT_PERCENT_MAX}%.`
    }
  }

  return errors
}

function windowErrors(
  input: OfferCampaignDraftInput
): OfferCampaignDraftErrors {
  const errors: OfferCampaignDraftErrors = {}
  const start = parseIsoDate(input.startsOn)
  const end = parseIsoDate(input.endsOn)
  const today = parseIsoDate(input.today)

  if (start === null) errors.startsOn = "Choose a start date."
  if (end === null) errors.endsOn = "Choose an end date."
  if (start === null || end === null) return errors

  if (end < start) {
    errors.endsOn = "The end date cannot be before the start date."
    return errors
  }
  if (today !== null && end < today) {
    errors.endsOn = "Choose an end date that has not already passed."
    return errors
  }

  const days = campaignWindowDays(input.startsOn, input.endsOn)
  if (days !== null && days > OFFER_CAMPAIGN_MAX_DURATION_DAYS) {
    errors.endsOn = `An offer can run for at most ${OFFER_CAMPAIGN_MAX_DURATION_DAYS} days.`
  }

  return errors
}
