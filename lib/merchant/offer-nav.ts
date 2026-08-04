/**
 * Canonical destinations for the merchant Offers surface, plus the origin-aware
 * return helpers shared by the offer server actions.
 *
 * Pausing, resuming, ending and rotating the link are all posted from two
 * places: the Offers hub at `/app/offers` and the full-screen campaign QR at
 * `/app/offers/<id>/qr`. Each posts its own path as a hidden `returnTo` field so
 * the action sends the merchant back to the screen they acted from instead of
 * always bouncing them to the hub.
 *
 * `returnTo` is user-controllable, so actions must resolve it through
 * {@link resolveOfferReturnBase}. Only an allowlisted internal path is ever
 * returned — the posted value itself is never reflected into a redirect, so
 * there is no open-redirect surface. The campaign QR path carries an id, so it
 * is matched by shape rather than by set membership.
 */
export const OFFERS_HOME_PATH = "/app/offers"
export const OFFERS_NEW_PATH = "/app/offers/new"

/** `/app/offers/<uuid>/qr` — the only id-bearing offer return base. */
const OFFER_CAMPAIGN_QR_PATTERN =
  /^\/app\/offers\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/qr$/i

const OFFER_RETURN_ALLOWLIST: ReadonlySet<string> = new Set([
  OFFERS_HOME_PATH,
  OFFERS_NEW_PATH,
])

/** Resolve a posted `returnTo` value to an allowlisted internal path. */
export function resolveOfferReturnBase(
  value: FormDataEntryValue | null
): string {
  if (typeof value !== "string") return OFFERS_HOME_PATH
  if (OFFER_RETURN_ALLOWLIST.has(value)) return value
  return OFFER_CAMPAIGN_QR_PATTERN.test(value) ? value : OFFERS_HOME_PATH
}

/** The full-screen QR path for one campaign. */
export function offerCampaignQrPath(campaignId: string): string {
  return `${OFFERS_HOME_PATH}/${encodeURIComponent(campaignId)}/qr`
}

/**
 * Append a pre-encoded query string to a base that may already carry one, so
 * the actions can add a status flag without knowing which screen they came
 * from.
 */
export function offerReturnHref(base: string, query?: string): string {
  if (!query) return base
  return `${base}${base.includes("?") ? "&" : "?"}${query}`
}
