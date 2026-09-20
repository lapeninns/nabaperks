const LONDON = "Europe/London"
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
// Fixed receipt copy: ICU abbreviates September differently in Node and WebKit.
const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const
const WEEKDAY_LABELS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const

export function ukTodayIso() {
  return formatLondonIso(new Date())
}

export function addUkCalendarDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number)
  const anchor = new Date(Date.UTC(year, month - 1, day + days, 12))

  return formatLondonIso(anchor)
}

/** Receipt-style stamp label, e.g. `14 JUN`. */
export function formatStampDisplayDateFromIso(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  const anchor = new Date(Date.UTC(year, month - 1, day, 12))
  return `${anchor.getUTCDate()} ${MONTH_LABELS[anchor.getUTCMonth()].toUpperCase()}`
}

/** Reward-ready chip label with weekday, e.g. `Thu 18 Jun`. */
export function formatRewardReadyDate(iso: string) {
  // Accepts the date-only `redeemable_from` and the timestamptz collection
  // `available_from`; an instant is read on the London calendar.
  const dateIso = DATE_ONLY.test(iso) ? iso : formatLondonIso(new Date(iso))
  const [year, month, day] = dateIso.split("-").map(Number)
  const anchor = new Date(Date.UTC(year, month - 1, day, 12))

  return `${WEEKDAY_LABELS[anchor.getUTCDay()]} ${anchor.getUTCDate()} ${MONTH_LABELS[anchor.getUTCMonth()]}`
}

/** Preview dates for the join journey: view-day, +5 days, +10 days, … */
export function stampDisplayDates(total: number, dayStep = 5) {
  const today = ukTodayIso()

  return Array.from({ length: Math.max(total, 0) }, (_, index) =>
    formatStampDisplayDateFromIso(addUkCalendarDays(today, index * dayStep))
  )
}

/** Marketing preview dates ending on today: today-8, today-4, today for 3 stamps. */
export function stampDisplayDatesEndingToday(total: number, dayStep = 4) {
  const today = ukTodayIso()
  const lastIndex = Math.max(total, 0) - 1

  return Array.from({ length: Math.max(total, 0) }, (_, index) =>
    formatStampDisplayDateFromIso(
      addUkCalendarDays(today, (index - lastIndex) * dayStep)
    )
  )
}

export function formatLondonIso(value: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
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
