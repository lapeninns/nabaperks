/**
 * Pure query state for the merchant Members list: the URL contract (`?q=`,
 * `?filter=`, `?page=`), the London day boundaries the reward/quiet predicates
 * compare against, and the ILIKE/PostgREST escaping the masked search uses.
 *
 * No IO and no `server-only` import on purpose — `lib/merchant/customers-view.ts`
 * owns the Supabase calls that consume these shapes, and the unit runner can
 * execute everything here directly.
 */

import {
  addUkCalendarDays,
  formatLondonIso,
} from "@/lib/customer/uk-calendar"
import { MERCHANT_GONE_QUIET_DAYS } from "@/lib/merchant/customer-readback"

/** Status narrowing offered by the members filter bar. */
const CUSTOMER_FILTERS = ["all", "ready", "active", "quiet"] as const

export type CustomerFilter = (typeof CUSTOMER_FILTERS)[number]

/** Longest search fragment accepted from the URL. */
export const CUSTOMER_SEARCH_TERM_MAX_LENGTH = 64

/**
 * Ceiling on an id list that one query hands to the next query's `.in(...)`.
 * PostgREST carries that list in the request URL, so it has to stay bounded;
 * 200 uuids is ~7.4kB, well inside any proxy's request-line limit. Past the cap
 * the merchant sees the newest 200 matches and a readback line that says so,
 * rather than a truncated list presented as the whole answer.
 */
export const CUSTOMER_MATCH_ID_CAP = 200

const LONDON = "Europe/London"

const LONDON_CLOCK_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

type SearchParamValue = string | readonly string[] | undefined

function firstParam(value: SearchParamValue): string | undefined {
  return Array.isArray(value) ? value[0] : (value as string | undefined)
}

/**
 * Read `?filter=` into a known status. Anything unrecognised resolves to "all"
 * rather than throwing: a stale or hand-edited URL should show the whole list,
 * never an empty one that reads as "this venue has no members".
 */
export function parseCustomerFilterParam(
  value: SearchParamValue
): CustomerFilter {
  const raw = firstParam(value)?.trim().toLowerCase() ?? ""
  return (CUSTOMER_FILTERS as readonly string[]).includes(raw)
    ? (raw as CustomerFilter)
    : "all"
}

/**
 * Normalise `?q=`: first entry of a repeated param, control characters
 * flattened, whitespace collapsed, trimmed, length-capped. Returns undefined
 * when nothing searchable remains, so the loader skips the match query rather
 * than running an unbounded `%%` scan.
 */
export function parseCustomerSearchParam(
  value: SearchParamValue
): string | undefined {
  const raw = firstParam(value)
  if (typeof raw !== "string") return undefined

  const cleaned = raw
    .replaceAll(/[\u0000-\u001f\u007f]/g, " ")
    .replaceAll(/\s+/g, " ")
    .trim()
    .slice(0, CUSTOMER_SEARCH_TERM_MAX_LENGTH)

  return cleaned.length > 0 ? cleaned : undefined
}

/** Escape `%`, `_` and `\` so a typed fragment matches literally under ILIKE. */
export function escapeLikePattern(term: string): string {
  return term
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
}

/** Contains-style ILIKE pattern for a literal fragment. */
export function containsPattern(term: string): string {
  return `%${escapeLikePattern(term)}%`
}

/**
 * Double-quote a value for PostgREST filter syntax so `,` `(` `)` `.` inside it
 * stay part of the value instead of splitting an `or=()` expression.
 */
export function quotePostgrestValue(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
}

/**
 * `or=()` fragment matching a search term against the two columns the merchant
 * can actually see. Both live on the `public.customers_masked` VIEW, whose
 * `email` is already the `a***@domain` string the console renders and whose
 * `phone_last4` is the surviving contact digits — plaintext `customers.phone`
 * was retired in `supabase/migrations/20260707095000`. So a server-side search
 * reads exactly what the merchant sees and never touches raw contact data.
 */
export function maskedContactOrIlikeFilter(term: string): string {
  const quoted = quotePostgrestValue(containsPattern(term))
  return `email.ilike.${quoted},phone_last4.ilike.${quoted}`
}

function londonOffsetMs(at: Date): number {
  const parts = LONDON_CLOCK_FORMAT.formatToParts(at)
  const part = (type: string) =>
    Number(parts.find((entry) => entry.type === type)?.value)
  // `hour12: false` renders midnight as 24 in some ICU versions.
  const asUtc = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour") % 24,
    part("minute"),
    part("second")
  )
  return asUtc - Math.floor(at.getTime() / 1000) * 1000
}

/**
 * The instant at 00:00 Europe/London on a `YYYY-MM-DD` day key. Two passes:
 * guess using the offset in force at the UTC-midnight instant, then re-read the
 * offset at the guessed instant so a BST/GMT switch resolves correctly.
 */
export function londonDayStartInstant(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number)
  const utcMidnight = Date.UTC(year, month - 1, day)
  const firstPass = utcMidnight - londonOffsetMs(new Date(utcMidnight))
  return new Date(utcMidnight - londonOffsetMs(new Date(firstPass)))
}

export type CustomerFilterBoundaries = {
  /**
   * `reward_events.redeemable_from` is a DATE, and the badge compares it as a
   * London day key, so this is a day key too — not an instant.
   */
  readonly redeemableOnOrBeforeKey: string
  /** Memberships created at or after this instant joined today. */
  readonly joinedTodayFromIso: string
  /** A last visit strictly before this is MERCHANT_GONE_QUIET_DAYS days old. */
  readonly quietBeforeIso: string
}

/**
 * The boundaries the members filter compares against, derived from the SAME
 * London calendar-day arithmetic `deriveMerchantCustomerRewardBadge` uses, so a
 * row the `ready` filter returns is a row the badge calls "Reward ready".
 */
export function resolveCustomerFilterBoundaries(
  now: Date = new Date()
): CustomerFilterBoundaries {
  const todayKey = formatLondonIso(now)

  return {
    redeemableOnOrBeforeKey: todayKey,
    joinedTodayFromIso: londonDayStartInstant(todayKey).toISOString(),
    // `isGoneQuiet` is `>= MERCHANT_GONE_QUIET_DAYS` whole London days, i.e.
    // the last visit landed on or before todayKey - 30, i.e. strictly before
    // the start of todayKey - 29.
    quietBeforeIso: londonDayStartInstant(
      addUkCalendarDays(todayKey, -(MERCHANT_GONE_QUIET_DAYS - 1))
    ).toISOString(),
  }
}

export type CustomersHrefParams = {
  readonly page?: number
  readonly filter?: CustomerFilter
  readonly query?: string
  readonly highlight?: string
  /**
   * Route the links point at. Only the /dev harness overrides it — the real
   * component is mounted there, and without this every pill click would
   * navigate out of the harness into the auth-gated console route.
   */
  readonly basePath?: string
}

/**
 * Canonical members URL. Page 1, the "all" filter and an empty search stay
 * implicit so the console never links to `?page=1&filter=all&q=`.
 */
export function buildCustomersHref(params: CustomersHrefParams = {}): string {
  const search = new URLSearchParams()

  if (params.filter && params.filter !== "all") {
    search.set("filter", params.filter)
  }
  const query = params.query?.trim()
  if (query) search.set("q", query)
  if (params.page && params.page > 1) search.set("page", String(params.page))
  if (params.highlight) search.set("highlight", params.highlight)

  const basePath = params.basePath ?? "/app/customers"
  const queryString = search.toString()
  return queryString ? `${basePath}?${queryString}` : basePath
}
