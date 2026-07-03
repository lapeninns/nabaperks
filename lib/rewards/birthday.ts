/**
 * Pure Europe/London birthday-window math, mirroring the SQL in
 * `20260704092000_issue_birthday_rewards.sql` so the app and the issuance
 * function agree on "is it their birthday month" and "when does the treat
 * expire". Dependency-free (Intl/Date only) — unit-testable without the runtime.
 * Modeled on lib/notifications/london-time.ts.
 */

function londonYearMonth(now: Date): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now)
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0")
  return { year: value("year"), month: value("month") }
}

function londonDateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0")
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
  }
}

/** The UTC instant of a London wall-clock time (handles the BST/GMT offset). */
function londonWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute)
  let candidate = new Date(target)
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = londonDateTimeParts(candidate)
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute
    )
    const delta = target - observedAsUtc
    if (delta === 0) return candidate
    candidate = new Date(candidate.getTime() + delta)
  }
  return candidate
}

/** The London calendar year, used as the birthday reward's `birthday_year`. */
export function currentBirthdayYear(now: Date): number {
  return londonYearMonth(now).year
}

/**
 * True when a bare ISO date of birth ("1990-07-03") falls in the current London
 * month. Month comparison only — the day/year of birth are irrelevant.
 */
export function isBirthdayMonth(
  dateOfBirth: string | null | undefined,
  now: Date
): boolean {
  if (!dateOfBirth || dateOfBirth.length < 7) return false
  const birthMonth = Number(dateOfBirth.slice(5, 7))
  return birthMonth === londonYearMonth(now).month
}

/**
 * The first instant of the next London month — the birthday reward's expiry.
 * Month length (incl. Feb/leap) and the year rollover are handled by advancing
 * to the 1st of the next month.
 */
export function birthdayRewardExpiresAt(now: Date): Date {
  const { year, month } = londonYearMonth(now)
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  return londonWallClockToUtc(nextYear, nextMonth, 1, 0, 0)
}
