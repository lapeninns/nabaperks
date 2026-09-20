export const COLLECTION_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const

export const COLLECTION_TIME_OPTIONS = Array.from(
  { length: 97 },
  (_, slot) =>
    `${String(Math.floor(slot / 4)).padStart(2, "0")}:${String((slot % 4) * 15).padStart(2, "0")}`
)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_CLOSURE_MS = 90 * 86_400_000
const WINDOW_ERRORS = {
  NBW01: "Collection windows on the same day must not overlap.",
  NBW02: "Choose a valid day and times in 15-minute steps.",
  NBW03:
    "Each window must last at least 30 minutes and end on the same day. Split an overnight window across two days.",
  NBW04: "Choose an active upgrade reward from this venue, or no upgrade.",
  NBW05:
    "Choose valid closure dates, up to 90 days apart, and a reason of 1–200 characters.",
  NBW06:
    "This closure overlaps an existing closure. Check the dates before trying again.",
  NBW07:
    "This closure cannot be ended now. Refresh to check whether it has started or already ended.",
} as const

export function collectionWindowError(code: string | undefined): string {
  return (
    Object.entries(WINDOW_ERRORS).find(([key]) => key === code)?.[1] ??
    "We could not confirm the update. Refresh to check the saved settings before trying again."
  )
}

export type CollectionWindowDraft = {
  readonly key: string
  readonly isodow: number
  readonly startsAt: string
  readonly endsAt: string
  readonly upgradePoolItemId: string
  readonly isActive: boolean
}

export type CollectionWindowSummary = {
  readonly id: string
  readonly isodow: number
  readonly starts_at: string
  readonly ends_at: string
  readonly upgrade_pool_item_id: string | null
  readonly is_active: boolean
}

export type CollectionWindowPayload = {
  readonly location_id: string
  readonly isodow: number
  readonly starts_at: string
  readonly ends_at: string
  readonly upgrade_pool_item_id: string | null
  readonly is_active: boolean
}

export function buildCollectionWindowDrafts(
  windows: readonly CollectionWindowSummary[]
): CollectionWindowDraft[] {
  return COLLECTION_DAYS.flatMap<CollectionWindowDraft>((_, index) => {
    const dayWindows = windows.filter(
      (row) => row.isodow === index + 1 && row.is_active
    )
    return dayWindows.length
      ? dayWindows.map((row) => ({
          key: row.id,
          isodow: row.isodow,
          startsAt: row.starts_at.slice(0, 5),
          endsAt: row.ends_at.slice(0, 5),
          upgradePoolItemId: row.upgrade_pool_item_id ?? "",
          isActive: true,
        }))
      : [
          {
            key: `day-${index + 1}`,
            isodow: index + 1,
            startsAt: "12:00",
            endsAt: "15:00",
            upgradePoolItemId: "",
            isActive: false,
          },
        ]
  })
}

export function quietLunchPreset(): CollectionWindowDraft[] {
  return buildCollectionWindowDrafts([]).map((row) => ({
    ...row,
    isActive: row.isodow <= 4,
  }))
}

type WindowParseResult =
  | {
      readonly windows: CollectionWindowPayload[]
      readonly code?: never
    }
  | { readonly windows?: never; readonly code: keyof typeof WINDOW_ERRORS }

export function parseCollectionWindows(
  input: unknown,
  locationId: string
): WindowParseResult {
  if (!Array.isArray(input) || !UUID.test(locationId) || input.length > 336)
    return { code: "NBW02" }
  const windows: CollectionWindowPayload[] = []
  for (const row of input) {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.isActive !== "boolean" ||
      !Number.isInteger(row.isodow) ||
      row.isodow < 1 ||
      row.isodow > 7
    )
      return { code: "NBW02" }
    if (!row.isActive) continue
    if (
      typeof row.startsAt !== "string" ||
      typeof row.endsAt !== "string" ||
      !COLLECTION_TIME_OPTIONS.includes(row.startsAt) ||
      row.startsAt === "24:00" ||
      !COLLECTION_TIME_OPTIONS.includes(row.endsAt)
    )
      return { code: "NBW02" }
    const start = COLLECTION_TIME_OPTIONS.indexOf(row.startsAt)
    const end = COLLECTION_TIME_OPTIONS.indexOf(row.endsAt)
    if (end - start < 2) return { code: "NBW03" }
    if (
      typeof row.upgradePoolItemId !== "string" ||
      (row.upgradePoolItemId !== "" && !UUID.test(row.upgradePoolItemId))
    )
      return { code: "NBW04" }
    if (
      windows.some(
        (other) =>
          other.isodow === row.isodow &&
          other.starts_at < row.endsAt &&
          row.startsAt < other.ends_at
      )
    )
      return { code: "NBW01" }
    windows.push({
      location_id: locationId,
      isodow: row.isodow,
      starts_at: row.startsAt,
      ends_at: row.endsAt,
      upgrade_pool_item_id: row.upgradePoolItemId || null,
      is_active: true,
    })
  }
  return { windows }
}

export type VenueClosureFields = {
  readonly locationId: string
  readonly startsAt: string
  readonly endsAt: string
  readonly reason: string
}

export type VenueClosureErrors = {
  readonly startsAt?: string
  readonly endsAt?: string
  readonly reason?: string
  readonly form?: string
}

export type VenueClosureSummary = {
  readonly id: string
  readonly starts_at: string
  readonly ends_at: string
  readonly reason: string
  readonly ended_early_at: string | null
}

const LONDON_DATETIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

function parseLondonDateTime(value: string): string | null {
  if (!/^(?:[2-9]\d{3})-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const nominal = Date.parse(`${value}:00Z`)
  if (
    !Number.isFinite(nominal) ||
    new Date(nominal).toISOString().slice(0, 16) !== value
  )
    return null
  // Modern London has two offsets. Reject missing or repeated DST wall times.
  const candidates = [nominal, nominal - 3_600_000].filter((timestamp) => {
    const parts = LONDON_DATETIME.formatToParts(timestamp)
    const part = (type: string) =>
      parts.find((entry) => entry.type === type)?.value
    return (
      `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}` ===
      value
    )
  })
  return candidates.length === 1 ? new Date(candidates[0]).toISOString() : null
}

export function parseVenueClosure(fields: VenueClosureFields): {
  readonly closure?: VenueClosureFields
  readonly errors?: VenueClosureErrors
} {
  const startsAt = parseLondonDateTime(fields.startsAt)
  const endsAt = parseLondonDateTime(fields.endsAt)
  const reason = fields.reason.trim()
  const errors = {
    ...(!UUID.test(fields.locationId)
      ? { form: collectionWindowError("NBW05") }
      : {}),
    ...(!startsAt
      ? {
          startsAt:
            "Enter a valid UK start date and time. Avoid the missing or repeated hour when clocks change.",
        }
      : {}),
    ...(!endsAt
      ? {
          endsAt:
            "Enter a valid UK end date and time. Avoid the missing or repeated hour when clocks change.",
        }
      : {}),
    ...(startsAt &&
    endsAt &&
    (endsAt <= startsAt ||
      Date.parse(endsAt) - Date.parse(startsAt) > MAX_CLOSURE_MS)
      ? { endsAt: "End the closure after it starts and within 90 days." }
      : {}),
    ...(!reason || reason.length > 200
      ? { reason: "Give a reason of 1–200 characters." }
      : {}),
  }
  if (Object.keys(errors).length || !startsAt || !endsAt) return { errors }
  return {
    closure: { locationId: fields.locationId, startsAt, endsAt, reason },
  }
}
