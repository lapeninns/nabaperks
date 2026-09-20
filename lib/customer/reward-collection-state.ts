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
    case "one_reward_per_day":
    case "One reward per visit day already collected":
      return "You've collected a reward here in this venue trading day. Your next reward is available after the venue's daily reset."
    case "profile_incomplete":
    case "Complete your profile before redeeming":
      return "Complete your profile before collecting this reward."
    case "Verified email required for reward collection":
      return "Verify your email before collecting this reward."
    case "age_verification_required":
    case PHOTO_ID_REQUIRED_REASON:
      return "Photo ID is needed to collect this reward."
    case "Customer must be 18 or over to redeem":
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

export function collectionWindowCopy(
  facts: CollectionWindowFacts
): string | null {
  if (facts.inWindow && facts.windowEndsAt && facts.upgradeRewardName) {
    return `Collect now and get ${facts.upgradeRewardName} — until ${formatTime(facts.windowEndsAt)}`
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

export function formatCollectionAvailability(
  value: string | null
): string | null {
  if (!value) return null
  return `Ready ${formatCollectionAvailableLabel(value)}`
}

export function formatCollectionAvailableLabel(
  value: string | null
): string | null {
  if (!value) return null
  return LONDON_DEADLINE.format(parseInstant(value)).replace(",", " at")
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
