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
}

const LONDON_AVAILABILITY = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/London",
})

export function formatCollectionAvailability(
  value: string | null
): string | null {
  if (!value) return null
  // A date-only legacy `redeemable_from` opens at London midnight; parsing it
  // as UTC would show 01:00 during British Summer Time.
  const instant = DATE_ONLY.test(value)
    ? londonMidnight(value)
    : new Date(value)
  if (Number.isNaN(instant.getTime())) throw new Error(MALFORMED)
  return `Ready ${LONDON_AVAILABILITY.format(instant).replace(",", " at")}`
}

export function formatCollectionAvailableLabel(
  value: string | null
): string | null {
  return formatCollectionAvailability(value)?.replace(/^Ready /, "") ?? null
}

const MALFORMED = "Unable to load reward: malformed collection state"
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

export function parseRewardCollectionState(
  value: unknown
): RewardCollectionSnapshot {
  if (!isRecord(value) || !isRewardCollectionState(value.state)) {
    throw new Error(MALFORMED)
  }

  return {
    state: value.state,
    reason: nullableString(value.reason),
    availableFrom: nullableString(value.available_from),
    expiresAt: nullableString(value.expires_at),
  }
}

export function rewardCollectionBlockedCopy(reason: string | null): string {
  switch (reason) {
    case "venue_paused":
    case "This loyalty programme is unavailable right now":
      return "This venue has paused reward collection."
    case "one_reward_per_day":
    case "One reward per visit day already collected":
      return "You've collected a reward here today. Your next reward will become available when the venue's next collection day begins."
    case "profile_incomplete":
    case "Complete your profile before redeeming":
      return "Complete your profile before collecting this reward."
    case "Verified email required for reward collection":
      return "Verify your email before collecting this reward."
    case "age_verification_required":
      return "Photo ID is needed to collect this reward."
    case "Customer must be 18 or over to redeem":
      return "This reward can only be collected by customers aged 18 or over."
    case "expired":
      return "This reward has expired."
    case null:
    default:
      return "This reward is not available to collect right now."
  }
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

export function isCollectionSetupBlock(reason: string | null): boolean {
  return (
    reason === "profile_incomplete" ||
    reason === "Complete your profile before redeeming" ||
    reason === "Verified email required for reward collection"
  )
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
