import { formatRewardReadyDate } from "@/lib/customer/uk-calendar"

/**
 * When a guest can earn their next normal visit stamp, phrased for the stamp
 * screen. Pure: loaders fetch the venue's trading date and its configured
 * day start, this works out the instant and the words.
 *
 * The rule it mirrors is the database's, not a guess at one. A stamp's day is
 * `public.venue_trading_date(merchant, now())`, which is the London wall-clock
 * time minus the primary location's `trading_day_starts_at`, cast to a date
 * (supabase/migrations/20260923100000_venue_trading_day.sql), and
 * `private.issue_visit_stamp` allows one earned stamp per trading day
 * (NBS01, 20261005100500). So the next stamp opens at the first instant whose
 * trading date is the day after today's: the next day at the configured start,
 * on the Europe/London clock, whatever the daylight-saving offset.
 *
 * When the inputs cannot be trusted the helpers return null, and the copy falls
 * back to "on your next visit" rather than inventing a time.
 */

const LONDON = "Europe/London"
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
/** `HH:MM` or Postgres `time` text `HH:MM:SS`. */
const TIME_OF_DAY = /^(\d{2}):(\d{2})(?::(\d{2}))?$/
/** `merchant_locations_trading_day_starts_at_check`: 00:00 to 12:00. */
const LATEST_START_SECONDS = 12 * 60 * 60
const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

/** The column default, used by the SQL when a venue has no location row. */
export const DEFAULT_TRADING_DAY_START = "05:00"

const NEXT_VISIT_STAMP_LINE =
  "You can get your next stamp on your next visit." as const

const STAMPED_TODAY_FALLBACK_LINE = "Come back on your next visit." as const

const LONDON_WALL = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
})

type WallClock = {
  date: string
  hour: number
  minute: number
  second: number
}

function londonWallClock(instant: Date): WallClock {
  const parts = LONDON_WALL.formatToParts(instant)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "00"
  return {
    date: `${part("year")}-${part("month")}-${part("day")}`,
    hour: Number(part("hour")),
    minute: Number(part("minute")),
    second: Number(part("second")),
  }
}

/** Sortable `YYYY-MM-DDTHH:MM:SS` key for a London wall-clock reading. */
function wallKey(wall: WallClock): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${wall.date}T${pad(wall.hour)}:${pad(wall.minute)}:${pad(wall.second)}`
}

/** Seconds after midnight for a valid trading-day start, else null. */
export function parseTradingDayStart(
  value: string | null | undefined
): number | null {
  const match = TIME_OF_DAY.exec(value?.trim() ?? "")
  if (!match) return null
  const [hours, minutes, seconds] = [match[1], match[2], match[3] ?? "0"].map(
    Number
  )
  if (minutes > 59 || seconds > 59) return null
  const total = hours * 3600 + minutes * 60 + seconds
  return total <= LATEST_START_SECONDS ? total : null
}

function parseDateOnly(value: string): [number, number, number] | null {
  const match = DATE_ONLY.exec(value)
  if (!match) return null
  const [year, month, day] = [match[1], match[2], match[3]].map(Number)
  const check = new Date(Date.UTC(year, month - 1, day))
  return check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? [year, month, day]
    : null
}

/**
 * The venue trading date at an instant, as `public.venue_trading_date`
 * computes it: London wall-clock time minus the day start, as a date.
 */
export function venueTradingDateAt(
  at: Date,
  tradingDayStartsAt: string | null | undefined
): string | null {
  const start = parseTradingDayStart(tradingDayStartsAt)
  if (start === null || Number.isNaN(at.getTime())) return null
  const wall = londonWallClock(at)
  const parsed = parseDateOnly(wall.date)
  if (!parsed) return null
  const [year, month, day] = parsed
  const shifted = new Date(
    Date.UTC(year, month - 1, day, wall.hour, wall.minute, wall.second) -
      start * 1000
  )
  return shifted.toISOString().slice(0, 10)
}

/**
 * The first instant (ISO, UTC) whose venue trading date is the one after
 * `tradingDate`: the next day at the configured start, London time.
 *
 * Daylight saving: London is UTC or UTC+1, so the answer is one of the two
 * readings of that wall time. A time that happens twice (the October change)
 * opens at its first occurrence. A time that does not exist (the March change)
 * opens when the clocks jump past it, because that is when the trading date
 * computed from the wall clock moves on.
 */
export function nextStampAvailableAt({
  tradingDate,
  tradingDayStartsAt,
}: {
  tradingDate: string | null | undefined
  tradingDayStartsAt: string | null | undefined
}): string | null {
  const start = parseTradingDayStart(tradingDayStartsAt)
  const parsed = tradingDate ? parseDateOnly(tradingDate) : null
  if (start === null || !parsed) return null

  const [year, month, day] = parsed
  const hours = Math.floor(start / 3600)
  const minutes = Math.floor((start % 3600) / 60)
  const seconds = start % 60
  // Wall time as if London were on UTC; the real instant is this or an hour
  // earlier (British Summer Time).
  const naive = Date.UTC(year, month - 1, day + 1, hours, minutes, seconds)
  const target = wallKey({
    date: new Date(naive).toISOString().slice(0, 10),
    hour: hours,
    minute: minutes,
    second: seconds,
  })

  const summer = naive - HOUR_MS
  if (wallKey(londonWallClock(new Date(summer))) === target) {
    return new Date(summer).toISOString()
  }
  if (wallKey(londonWallClock(new Date(naive))) === target) {
    return new Date(naive).toISOString()
  }

  // The wall time was skipped: find the minute the clocks jumped past it.
  for (
    let instant = Math.floor(summer / MINUTE_MS) * MINUTE_MS;
    instant <= naive;
    instant += MINUTE_MS
  ) {
    if (wallKey(londonWallClock(new Date(instant))) >= target) {
      return new Date(instant).toISOString()
    }
  }
  return null
}

/** `Thu 1 Oct, 06:00`, London time, or null for a missing or bad instant. */
export function formatNextStampFrom(
  instantIso: string | null | undefined
): string | null {
  if (!instantIso) return null
  const instant = new Date(instantIso)
  if (Number.isNaN(instant.getTime())) return null
  // A start with seconds opens part-way through a minute; show the first
  // whole minute at which the stamp is open, never one before it.
  const shown =
    instant.getUTCSeconds() > 0 || instant.getUTCMilliseconds() > 0
      ? new Date(Math.ceil(instant.getTime() / MINUTE_MS) * MINUTE_MS)
      : instant
  const wall = londonWallClock(shown)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${formatRewardReadyDate(shown.toISOString())}, ${pad(wall.hour)}:${pad(wall.minute)}`
}

/** The quiet line under a stamp that has just landed. */
export function nextStampLine(instantIso: string | null | undefined): string {
  const label = formatNextStampFrom(instantIso)
  return label ? `Next stamp from ${label}.` : NEXT_VISIT_STAMP_LINE
}

/** The support line when today's stamp is already on the card. */
export function stampedTodayLine(
  instantIso: string | null | undefined
): string {
  const label = formatNextStampFrom(instantIso)
  return label ? `Next stamp from ${label}.` : STAMPED_TODAY_FALLBACK_LINE
}
