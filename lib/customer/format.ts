const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/London",
})

const monthYearFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/London",
})

// A date of birth is a plain calendar date, not an instant — format it in UTC so
// the day never slips when a bare ISO date ("1990-01-01") is read as midnight.
const dateOfBirthFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

export function formatPence(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(pence / 100)
}

export function formatDate(iso: string) {
  return dateFormatter.format(new Date(iso))
}

export function formatMonthYear(iso: string) {
  return monthYearFormatter.format(new Date(iso))
}

/** Human birthdate from a bare ISO date ("1990-01-01" -> "1 Jan 1990"). */
export function formatDateOfBirth(iso: string) {
  return dateOfBirthFormatter.format(new Date(iso))
}

/** Compact relative time ("2h ago", "3d ago"), falling back to a date. */
export function formatRelativeTime(iso: string, now: Date = new Date()) {
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  const diffMinutes = Math.round(diffMs / 60_000)

  if (diffMinutes < 1) return "just now"
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return formatDate(iso)
}
