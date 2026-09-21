import type {
  ActivityCategory,
  ActivityDisplayRow,
} from "@/lib/merchant/activity-display"

/**
 * A run of low-information rows collapsed into one line: "4 QR scans,
 * 8 to 12 min ago". Only `qr` and `customer` rows collapse; a reward row
 * names a person and an action the owner must see individually and never
 * does. Rows are kept so the expanded body can list them.
 */
export type ActivityGroup = {
  readonly kind: "group"
  /** `${eventName}:${dateGroup}` */
  readonly key: string
  readonly category: ActivityCategory
  readonly badgeLabel: string
  readonly headline: string
  readonly summary: string
  readonly count: number
  readonly rows: readonly ActivityDisplayRow[]
  readonly earliest: string
  readonly latest: string
  readonly dateGroup: string
  readonly dateGroupLabel: string
}

export type ActivityListEntry = ActivityDisplayRow | ActivityGroup

/**
 * Only the two high-volume, low-information events collapse: a QR scan and
 * a join. Other qr-category events (downloads, pauses, resumes) are rare
 * and each says something the owner should read on its own.
 */
const COLLAPSIBLE_EVENTS: ReadonlySet<string> = new Set([
  "qr_scanned",
  "customer_joined",
])

const PLURAL_HEADLINE: Record<string, string> = {
  qr_scanned: "QR scans",
  customer_joined: "joins",
}

export const DEFAULT_COLLAPSE_FROM = 3

export function isActivityGroup(
  entry: ActivityListEntry
): entry is ActivityGroup {
  return (entry as ActivityGroup).kind === "group"
}

/**
 * Collapse same-event runs within a date group. Order is preserved: a group
 * takes the position of its first row. Grouping happens only when the run
 * reaches `collapseFrom` (default 3) and only for the collapsible
 * categories; everything else passes through untouched.
 */
export function groupActivityRows(
  rows: readonly ActivityDisplayRow[],
  options: { collapseFrom?: number } = {}
): readonly ActivityListEntry[] {
  const collapseFrom = Math.max(
    2,
    options.collapseFrom ?? DEFAULT_COLLAPSE_FROM
  )
  const runs = new Map<string, ActivityDisplayRow[]>()

  for (const row of rows) {
    if (!COLLAPSIBLE_EVENTS.has(row.eventName)) continue
    const key = `${row.eventName}:${row.dateGroup}`
    const run = runs.get(key)
    if (run) run.push(row)
    else runs.set(key, [row])
  }

  const emitted = new Set<string>()
  const entries: ActivityListEntry[] = []

  for (const row of rows) {
    const key = `${row.eventName}:${row.dateGroup}`
    const run = COLLAPSIBLE_EVENTS.has(row.eventName)
      ? runs.get(key)
      : undefined
    if (!run || run.length < collapseFrom) {
      entries.push(row)
      continue
    }
    if (emitted.has(key)) continue
    emitted.add(key)
    entries.push(buildGroup(key, run))
  }

  return entries
}

function buildGroup(
  key: string,
  rows: readonly ActivityDisplayRow[]
): ActivityGroup {
  const first = rows[0]!
  const sorted = [...rows].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  )
  const earliestRow = sorted[0]!
  const latestRow = sorted[sorted.length - 1]!

  return {
    kind: "group",
    key,
    category: first.category,
    badgeLabel: first.badgeLabel,
    headline: `${rows.length} ${PLURAL_HEADLINE[first.eventName] ?? pluralBadge(first.badgeLabel)}`,
    summary: formatGroupSummary(
      earliestRow.relativeTime,
      latestRow.relativeTime
    ),
    count: rows.length,
    rows,
    earliest: earliestRow.timestamp,
    latest: latestRow.timestamp,
    dateGroup: first.dateGroup,
    dateGroupLabel: first.dateGroupLabel,
  }
}

/** "QR scanned" → "QR scans", "Join" → "joins"; anything else counts as "× label". */
export function pluralBadge(badgeLabel: string): string {
  switch (badgeLabel) {
    case "QR scanned":
      return "QR scans"
    case "Join":
      return "joins"
    default:
      return `× ${badgeLabel}`
  }
}

const RELATIVE = /^(\d+) (min|hr|days?) ago$/

/**
 * "8 to 12 min ago" when both ends share a unit, otherwise "Just now to
 * 2 hr ago"; a single instant reads as itself.
 */
export function formatGroupSummary(earliest: string, latest: string): string {
  if (earliest === latest) return earliest
  const from = RELATIVE.exec(latest)
  const to = RELATIVE.exec(earliest)
  if (from && to && from[2] === to[2]) {
    return `${from[1]} to ${to[1]} ${to[2]} ago`
  }
  // Relative labels read newest first ("Just now to 2 hr ago"); absolute
  // clock labels read in time order ("09:00 to 12:00").
  const relative =
    RELATIVE.test(earliest) ||
    RELATIVE.test(latest) ||
    earliest === "Just now" ||
    latest === "Just now" ||
    earliest === "Yesterday" ||
    latest === "Yesterday"
  return relative ? `${latest} to ${earliest}` : `${earliest} to ${latest}`
}
