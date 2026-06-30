import {
  addUkCalendarDays,
  formatStampDisplayDateFromIso,
} from "@/lib/customer/uk-calendar"
import {
  formatMerchantCustomerIdentifier,
  type MerchantCustomerIdentity,
} from "@/lib/merchant/customer-identity-display"
import type { MerchantCustomerRow } from "@/lib/merchant/dashboard"

const LONDON = "Europe/London"

// Intl.DateTimeFormat construction is heavy in Node, and
// buildMerchantCustomerReadback runs these on every membership row. The options
// are invariant, so the formatters are hoisted to module-level singletons.
const LONDON_DATE_KEY_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: LONDON,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const JOINED_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  day: "numeric",
  month: "short",
})
const LAST_VISIT_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})
const LAST_VISIT_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  weekday: "short",
  day: "numeric",
  month: "short",
})

/** Default loyalty card size when a merchant has not configured one yet. */
export const DEFAULT_STAMPS_REQUIRED = 3

/** Merchant-configurable visit range for mystery cards at launch. */
export const MIN_STAMPS_REQUIRED = DEFAULT_STAMPS_REQUIRED
export const MAX_STAMPS_REQUIRED = 6

/** A member with no visit for this many UK days reads as "gone quiet". */
export const MERCHANT_GONE_QUIET_DAYS = 30

export type MerchantCustomerRewardTone =
  | "ready"
  | "waiting"
  | "new"
  | "quiet"
  | "redeemed"
  | "collecting"

export type MerchantCustomerRewardBadge = {
  label: string
  tone: MerchantCustomerRewardTone
  /** True only when a merchant can scan and collect the reward today. */
  redeemable: boolean
}

export type MerchantCustomerRewardInput = {
  createdAt: string
  lastVisitAt: string | null
  currentStampCount: number
  stampsRequired: number
  lastRedeemedAt: string | null
  activeReward: { id: string; redeemableFrom: string | null } | null
}

/**
 * Masked-safe row the merchant Customers table renders. The client table only
 * ever receives these view models — raw email and phone never leave the server.
 */
export type MerchantCustomerReadbackRow = {
  id: string
  identifier: string
  initials: string
  phoneLine: string | null
  joinedLabel: string
  joinedIso: string
  lastVisitLabel: string
  lastVisitIso: string | null
  currentStampCount: number
  stampsRequired: number
  totalStampsEarned: number
  rewardsRedeemed: number
  badge: MerchantCustomerRewardBadge
}

/**
 * Reward status for a membership, first match wins:
 * ready → waiting → new today → gone quiet → redeemed → collecting.
 */
export function deriveMerchantCustomerRewardBadge(
  input: MerchantCustomerRewardInput,
  now: Date = new Date()
): MerchantCustomerRewardBadge {
  const todayKey = londonDateKey(now)
  const active = input.activeReward

  if (active) {
    const redeemableKey = active.redeemableFrom
      ? londonDateKey(active.redeemableFrom)
      : todayKey

    if (redeemableKey <= todayKey) {
      return { label: "Reward ready", tone: "ready", redeemable: true }
    }

    if (input.currentStampCount >= input.stampsRequired) {
      return { label: "Reward waiting", tone: "waiting", redeemable: false }
    }
  }

  if (londonDateKey(input.createdAt) === todayKey) {
    return { label: "New today", tone: "new", redeemable: false }
  }

  if (isGoneQuiet(input.lastVisitAt, now)) {
    return { label: "Gone quiet", tone: "quiet", redeemable: false }
  }

  if (input.lastRedeemedAt) {
    const date = formatStampDisplayDateFromIso(
      londonDateKey(input.lastRedeemedAt)
    )
    return { label: `Redeemed ${date}`, tone: "redeemed", redeemable: false }
  }

  return { label: "Collecting", tone: "collecting", redeemable: false }
}

/** Two-character roundel text derived only from masked-safe identity data. */
export function deriveMerchantCustomerInitials(
  identity: MerchantCustomerIdentity
): string {
  const email = identity.email?.trim()
  if (email) {
    const at = email.indexOf("@")
    if (at > 0) {
      const local = email.slice(0, at)
      const domain = email.slice(at + 1)
      const first = local[0] ?? ""
      const second = domain.replace(/[^a-z0-9]/gi, "")[0] ?? ""
      return `${first}${second}`.toUpperCase()
    }
    return email[0]?.toUpperCase() ?? ""
  }

  return phoneTail(identity) ?? ""
}

/** Decorative hashed phone line, e.g. `07 ··· ··· 48`. Never the raw number. */
export function formatHashedPhoneLine(
  identity: MerchantCustomerIdentity
): string | null {
  const tail = phoneTail(identity)
  return tail ? `07 ··· ··· ${tail}` : null
}

export function formatJoinedDate(iso: string, now: Date = new Date()): string {
  const todayKey = londonDateKey(now)
  const key = londonDateKey(iso)
  if (key === todayKey) return "Today"
  if (key === addUkCalendarDays(todayKey, -1)) return "Yesterday"
  return JOINED_DATE_FORMAT.format(new Date(iso))
}

export function formatLastVisit(
  iso: string | null,
  now: Date = new Date()
): string {
  if (!iso) return "Not yet"

  const todayKey = londonDateKey(now)
  const key = londonDateKey(iso)
  if (key === todayKey) {
    const time = LAST_VISIT_TIME_FORMAT.format(new Date(iso))
    return `Today ${time}`
  }
  if (key === addUkCalendarDays(todayKey, -1)) return "Yesterday"

  return LAST_VISIT_DATE_FORMAT.format(new Date(iso))
}

/** Compose a single membership row into the masked-safe table view model. */
export function buildMerchantCustomerReadback(
  row: MerchantCustomerRow,
  now: Date = new Date()
): MerchantCustomerReadbackRow {
  const identity: MerchantCustomerIdentity = {
    email: row.customer.email,
    phone: row.customer.phone,
    phoneLast4: row.customer.phone_last4,
  }

  const badge = deriveMerchantCustomerRewardBadge(
    {
      createdAt: row.created_at,
      lastVisitAt: row.last_visit_at,
      currentStampCount: row.current_stamp_count,
      stampsRequired: row.stamps_required,
      lastRedeemedAt: row.last_redeemed_at,
      activeReward: row.activeReward
        ? {
            id: row.activeReward.id,
            redeemableFrom: row.activeReward.redeemable_from,
          }
        : null,
    },
    now
  )

  // The supplementary hashed phone line only adds signal when the identifier is
  // the email; for phone-only members it would just echo "Phone ending …".
  const phoneLine =
    identity.email && (identity.phone || identity.phoneLast4)
      ? formatHashedPhoneLine(identity)
      : null

  return {
    id: row.id,
    identifier: formatMerchantCustomerIdentifier(identity),
    initials: deriveMerchantCustomerInitials(identity),
    phoneLine,
    joinedLabel: formatJoinedDate(row.created_at, now),
    joinedIso: row.created_at,
    lastVisitLabel: formatLastVisit(row.last_visit_at, now),
    lastVisitIso: row.last_visit_at,
    currentStampCount: row.current_stamp_count,
    stampsRequired: row.stamps_required,
    totalStampsEarned: row.total_stamps_earned,
    rewardsRedeemed: row.total_rewards_redeemed,
    badge,
  }
}

function phoneTail(identity: MerchantCustomerIdentity): string | null {
  const digits = onlyDigits(identity.phone) || onlyDigits(identity.phoneLast4)
  return digits.length >= 2 ? digits.slice(-2) : null
}

function onlyDigits(value: string | null | undefined): string {
  return [...(value ?? "")]
    .filter((char) => char >= "0" && char <= "9")
    .join("")
}

function isGoneQuiet(lastVisitAt: string | null, now: Date): boolean {
  if (!lastVisitAt) return true
  return (
    daysBetweenLondonDates(londonDateKey(lastVisitAt), londonDateKey(now)) >=
    MERCHANT_GONE_QUIET_DAYS
  )
}

function londonDateKey(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  const parts = LONDON_DATE_KEY_FORMAT.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  return `${year}-${month}-${day}`
}

function daysBetweenLondonDates(fromKey: string, toKey: string): number {
  const [fromYear, fromMonth, fromDay] = fromKey.split("-").map(Number)
  const [toYear, toMonth, toDay] = toKey.split("-").map(Number)
  return Math.floor(
    (Date.UTC(toYear, toMonth - 1, toDay) -
      Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86_400_000
  )
}
