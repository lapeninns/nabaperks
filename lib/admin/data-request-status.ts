const DAY_MS = 24 * 60 * 60 * 1000
const UK_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

export type DataRequestAge = {
  readonly days: number
  readonly remainingDays: number
  readonly overdue: boolean
}

export function describeDataRequestAge(
  createdAt: string,
  now: Date = new Date()
): DataRequestAge {
  const createdDate = new Date(createdAt)
  const created = toUkDateParts(createdDate)
  const current = toUkDateParts(now)
  const createdOrdinal = toOrdinal(created)
  const currentOrdinal = toOrdinal(current)
  const deadline = addCalendarMonth(created)
  const deadlineOrdinal = toOrdinal(deadline)
  const effectiveCurrentOrdinal = Math.max(currentOrdinal, createdOrdinal)
  const days = effectiveCurrentOrdinal - createdOrdinal
  const remainingDays = deadlineOrdinal - effectiveCurrentOrdinal

  return {
    days,
    remainingDays,
    overdue: remainingDays < 0,
  }
}

/** Human line for a pending request against its one-calendar-month deadline. */
export function dataRequestAgeCopy(age: DataRequestAge): string {
  const logged =
    age.days === 0
      ? "Logged today"
      : age.days === 1
        ? "Logged 1 day ago"
        : `Logged ${age.days} days ago`

  if (age.overdue) {
    const over = Math.abs(age.remainingDays)
    return `${logged} · ${over} ${over === 1 ? "day" : "days"} past the one-calendar-month deadline`
  }

  if (age.remainingDays === 0) {
    return `${logged} · due today`
  }

  return `${logged} · ${age.remainingDays} ${
    age.remainingDays === 1 ? "day" : "days"
  } left until the one-calendar-month deadline`
}

type DateParts = {
  readonly year: number
  readonly month: number
  readonly day: number
}

function toUkDateParts(value: Date): DateParts {
  if (Number.isNaN(value.getTime())) {
    throw new Error("Invalid data request timestamp.")
  }

  const parts = Object.fromEntries(
    UK_DATE_FORMATTER.formatToParts(value).map(({ type, value: part }) => [
      type,
      part,
    ])
  )
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
  }
}

function toOrdinal(value: DateParts): number {
  return Date.UTC(value.year, value.month - 1, value.day) / DAY_MS
}

function addCalendarMonth(value: DateParts): DateParts {
  const monthIndex = value.month
  const year = value.year + Math.floor(monthIndex / 12)
  const month = (monthIndex % 12) + 1
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { year, month, day: Math.min(value.day, lastDay) }
}
