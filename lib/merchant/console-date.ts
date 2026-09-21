const MONTHS = [
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

/**
 * The console top bar's date in the receipt register: "Mon 21 Sep", read in
 * the venue's trading timezone (Europe/London) so a phone set to another zone
 * still shows the day the till is on. Rendered uppercase by `.mono-meta`.
 * Fixed abbreviations rather than Intl's, which would print "Sept" in en-GB.
 */
export function formatConsoleDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "numeric",
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ""

  const weekday = WEEKDAYS.find((name) => read("weekday").startsWith(name))
  const month = MONTHS[Number(read("month")) - 1]
  return `${weekday ?? read("weekday")} ${read("day")} ${month ?? read("month")}`
}
