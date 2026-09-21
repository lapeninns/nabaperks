/**
 * Date labels assembled from fixed names rather than Intl's own separators.
 * Node's ICU and a browser's disagree on punctuation for en-GB (server "Wed
 * 23 Sep", client "Wed, 23 Sep"), which breaks hydration; only the numeric
 * parts come from Intl, in the given time zone.
 */
export const SHORT_MONTHS = [
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

export const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const

export const SHORT_WEEKDAYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
] as const

export const LONG_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

export type DateParts = {
  readonly weekday: number
  readonly day: number
  readonly month: number
  readonly year: number
}

export function dateParts(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""
  const weekday = Math.max(
    0,
    SHORT_WEEKDAYS.findIndex((name) => read("weekday").startsWith(name))
  )
  return {
    weekday,
    day: Number(read("day")),
    month: Number(read("month")) - 1,
    year: Number(read("year")),
  }
}

/** "Wed 16" */
export function formatShortWeekdayDay(date: Date, timeZone: string): string {
  const parts = dateParts(date, timeZone)
  return `${SHORT_WEEKDAYS[parts.weekday]} ${parts.day}`
}

/** "Wed 16 Sep" */
export function formatShortDate(date: Date, timeZone: string): string {
  const parts = dateParts(date, timeZone)
  return `${SHORT_WEEKDAYS[parts.weekday]} ${parts.day} ${SHORT_MONTHS[parts.month]}`
}

/** "Wednesday 16 September" */
export function formatLongDate(date: Date, timeZone: string): string {
  const parts = dateParts(date, timeZone)
  return `${LONG_WEEKDAYS[parts.weekday]} ${parts.day} ${LONG_MONTHS[parts.month]}`
}
