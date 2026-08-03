import {
  validateOfferCampaignDraft,
  type OfferCampaignDraft,
  type OfferCampaignDraftErrors,
} from "@/lib/offers/campaign-core"

/**
 * Pure validation for the merchant "Create an offer" form (no server-only, no
 * Supabase — unit-tested directly). Mirrors lib/merchant/loyalty-invite-fields.ts:
 * this module only turns raw form strings into the typed shape the pure rules in
 * lib/offers/campaign-core.ts expect, so there is exactly one place where a
 * benefit bound or a window length is decided.
 */

export const OFFER_CAMPAIGN_DRAFT_SUCCESS =
  "Offer saved. Check the details, then publish when you're ready."

export const OFFER_CAMPAIGN_PUBLISH_SUCCESS =
  "Your offer is published. Print the poster and put it where customers will see it."

export const OFFER_CAMPAIGN_SCHEDULED_SUCCESS =
  "Your offer is scheduled. It opens on its start date."

/** Always shown to the customer and to staff; merchants cannot edit it away. */
export const OFFER_NO_STACKING_TERM =
  "This offer cannot be used with any other offer or discount."

export type OfferCampaignFormFields = {
  readonly name: string
  readonly customerDescription: string
  readonly benefitKind: string
  readonly bonusStampCount: string
  readonly discountPercent: string
  readonly startsOn: string
  readonly endsOn: string
  readonly requiresIdCheck: boolean
  readonly extraTerms: string
}

export type OfferCampaignFieldsContext = {
  /** The venue's active card length — the bonus-stamp ceiling comes from it. */
  readonly stampsRequired: number
  /** Today's UK date as `YYYY-MM-DD`. */
  readonly today: string
}

export type OfferCampaignFieldsResult =
  | { readonly ok: true; readonly draft: OfferCampaignDraft }
  | { readonly ok: false; readonly errors: OfferCampaignDraftErrors }

export function validateOfferCampaignFields(
  fields: OfferCampaignFormFields,
  context: OfferCampaignFieldsContext
): OfferCampaignFieldsResult {
  return validateOfferCampaignDraft({
    name: fields.name,
    customerDescription: fields.customerDescription,
    benefitKind: fields.benefitKind.trim(),
    bonusStampCount: wholeNumberOrNull(fields.bonusStampCount),
    discountPercent: wholeNumberOrNull(fields.discountPercent),
    startsOn: fields.startsOn,
    endsOn: fields.endsOn,
    requiresIdCheck: fields.requiresIdCheck,
    extraTerms: fields.extraTerms,
    stampsRequired: context.stampsRequired,
    today: context.today,
  })
}

/** Read the form fields off a posted body without trusting any of them. */
export function readOfferCampaignFields(
  form: Pick<FormData, "get">
): OfferCampaignFormFields {
  return {
    name: textField(form, "name"),
    customerDescription: textField(form, "customerDescription"),
    benefitKind: textField(form, "benefitKind"),
    bonusStampCount: textField(form, "bonusStampCount"),
    discountPercent: textField(form, "discountPercent"),
    startsOn: textField(form, "startsOn"),
    endsOn: textField(form, "endsOn"),
    requiresIdCheck: textField(form, "requiresIdCheck") === "on",
    extraTerms: textField(form, "extraTerms"),
  }
}

function textField(form: Pick<FormData, "get">, name: string): string {
  const value = form.get(name)
  return typeof value === "string" ? value : ""
}

/**
 * Only a plain whole number counts. An empty box, a decimal or anything with
 * stray characters becomes null so the bound checks report the field rather
 * than silently rounding a merchant's intent.
 */
function wholeNumberOrNull(raw: string): number | null {
  const value = raw.trim()
  if (!/^\d+$/.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}
