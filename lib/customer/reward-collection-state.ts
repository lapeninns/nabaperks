export const REWARD_COLLECTION_STATES = [
  "waiting",
  "ready",
  "expired",
  "redeemed",
  "cancelled",
  "blocked",
] as const

export type RewardCollectionState = (typeof REWARD_COLLECTION_STATES)[number]

export type RewardCollectionSnapshot = {
  readonly state: RewardCollectionState
  readonly reason: string | null
  readonly availableFrom: string | null
  readonly expiresAt: string | null
  readonly inWindow: boolean
  readonly windowId: string | null
  readonly windowEndsAt: string | null
  readonly upgradePoolItemId: string | null
  readonly upgradeRewardName: string | null
  readonly upgradeRewardTerms: string | null
  readonly nextWindowStartsAt: string | null
  readonly nextWindowEndsAt: string | null
  readonly nextWindowUpgradeName: string | null
  readonly requiresAgeCheck: boolean
}

type CollectionWindowFacts = Pick<
  RewardCollectionSnapshot,
  | "inWindow"
  | "windowEndsAt"
  | "upgradeRewardName"
  | "nextWindowStartsAt"
  | "nextWindowEndsAt"
  | "nextWindowUpgradeName"
>

const MALFORMED = "Unable to load reward: malformed collection state"
const LONDON_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const LONDON_WEEKDAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
})
const LONDON_DEADLINE = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
export function parseRewardCollectionState(
  value: unknown
): RewardCollectionSnapshot {
  if (!isRecord(value) || !isRewardCollectionState(value.state)) {
    throw new Error(MALFORMED)
  }
  if (typeof value.in_window !== "boolean") throw new Error(MALFORMED)

  return {
    state: value.state,
    reason: nullableString(value.reason),
    availableFrom: nullableString(value.available_from),
    expiresAt: nullableString(value.expires_at),
    inWindow: value.in_window,
    windowId: nullableString(value.window_id),
    windowEndsAt: nullableString(value.window_ends_at),
    upgradePoolItemId: nullableString(value.upgrade_pool_item_id),
    upgradeRewardName: nullableString(value.upgrade_reward_name),
    upgradeRewardTerms: nullableString(value.upgrade_reward_terms),
    nextWindowStartsAt: nullableString(value.next_window_starts_at),
    nextWindowEndsAt: nullableString(value.next_window_ends_at),
    nextWindowUpgradeName: nullableString(value.next_window_upgrade_name),
    requiresAgeCheck: value.requires_age_check === true,
  }
}

export function rewardCollectionBlockedCopy(reason: string | null): string {
  switch (reason) {
    case "venue_paused":
      return "This venue has paused reward collection."
    // Programme-level availability (inactive merchant or card, billing) is not
    // a deliberate pause; keep the neutral wording the card uses.
    case "This loyalty programme is unavailable right now":
      return "This loyalty programme is unavailable at the moment."
    // The venue's day resets at its own configured time, so the copy names a
    // later visit rather than a calendar day it cannot promise.
    case "one_reward_per_day":
    case "One reward per visit day already collected":
      return "You've already collected a reward here today. You can collect this one on a later visit."
    case "profile_incomplete":
    case "Complete your profile before redeeming":
      return "Finish setting up to collect this reward."
    case "Verified email required for reward collection":
      return "Confirm your email to collect this reward."
    case "age_verification_required":
    case PHOTO_ID_REQUIRED_REASON:
      return "Staff will check photo ID when you collect this reward."
    case UNDER_AGE_REASON:
      return "This reward can only be collected by customers aged 18 or over."
    case "expired":
      return "This reward has expired."
    case null:
      return "This reward is not available to collect right now."
    default:
      return "This reward is not available to collect right now."
  }
}

/**
 * Blocks the customer clears by completing a step on the reward page: their
 * profile, a verified email, or an in-person photo-ID check that the venue
 * records at collection. The code is still shown for these; the merchant scan
 * context reports them as verification required rather than refusing.
 */
export function isCollectionSetupBlock(reason: string | null): boolean {
  return (
    reason === "profile_incomplete" ||
    reason === "Complete your profile before redeeming" ||
    reason === "Verified email required for reward collection" ||
    reason === PHOTO_ID_REQUIRED_REASON
  )
}

/**
 * What the guest can do with a reward, from the server predicate alone:
 *
 * - `ready`: collect it now. The in-person photo-ID reason counts here because
 *   the predicate reports it only once every other requirement is met, and the
 *   code is shown with the ID note beside it. Callers resolve that reason with
 *   {@link resolveAgeCheckReason} first, so an under-age customer's reward is
 *   `unavailable`, never ready.
 * - `needs_setup`: unlocked, but a detail (name, date of birth, email or
 *   mobile number) must be added on the reward page first. Never shown with a
 *   code or as ready.
 * - `waiting`: unlocked, opening at its server-derived time.
 * - `unavailable`: anything else (paused, capped, expired, collected).
 *
 * Presentation only. The QR route and the database predicate stay the
 * authority on whether a code can be minted.
 */
export type RewardCollectability =
  "ready" | "needs_setup" | "waiting" | "unavailable"

export function rewardCollectability(
  state: RewardCollectionState,
  reason: string | null
): RewardCollectability {
  if (state === "ready") return "ready"
  if (state === "waiting") return "waiting"
  if (state === "blocked" && reason === PHOTO_ID_REQUIRED_REASON) return "ready"
  if (state === "blocked" && isCollectionSetupBlock(reason)) {
    return "needs_setup"
  }
  return "unavailable"
}

/** The predicate's reason when an age-checked reward needs in-person ID. */
export const PHOTO_ID_REQUIRED_REASON =
  "Customer must have verified photo ID and be 18 or over to redeem"

/**
 * The predicate reports one reason for two situations: an adult whose photo ID
 * the venue has not yet checked in person (a setup step, the code is shown), and
 * a customer whose stated date of birth is under age (a policy block). Only the
 * former is recoverable at the counter, so callers pass the stated date of
 * birth to tell them apart.
 */
export function photoIdSetupApplies(
  reason: string | null,
  statedDateOfBirthIsAdult: boolean
): boolean {
  return reason === PHOTO_ID_REQUIRED_REASON && statedDateOfBirthIsAdult
}

/** The predicate's reason when the customer is under age for the reward. */
export const UNDER_AGE_REASON = "Customer must be 18 or over to redeem"

/**
 * Resolves the predicate's ambiguous photo-ID reason with the customer's
 * stated date of birth, the same fact the reward page and the QR route check.
 * An under-age (or missing) date of birth becomes the under-age policy block,
 * so list and card surfaces never show that reward as ready to collect. Every
 * surface that classifies rewards must pass its reasons through this first.
 */
export function resolveAgeCheckReason(
  reason: string | null,
  statedDateOfBirthIsAdult: boolean
): string | null {
  if (reason !== PHOTO_ID_REQUIRED_REASON) return reason
  return photoIdSetupApplies(reason, statedDateOfBirthIsAdult)
    ? reason
    : UNDER_AGE_REASON
}

export function collectionWindowCopy(
  facts: CollectionWindowFacts
): string | null {
  if (facts.inWindow && facts.windowEndsAt && facts.upgradeRewardName) {
    return `Collect before ${formatTime(facts.windowEndsAt)} and get ${facts.upgradeRewardName}`
  }

  if (
    facts.nextWindowStartsAt &&
    facts.nextWindowEndsAt &&
    facts.nextWindowUpgradeName
  ) {
    return `Collect on ${LONDON_WEEKDAY.format(parseInstant(facts.nextWindowStartsAt))} ${formatTime(facts.nextWindowStartsAt)}–${formatTime(facts.nextWindowEndsAt)} and get ${facts.nextWindowUpgradeName} instead`
  }

  return null
}

export function formatCollectionDeadline(value: string | null): string | null {
  if (!value) return null
  return `Expires ${LONDON_DEADLINE.format(parseInstant(value)).replace(",", " at")}`
}

/**
 * "Ready from Wed 1 Oct, 12:00": the server's opening instant in London time,
 * capitalised as the formatter gives it. Callers must not lower-case it.
 */
export function formatCollectionAvailability(
  value: string | null
): string | null {
  if (!value) return null
  return `Ready from ${formatCollectionAvailableLabel(value)}`
}

/** "Wed 1 Oct, 12:00" in London time, for a date chip or a sentence. */
export function formatCollectionAvailableLabel(
  value: string | null
): string | null {
  if (!value) return null
  return LONDON_DEADLINE.format(parseInstant(value))
}

function formatTime(value: string): string {
  return LONDON_TIME.format(parseInstant(value))
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const LONDON_HOUR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  hour: "2-digit",
  hourCycle: "h23",
})

/** The instant at which a London calendar date begins (00:00 Europe/London). */
function londonMidnight(dateIso: string): Date {
  const [year, month, day] = dateIso.split("-").map(Number)
  const utcMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0))
  // London is UTC or UTC+1, so the hour London shows for UTC midnight is
  // exactly the offset to subtract.
  const offsetHours = Number(LONDON_HOUR.format(utcMidnight))
  return new Date(utcMidnight.getTime() - offsetHours * 3_600_000)
}

function parseInstant(value: string): Date {
  // A date-only legacy `redeemable_from` opens at London midnight; parsing it
  // as UTC would show 01:00 during British Summer Time.
  const result = DATE_ONLY.test(value) ? londonMidnight(value) : new Date(value)
  if (Number.isNaN(result.getTime())) throw new Error(MALFORMED)
  return result
}

function isRewardCollectionState(
  value: unknown
): value is RewardCollectionState {
  return (
    typeof value === "string" &&
    REWARD_COLLECTION_STATES.some((state) => state === value)
  )
}

function nullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") throw new Error(MALFORMED)
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Whether the card should point at the reward page: a collectable reward, or
 * one held only by a profile or verified-email step the customer completes on
 * that page. Anything else is genuinely waiting or unavailable.
 */
export function cardRewardCollectable(
  state: RewardCollectionState,
  reason: string | null
): boolean {
  return (
    state === "ready" || (state === "blocked" && isCollectionSetupBlock(reason))
  )
}
