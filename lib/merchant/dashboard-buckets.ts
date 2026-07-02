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

function londonMidnightFloorIso(dayKey: string): string {
  return new Date(Date.parse(`${dayKey}T00:00:00Z`) - 3_600_000).toISOString()
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
