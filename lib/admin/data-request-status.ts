/**
 * Pure age/deadline maths for logged GDPR data requests (UK GDPR: respond
 * within one calendar month; the console tracks a conservative 30-day
 * window). No IO — unit-tested directly; the privacy panel renders the copy.
 */

export const DATA_REQUEST_WINDOW_DAYS = 30

const DAY_MS = 24 * 60 * 60 * 1000

export type DataRequestAge = {
  readonly days: number
  readonly remainingDays: number
  readonly overdue: boolean
}

export function describeDataRequestAge(
  createdAt: string,
  now: Date = new Date()
): DataRequestAge {
  const created = new Date(createdAt).getTime()
  const elapsed = now.getTime() - created
  const days = Math.max(0, Math.floor(elapsed / DAY_MS))
  const remainingDays = DATA_REQUEST_WINDOW_DAYS - days

  return {
    days,
    remainingDays,
    overdue: remainingDays < 0,
  }
}

/** Human line for a pending request, e.g. "Logged 12 days ago · 18 days left of the 30-day window". */
export function dataRequestAgeCopy(age: DataRequestAge): string {
  const logged =
    age.days === 0
      ? "Logged today"
      : age.days === 1
        ? "Logged 1 day ago"
        : `Logged ${age.days} days ago`

  if (age.overdue) {
    const over = Math.abs(age.remainingDays)
    return `${logged} · ${over} ${over === 1 ? "day" : "days"} over the ${DATA_REQUEST_WINDOW_DAYS}-day window`
  }

  return `${logged} · ${age.remainingDays} ${
    age.remainingDays === 1 ? "day" : "days"
  } left of the ${DATA_REQUEST_WINDOW_DAYS}-day window`
}
