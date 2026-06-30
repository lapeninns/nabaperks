const CUSTOMER_ACTIVITY_EVENTS = [
  "customer_joined",
  "stamp_issued",
  "reward_unlocked",
  "reward_redeemed",
] as const

export type CustomerActivityEventName =
  (typeof CUSTOMER_ACTIVITY_EVENTS)[number]

export type CustomerActivityCategory = "join" | "stamp" | "reward"

export type CustomerActivityItem = {
  readonly id: string
  readonly eventName: CustomerActivityEventName
  readonly category: CustomerActivityCategory
  readonly badgeLabel: string
  readonly title: string
  readonly description: string
  readonly businessName: string | null
  readonly createdAt: string
}

export type CustomerActivityMetadata = {
  readonly rewardName: string | null
  readonly newStampCount: number | null
}

export type CustomerActivityRow = {
  readonly id: string
  readonly eventName: CustomerActivityEventName
  readonly category: CustomerActivityCategory
  readonly metadata: CustomerActivityMetadata
  readonly businessName: string | null
  readonly createdAt: string
}

const EMPTY_METADATA: CustomerActivityMetadata = {
  rewardName: null,
  newStampCount: null,
}

export function customerActivityEventNames(): readonly CustomerActivityEventName[] {
  return CUSTOMER_ACTIVITY_EVENTS
}

export function isCustomerActivityEventName(
  value: string
): value is CustomerActivityEventName {
  return CUSTOMER_ACTIVITY_EVENTS.some((eventName) => eventName === value)
}

export function customerActivityCategory(
  eventName: CustomerActivityEventName
): CustomerActivityCategory {
  switch (eventName) {
    case "customer_joined":
      return "join"
    case "stamp_issued":
      return "stamp"
    case "reward_unlocked":
    case "reward_redeemed":
      return "reward"
    default:
      return assertNever(eventName)
  }
}

export function parseCustomerActivityMetadata(
  value: unknown
): CustomerActivityMetadata {
  if (!isRecord(value)) return EMPTY_METADATA

  return {
    rewardName: nullableString(value.reward_name),
    newStampCount: nullableNumber(value.new_stamp_count),
  }
}

export function shapeCustomerActivityItem(
  row: CustomerActivityRow
): CustomerActivityItem {
  const venue = row.businessName ?? "a venue"

  switch (row.eventName) {
    case "customer_joined":
      return baseItem(
        row,
        "Joined",
        `Joined ${venue}`,
        `You started collecting stamps at ${venue}.`
      )
    case "stamp_issued":
      return baseItem(
        row,
        "Stamp",
        `Stamp added at ${venue}`,
        stampIssuedDescription(row.metadata.newStampCount)
      )
    case "reward_unlocked":
      return baseItem(
        row,
        "Reward",
        `Reward unlocked at ${venue}`,
        row.metadata.rewardName
          ? `${row.metadata.rewardName} is ready to claim.`
          : "A reward is ready to claim."
      )
    case "reward_redeemed":
      return baseItem(
        row,
        "Redeemed",
        `Reward redeemed at ${venue}`,
        row.metadata.rewardName
          ? `You enjoyed ${row.metadata.rewardName}.`
          : "You redeemed a reward."
      )
    default:
      return assertNever(row.eventName)
  }
}

function stampIssuedDescription(stampCount: number | null): string {
  return stampCount === null
    ? "A stamp was added to your card."
    : `You're now on ${stampCount} ${stampCount === 1 ? "stamp" : "stamps"}.`
}

function baseItem(
  row: CustomerActivityRow,
  badgeLabel: string,
  title: string,
  description: string
): CustomerActivityItem {
  return {
    id: row.id,
    eventName: row.eventName,
    category: row.category,
    badgeLabel,
    title,
    description,
    businessName: row.businessName,
    createdAt: row.createdAt,
  }
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function assertNever(value: never): never {
  throw new Error(`Unhandled customer activity event: ${value}`)
}
