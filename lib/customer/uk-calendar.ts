const LONDON = "Europe/London"

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
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    day: "numeric",
    month: "short",
  }).format(anchor)
  const [dayLabel, monthLabel] = formatted.split(" ")

  return `${dayLabel} ${monthLabel.replace(/\./g, "").toUpperCase()}`
}

/** Reward-ready chip label with weekday, e.g. `Thu 18 Jun`. */
export function formatRewardReadyDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number)
  const anchor = new Date(Date.UTC(year, month - 1, day, 12))

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(anchor)
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

function formatLondonIso(value: Date) {
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
