import type {
  ActivityDetail,
  RawActivityRow,
} from "@/lib/merchant/activity-display"

export function customerName(customerLabel: string | null) {
  return customerLabel ?? "Member"
}

export function stampLabel(
  row: RawActivityRow,
  membership:
    | {
        id: string
        current_stamp_count: number
        total_stamps_earned: number
        total_rewards_redeemed: number
      }
    | undefined
) {
  const newStampCount = row.metadata?.new_stamp_count
  if (newStampCount != null) return `stamp ${String(newStampCount)}`
  if (membership) return `stamp ${membership.current_stamp_count}`
  return "a stamp"
}

export function rewardLabel(rewardName: string | undefined) {
  return rewardName ?? "a reward"
}

export function formatActorDetail(
  actorType: string,
  staff: { display_name: string; role: string } | undefined,
  customerLabel: string | null
): ActivityDetail | null {
  switch (actorType) {
    case "merchant":
      return { label: "Actor", value: "Merchant account" }
    case "staff":
      return { label: "Actor", value: staff?.display_name ?? "Staff member" }
    case "customer":
      return { label: "Actor", value: customerLabel ?? "Member" }
    case "system":
      return { label: "Actor", value: "Automatic" }
    case "admin":
      return { label: "Actor", value: "Nabaperks support" }
    default:
      return null
  }
}

export function metadataMarketingOptIn(metadata: Record<string, unknown>) {
  if (metadata.marketing_opt_in == null) return null
  return {
    label: "Marketing opt-in",
    value: metadata.marketing_opt_in ? "Yes" : "No",
  }
}

export function formatDestinationType(value: string) {
  return value === "join" ? "Customer join" : value.replaceAll("_", " ")
}

export function formatAssetType(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function formatActivityDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return "Just now"
  if (diffMs < hour) return `${Math.floor(diffMs / minute)} min ago`
  if (diffMs < day) return `${Math.floor(diffMs / hour)} hr ago`
  const days = Math.floor(diffMs / day)
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return formatActivityDateTime(value)
}

export function activityDateGroup(value: string) {
  const eventKey = ukDateKey(value)
  const todayKey = ukDateKey(new Date().toISOString())
  const yesterdayKey = ukDateKey(offsetDateIso(-1))

  if (eventKey === todayKey) return { key: "today", label: "Today" }
  if (eventKey === yesterdayKey) {
    return { key: "yesterday", label: "Yesterday" }
  }
  if (daysBetweenUkDates(eventKey, todayKey) < 7) {
    return { key: `this-week-${eventKey}`, label: formatDateGroupLabel(value) }
  }
  return { key: `earlier-${eventKey}`, label: formatDateGroupLabel(value) }
}

export function isDetail(
  detail: ActivityDetail | null
): detail is ActivityDetail {
  return detail != null && detail.value.length > 0
}

export function uniqueDetails(
  detail: ActivityDetail | null,
  index: number,
  details: Array<ActivityDetail | null>
): detail is ActivityDetail {
  if (!isDetail(detail)) return false
  return (
    details.findIndex(
      (item) => item?.label === detail.label && item.value === detail.value
    ) === index
  )
}

export const SEARCHABLE_METADATA_KEYS = new Set<string>([
  "reward_name",
  "new_stamp_count",
  "business_date",
  "geo_status",
  "destination_type",
  "asset_type",
  "source",
  "plan",
  "status",
])

export function metadataSearchValues(metadata: Record<string, unknown> | null) {
  if (!metadata) return []
  return Object.entries(metadata)
    .filter(([key, value]) => {
      const valueType = typeof value
      return (
        (valueType === "string" || valueType === "number") &&
        SEARCHABLE_METADATA_KEYS.has(key)
      )
    })
    .map(([key, value]) => `${key} ${String(value)}`)
}

export function sameUkDate(
  firstRow: RawActivityRow,
  secondRow: RawActivityRow
) {
  return ukEventDateKey(firstRow) === ukEventDateKey(secondRow)
}

export function ukEventDateKey(row: RawActivityRow) {
  const businessDate = row.metadata?.business_date
  return businessDate ? String(businessDate) : ukDateKey(row.created_at)
}

export function ukDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value))

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  return `${year}-${month}-${day}`
}

export function offsetDateIso(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

export function daysBetweenUkDates(fromKey: string, toKey: string) {
  const from = Date.UTC(...dateKeyParts(fromKey))
  const to = Date.UTC(...dateKeyParts(toKey))
  return Math.floor((to - from) / 86_400_000)
}

export function dateKeyParts(key: string): [number, number, number] {
  const [year, month, day] = key.split("-").map(Number)
  return [year, month - 1, day]
}

export function formatDateGroupLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(value))
}

export function clampActivityLimit(limit = 100) {
  if (!Number.isFinite(limit)) return 100
  return Math.min(Math.max(Math.floor(limit), 1), 250)
}

export function first<T>(value: T | T[] | null | undefined) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}
