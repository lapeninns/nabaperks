export const MERCHANT_ACTIVATION_COHORT_DAYS = 30

export const MERCHANT_ACTIVATION_STAGES = [
  { key: "account_created", label: "Account created" },
  { key: "email_verified", label: "Email verified" },
  { key: "onboarding_complete", label: "Onboarding complete" },
  { key: "launch_entered", label: "Launch setup entered" },
  { key: "venue_ready", label: "Venue ready" },
  { key: "card_ready", label: "Card ready" },
  { key: "rewards_ready", label: "Three rewards live" },
  { key: "qr_ready", label: "Venue QR ready" },
  { key: "poster_ready", label: "Poster ready" },
  { key: "billing_reached", label: "Billing reached" },
  { key: "billing_activated", label: "Billing activated" },
  { key: "first_customer_stamped", label: "First customer stamped" },
] as const

export type MerchantActivationStageKey =
  (typeof MERCHANT_ACTIVATION_STAGES)[number]["key"]

export type MerchantActivationCohortFacts = Readonly<
  Record<MerchantActivationStageKey, number> & {
    first_stamp_7d_yes: number
    first_stamp_7d_no: number
    first_stamp_7d_pending: number
    median_signup_to_poster_seconds: number | null
  }
>

export type MerchantActivationCohortWindow = Readonly<{
  cohortStart: string
  cohortEnd: string
  asOf: string
}>

const countKeys = [
  ...MERCHANT_ACTIVATION_STAGES.map(({ key }) => key),
  "first_stamp_7d_yes",
  "first_stamp_7d_no",
  "first_stamp_7d_pending",
] as const
const aggregateKeys = [...countKeys, "median_signup_to_poster_seconds"] as const

export function buildMerchantActivationCohortWindow(
  asOfDate: Date = new Date()
): MerchantActivationCohortWindow {
  const asOfMs = asOfDate.getTime()
  if (!Number.isFinite(asOfMs)) {
    throw new TypeError("Invalid merchant activation as-of date")
  }

  const asOf = new Date(asOfMs).toISOString()
  const cohortStart = new Date(
    asOfMs - MERCHANT_ACTIVATION_COHORT_DAYS * 24 * 60 * 60 * 1_000
  ).toISOString()

  return { cohortStart, cohortEnd: asOf, asOf }
}

export function parseMerchantActivationCohortFacts(
  value: unknown
): MerchantActivationCohortFacts {
  if (!Array.isArray(value) || value.length !== 1 || !isPlainRecord(value[0])) {
    throw invalidFacts()
  }

  const row = value[0]
  const ownKeys = Reflect.ownKeys(row)
  if (
    ownKeys.length !== aggregateKeys.length ||
    ownKeys.some(
      (key) =>
        typeof key !== "string" ||
        !aggregateKeys.includes(key as (typeof aggregateKeys)[number])
    )
  ) {
    throw invalidFacts()
  }

  const output: Record<string, number | null> = {}
  for (const key of countKeys) {
    const count = parseNonNegativeInteger(row[key])
    if (count === null) throw invalidFacts()
    output[key] = count
  }

  const median = row["median_signup_to_poster_seconds"]
  if (median === null) {
    output["median_signup_to_poster_seconds"] = null
  } else {
    const seconds = parseNonNegativeNumber(median)
    if (seconds === null) throw invalidFacts()
    output["median_signup_to_poster_seconds"] = seconds
  }

  return output as MerchantActivationCohortFacts
}

export function toMerchantActivationFunnelItems(
  facts: MerchantActivationCohortFacts
) {
  return MERCHANT_ACTIVATION_STAGES.map(({ key, label }) => ({
    label,
    value: facts[key],
  }))
}

export function formatMedianSignupToPoster(seconds: number | null): string {
  if (seconds === null) return "Not available yet"
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new TypeError("Invalid signup-to-poster duration")
  }

  const totalMinutes = Math.floor(seconds / 60)
  if (totalMinutes < 1) return "Under 1 min"
  if (totalMinutes < 60)
    return `${totalMinutes} ${plural(totalMinutes, "min", "mins")}`

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const hourLabel = `${hours} ${plural(hours, "hr", "hrs")}`
  return minutes === 0
    ? hourLabel
    : `${hourLabel} ${minutes} ${plural(minutes, "min", "mins")}`
}

export function formatFirstStampSevenDayOutcome(
  facts: Pick<
    MerchantActivationCohortFacts,
    "first_stamp_7d_yes" | "first_stamp_7d_no" | "first_stamp_7d_pending"
  >
): string {
  return `${facts.first_stamp_7d_yes} yes · ${facts.first_stamp_7d_pending} pending · ${facts.first_stamp_7d_no} no`
}

function parseNonNegativeInteger(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : null
  }
  if (typeof value !== "string" || !/^\d+$/.test(value)) return null

  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function parseNonNegativeNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function invalidFacts(): TypeError {
  return new TypeError("Invalid merchant activation cohort facts")
}

function plural(value: number, singular: string, pluralValue: string): string {
  return value === 1 ? singular : pluralValue
}
