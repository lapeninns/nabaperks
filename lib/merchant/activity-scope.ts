import { ukDateKey } from "@/lib/merchant/activity-display-helpers"
import { londonMidnightFloorIso } from "@/lib/merchant/dashboard-buckets"

/** The feed's time scope: today, or the last 7 or 28 London days. */
export const ACTIVITY_SCOPES = ["today", "7d", "28d"] as const
export type ActivityScope = (typeof ACTIVITY_SCOPES)[number]
export const DEFAULT_ACTIVITY_SCOPE: ActivityScope = "7d"

const SCOPE_DAYS: Record<ActivityScope, number> = {
  today: 1,
  "7d": 7,
  "28d": 28,
}

export function parseActivityScope(value: string | undefined): ActivityScope {
  return (
    ACTIVITY_SCOPES.find((scope) => scope === value) ?? DEFAULT_ACTIVITY_SCOPE
  )
}

/** Start of the scope as an instant: London midnight `days - 1` days ago. */
export function activityScopeSince(scope: ActivityScope, now: Date): string {
  const todayKey = ukDateKey(now.toISOString())
  const [year, month, day] = todayKey.split("-").map(Number)
  const startKey = new Date(
    Date.UTC(year, month - 1, day - (SCOPE_DAYS[scope] - 1), 12)
  )
    .toISOString()
    .slice(0, 10)
  return londonMidnightFloorIso(startKey)
}

export function activityScopeLabel(scope: ActivityScope): string {
  switch (scope) {
    case "today":
      return "today"
    case "7d":
      return "the last 7 days"
    case "28d":
      return "the last 28 days"
  }
}

export const ACTIVITY_SCOPE_PILLS: readonly {
  id: ActivityScope
  label: string
}[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "28d", label: "28 days" },
]
