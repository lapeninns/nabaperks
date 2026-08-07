import type { ProductEventInput } from "@/lib/analytics/events"

/**
 * Referral health — the first-party ledger, mirrored to PostHog as counts.
 *
 * 20260805100300 replaced two silent `raise warning` handlers with durable
 * product_events rows, so a referral that degrades is now recorded rather than
 * lost to the server log. This module carries that signal to PostHog, where the
 * question being asked is "is this getting worse?" rather than "why did this one
 * fail?".
 *
 * DELIBERATELY THIN. buildExternalAnalyticsProperties (lib/analytics/privacy-core)
 * drops the ENTIRE capture if any property key is missing from its allowlist, so
 * a mirror that forwarded the row's diagnostics — sqlstate, stage, the error text
 * — would send nothing at all. The split is therefore:
 *
 *   PostHog   how many, of which kind, trending which way. The kind is the event
 *             NAME, so no extra property is needed to tell settlement failure
 *             from bonus failure.
 *   Supabase  why: sqlstate, stage, message, membership, stamp event.
 *
 * Only `outcome` is forwarded, and only because it is already allowlisted.
 *
 * Re-sending is safe: capturePostHogEvent derives `$insert_id` from `eventId`
 * (privacy-core.ts), and the eventId here is the product_events row id, so
 * PostHog de-duplicates a row mirrored twice. That is what lets the sweep use a
 * rolling window instead of tracking what it has already sent.
 */

/** Event names written by SQL that this mirror forwards. */
export const REFERRAL_HEALTH_EVENT_NAMES = [
  "referral_settlement_failed",
  "referral_bonus_failed",
] as const

export type ReferralHealthEventName =
  (typeof REFERRAL_HEALTH_EVENT_NAMES)[number]

/** One product_events row, narrowed to what the mirror needs. */
export type ReferralHealthRow = {
  readonly id: unknown
  readonly event_name: unknown
  readonly merchant_id: unknown
  readonly customer_id: unknown
  readonly membership_id: unknown
  readonly metadata: unknown
}

export function isReferralHealthEventName(
  value: unknown
): value is ReferralHealthEventName {
  return (
    typeof value === "string" &&
    (REFERRAL_HEALTH_EVENT_NAMES as readonly string[]).includes(value)
  )
}

/**
 * Build the mirror input for one row, or null when the row cannot be mirrored
 * safely. Pure, so the property-narrowing contract can be asserted in the unit
 * tier without a Supabase client or a network call.
 */
export function buildReferralHealthMirrorEvent(
  row: ReferralHealthRow
): ProductEventInput | null {
  const eventId = stringOrNull(row.id)
  const eventName = row.event_name

  if (!eventId || !isReferralHealthEventName(eventName)) return null

  const outcome = readOutcome(row.metadata)
  if (!outcome) return null

  return {
    eventId,
    eventName,
    merchantId: stringOrNull(row.merchant_id) ?? undefined,
    customerId: stringOrNull(row.customer_id) ?? undefined,
    membershipId: stringOrNull(row.membership_id) ?? undefined,
    actorType: "system",
    // `outcome` only. Anything else here would fail the allowlist and take the
    // whole capture down with it.
    metadata: { outcome },
  }
}

function readOutcome(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null) return null
  const value = (metadata as Record<string, unknown>).outcome
  return typeof value === "string" && value.length > 0 ? value : null
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null
}
