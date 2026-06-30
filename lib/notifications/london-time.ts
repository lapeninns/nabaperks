/**
 * Pure Europe/London time helpers for the notification queue.
 *
 * Extracted from `delivery-worker.ts` (and de-duplicated from `events.ts`) so
 * the quiet-hours and business-date logic can be unit-tested in isolation —
 * this module has NO `server-only` or Supabase imports, only `Intl`/`Date`
 * math, so the unit runner can import it directly (see
 * `tests/unit/notification-quiet-hours.test.mjs`). The delivery worker imports
 * the call-level helpers from here and keeps its own call sites unchanged.
 */

function part(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((entry) => entry.type === type)?.value ?? "00"
}

/** "HH:MM" → minutes since midnight. */
export function timeToMinutes(value: string) {
  const [hours = "0", minutes = "0"] = value.split(":")
  return Number(hours) * 60 + Number(minutes)
}

/** Minutes since midnight in Europe/London for the given instant. */
export function londonMinutes(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)

  return timeToMinutes(`${part(parts, "hour")}:${part(parts, "minute")}`)
}

function londonDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  return {
    year: Number(part(parts, "year")),
    month: Number(part(parts, "month")),
    day: Number(part(parts, "day")),
  }
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

  return {
    ...londonDateParts(date),
    hour: Number(part(parts, "hour")),
    minute: Number(part(parts, "minute")),
  }
}

function londonWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number
) {
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

/** Europe/London calendar date as an ISO `YYYY-MM-DD` string. */
export function londonBusinessDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`
}

/**
 * True when the instant falls within the customer's quiet-hours window in
 * Europe/London. The default 21:00→09:00 window wraps past midnight.
 */
export function isWithinQuietHours(
  date: Date,
  quietHoursStart = "21:00",
  quietHoursEnd = "09:00"
) {
  const minutes = londonMinutes(date)
  const start = timeToMinutes(quietHoursStart)
  const end = timeToMinutes(quietHoursEnd)

  if (start === end) return false
  if (start < end) return minutes >= start && minutes < end

  return minutes >= start || minutes < end
}

/** The next instant at which quiet hours end (today's, or tomorrow's). */
export function nextQuietHoursEnd(date: Date, quietHoursEnd = "09:00") {
  const today = londonDateParts(date)
  const end = timeToMinutes(quietHoursEnd)
  const hour = Math.floor(end / 60)
  const minute = end % 60
  const next = londonWallClockToUtc(today.year, today.month, today.day, hour, minute)

  if (next > date) return next

  const tomorrowSeed = new Date(
    Date.UTC(today.year, today.month - 1, today.day + 1)
  )
  const tomorrow = londonDateParts(tomorrowSeed)
  return londonWallClockToUtc(tomorrow.year, tomorrow.month, tomorrow.day, hour, minute)
}
