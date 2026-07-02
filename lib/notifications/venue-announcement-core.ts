import { createHash } from "node:crypto"

import { pushMarketingConsentCustomerIds } from "@/lib/notifications/push-marketing-eligibility-core"

export type VenueAnnouncementMembership = {
  readonly id: string
  readonly customerId: string
}

export type VenueAnnouncementTextError =
  | "invalid_title"
  | "invalid_body"
  | "moderation_rejected"

export type VenueAnnouncementTextResult =
  | { readonly ok: true; readonly title: string; readonly body: string }
  | { readonly ok: false; readonly error: VenueAnnouncementTextError }

export type VenueAnnouncementAudienceInput = {
  readonly memberships: readonly VenueAnnouncementMembership[]
  readonly preferences: unknown
  readonly subscriptions: unknown
  readonly consents: unknown
}

export type VenueAnnouncementDedupeInput = {
  readonly merchantId: string
  readonly customerId: string
  readonly title: string
  readonly body: string
}

export type VenueAnnouncementDailyLimitInput = {
  readonly merchantId: string
  readonly businessDate: string
}

export const VENUE_ANNOUNCEMENT_DAILY_LIMIT = 2
export const VENUE_ANNOUNCEMENT_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000

export function validateVenueAnnouncementText(input: {
  readonly title: unknown
  readonly body: unknown
}): VenueAnnouncementTextResult {
  const title = cleanText(input.title, 80)
  const body = cleanText(input.body, 180)

  if (title.length < 3) return { ok: false, error: "invalid_title" }
  if (body.length < 10) return { ok: false, error: "invalid_body" }
  if (!isModerationSafeAnnouncementText(title, body)) {
    return { ok: false, error: "moderation_rejected" }
  }

  return { ok: true, title, body }
}

export function normalizeVenueAnnouncementMemberships(
  value: unknown
): readonly VenueAnnouncementMembership[] {
  const memberships: VenueAnnouncementMembership[] = []

  for (const row of recordRows(value)) {
    const id = stringValue(row.id)
    const customerId = stringValue(row.customer_id)
    if (id && customerId) {
      memberships.push({ id, customerId })
    }
  }

  return memberships
}

export function resolveVenueAnnouncementAudienceCustomerIds(
  input: VenueAnnouncementAudienceInput
) {
  const enabledPreference = marketingPreferenceCustomerIds(input.preferences)
  const enabledSubscription = subscriptionCustomerIds(input.subscriptions)
  const consentAllowed = pushMarketingConsentCustomerIds(
    recordRows(input.consents)
  )
  const audience = new Set<string>()
  const seen = new Set<string>()

  for (const membership of input.memberships) {
    const customerId = membership.customerId
    if (seen.has(customerId)) continue
    seen.add(customerId)

    if (
      enabledPreference.has(customerId) &&
      enabledSubscription.has(customerId) &&
      consentAllowed.has(customerId)
    ) {
      audience.add(customerId)
    }
  }

  return audience
}

export function venueAnnouncementDedupeKey(
  input: VenueAnnouncementDedupeInput
) {
  const digest = createHash("sha256")
    .update(`${input.merchantId}:${input.title}:${input.body}`)
    .digest("hex")
    .slice(0, 16)

  return `venue_announcement:${input.merchantId}:${input.customerId}:${digest}`
}

export function venueAnnouncementDailyLimitKey(
  input: VenueAnnouncementDailyLimitInput
) {
  return `venue-announcement:${input.merchantId}:${input.businessDate}`
}

function marketingPreferenceCustomerIds(value: unknown) {
  const customerIds = new Set<string>()

  for (const row of recordRows(value)) {
    const customerId = stringValue(row.customer_id)
    if (customerId && row.marketing_enabled === true) {
      customerIds.add(customerId)
    }
  }

  return customerIds
}

function subscriptionCustomerIds(value: unknown) {
  const customerIds = new Set<string>()

  for (const row of recordRows(value)) {
    const customerId = stringValue(row.customer_id)
    if (customerId) {
      customerIds.add(customerId)
    }
  }

  return customerIds
}

function recordRows(value: unknown): readonly Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []
  if (!Array.isArray(value)) return rows

  for (const item of value) {
    if (isRecord(item)) {
      rows.push(item)
    }
  }

  return rows
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}

function cleanText(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, limit)
    : ""
}

const unsafeAnnouncementPatterns = [
  /https?:\/\//i,
  /\bwww\./i,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  /\b(?:password|passcode|bank details?|card details?|payment link|claim now)\b/i,
  /\bverify (?:your )?(?:account|card|payment)\b/i,
] as const

function isModerationSafeAnnouncementText(title: string, body: string) {
  const text = `${title} ${body}`

  return (
    !unsafeAnnouncementPatterns.some((pattern) => pattern.test(text)) &&
    !hasPhoneLikeNumber(text)
  )
}

function hasPhoneLikeNumber(value: string) {
  const phoneLikeMatches = value.match(/[+\d][\d\s().-]{8,}\d/g) ?? []

  return phoneLikeMatches.some((match) => match.replace(/\D/g, "").length >= 10)
}
