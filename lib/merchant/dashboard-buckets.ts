const LONDON = "Europe/London"

export type DayBucket = { readonly key: string; readonly iso: string }

export const DASHBOARD_SERIES_DAYS = 14

export function buildDayBuckets(days: number): DayBucket[] {
  const todayKey = londonDayKey(new Date())
  const anchorNoon = Date.parse(`${todayKey}T12:00:00Z`)
  const buckets: DayBucket[] = []
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const key = londonDayKey(new Date(anchorNoon - offset * 86_400_000))
    buckets.push({ key, iso: londonMidnightFloorIso(key) })
  }
  return buckets
}

export function bucketize(
  rows: { readonly created_at?: string | null }[] | null | undefined,
  buckets: readonly DayBucket[]
): number[] {
  const indexByKey = new Map(
    buckets.map((bucket, index) => [bucket.key, index])
  )
  const counts = new Array<number>(buckets.length).fill(0)
  for (const row of rows ?? []) {
    const createdAt = row?.created_at
    if (typeof createdAt !== "string") continue
    const index = indexByKey.get(londonDayKey(new Date(createdAt)))
    if (index !== undefined) counts[index] += 1
  }
  return counts
}

export type SeriesRpcRow = {
  readonly day?: unknown
  readonly joins?: unknown
  readonly stamps?: unknown
  readonly rewards?: unknown
}

export type MappedSeriesBuckets = {
  readonly joins: number[]
  readonly stamps: number[]
  readonly rewards: number[]
}

/**
 * Maps the get_merchant_dashboard_series RPC's sparse per-day rows onto the
 * dense, bucket-ordered arrays the dashboard renders. Days without an RPC
 * row stay 0; counts arrive as numbers or PostgREST bigint strings; rows
 * for days outside the bucket window are dropped.
 */
export function mapSeriesRowsToBuckets(
  rows: readonly SeriesRpcRow[] | null | undefined,
  buckets: readonly DayBucket[]
): MappedSeriesBuckets {
  const indexByKey = new Map(
    buckets.map((bucket, index) => [bucket.key, index])
  )
  const joins = new Array<number>(buckets.length).fill(0)
  const stamps = new Array<number>(buckets.length).fill(0)
  const rewards = new Array<number>(buckets.length).fill(0)

  for (const row of rows ?? []) {
    const day = typeof row?.day === "string" ? row.day : null
    if (!day) continue
    const index = indexByKey.get(day)
    if (index === undefined) continue
    joins[index] = parseSeriesCount(row.joins)
    stamps[index] = parseSeriesCount(row.stamps)
    rewards[index] = parseSeriesCount(row.rewards)
  }

  return { joins, stamps, rewards }
}

function parseSeriesCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value))
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value)
  }
  return 0
}

export function londonMidnightFloorIso(dayKey: string): string {
  const [year, month, day] = dayKey.split("-").map(Number)
  const utcMidnight = Date.UTC(year, month - 1, day)
  return new Date(utcMidnight - londonOffsetMsAt(utcMidnight)).toISOString()
}

function londonDayKey(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  return `${year}-${month}-${day}`
}

function londonOffsetMsAt(timestampMs: number): number {
  const offset = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    timeZoneName: "shortOffset",
  })
    .formatToParts(new Date(timestampMs))
    .find((part) => part.type === "timeZoneName")?.value

  if (!offset || offset === "GMT" || offset === "UTC") return 0

  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(offset)
  if (!match) return 0

  const sign = match[1] === "+" ? 1 : -1
  const hours = Number(match[2])
  const minutes = Number(match[3] ?? "0")
  return sign * (hours * 60 + minutes) * 60_000
}
