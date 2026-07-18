/**
 * DB-free deterministic fixtures for the unauthenticated /dev/app-harness lane.
 *
 * Mirrors the masked-safe view-model shapes the REAL /app body components
 * accept (MerchantCustomerReadbackRow, ActivityDisplayRow, ActivitySummary,
 * etc.) so the harness mounts production components rather than re-creations.
 *
 * Every value here is a literal — no `Math.random`, no `Date.now`, no
 * `new Date()` — so a headless screenshot at a given width is byte-stable
 * across runs. Relative-time / "Joined Today" style copy is pre-baked into the
 * label fields because the real loaders compute those server-side and we are
 * bypassing them.
 */

import type {
  ActivityDisplayRow,
  ActivitySummary,
} from "@/lib/merchant/activity"
import type { MerchantDashboardMerchant } from "@/lib/merchant/dashboard"
import type { MerchantCustomerReadbackRow } from "@/lib/merchant/customer-readback"

// ─── Merchant identity ──────────────────────────────────────────────────────

export const HARNESS_MERCHANT: MerchantDashboardMerchant = {
  id: "mrc_harness_old_crown",
  business_name: "Old Crown Girton",
  status: "active",
}

// ─── Dashboard KPI strip ────────────────────────────────────────────────────

/** A 14-point series, deterministic, shaped to read like a real sparkline. */
const SERIES_MEMBERS = [
  1788, 1794, 1801, 1805, 1809, 1812, 1818, 1823, 1827, 1830, 1834, 1837, 1840,
  1842,
]
const SERIES_JOINS = [4, 2, 5, 3, 6, 1, 7, 4, 3, 5, 2, 6, 4, 3]
const SERIES_STAMPS = [38, 41, 35, 52, 47, 29, 61, 44, 50, 39, 55, 48, 42, 57]
const SERIES_REWARDS = [2, 1, 3, 0, 2, 1, 4, 2, 1, 3, 2, 1, 2, 3]

export const HARNESS_KPIS = [
  {
    label: "Members",
    value: 1842,
    series: SERIES_MEMBERS,
    seriesColor: "var(--w-leaf)",
    trend: null as { label: string; direction: "up" | "down" | "flat" } | null,
  },
  {
    label: "New (7d)",
    value: 31,
    series: SERIES_JOINS,
    seriesColor: undefined,
    trend: { label: "+18%", direction: "up" as const },
  },
  {
    label: "Stamps (7d)",
    value: 347,
    series: SERIES_STAMPS,
    seriesColor: undefined,
    trend: { label: "+12%", direction: "up" as const },
  },
  {
    label: "Rewards (7d)",
    value: 14,
    series: SERIES_REWARDS,
    seriesColor: undefined,
    trend: { label: "-4%", direction: "down" as const },
  },
] as const

export const HARNESS_TREND_SERIES = [
  {
    label: "Stamps",
    color: "var(--primary)",
    data: SERIES_STAMPS,
    fill: true,
  },
  {
    label: "Joins",
    color: "var(--w-cobalt)",
    data: SERIES_JOINS,
  },
] as const

export const HARNESS_NEXT_ACTIONS: {
  readyCount: number
  quietCount: number
  repeatCustomers: number
  members: number
} = {
  readyCount: 3,
  quietCount: 12,
  repeatCustomers: 862,
  members: 1842,
}

// ─── Members (customers) table ──────────────────────────────────────────────

export const HARNESS_CUSTOMER_ROWS: MerchantCustomerReadbackRow[] = [
  {
    id: "mbr_0f3a91",
    identifier: "Phone ending 421",
    initials: "07",
    phoneLine: null,
    joinedLabel: "12 May",
    joinedIso: "2026-05-12T10:24:00.000Z",
    lastVisitLabel: "Today 09:42",
    lastVisitIso: "2026-06-29T08:42:00.000Z",
    currentStampCount: 3,
    stampsRequired: 3,
    totalStampsEarned: 18,
    rewardsRedeemed: 5,
    badge: { label: "Reward ready", tone: "ready", redeemable: true },
  },
  {
    id: "mbr_77c204",
    identifier: "j••@gmail.com",
    initials: "JG",
    phoneLine: "07 ··· ··· 88",
    joinedLabel: "03 Jun",
    joinedIso: "2026-06-03T16:10:00.000Z",
    lastVisitLabel: "Wed 24 Jun",
    lastVisitIso: "2026-06-24T13:05:00.000Z",
    currentStampCount: 3,
    stampsRequired: 3,
    totalStampsEarned: 9,
    rewardsRedeemed: 2,
    badge: { label: "Reward waiting", tone: "waiting", redeemable: false },
  },
  {
    id: "mbr_91ab02",
    identifier: "Phone ending 305",
    initials: "07",
    phoneLine: null,
    joinedLabel: "Today",
    joinedIso: "2026-06-29T07:55:00.000Z",
    lastVisitLabel: "Today 08:55",
    lastVisitIso: "2026-06-29T07:55:00.000Z",
    currentStampCount: 1,
    stampsRequired: 3,
    totalStampsEarned: 1,
    rewardsRedeemed: 0,
    badge: { label: "New today", tone: "new", redeemable: false },
  },
  {
    id: "mbr_4d5e66",
    identifier: "m••@outlook.com",
    initials: "MO",
    phoneLine: "07 ··· ··· 12",
    joinedLabel: "21 Apr",
    joinedIso: "2026-04-21T11:00:00.000Z",
    lastVisitLabel: "Fri 22 May",
    lastVisitIso: "2026-05-22T18:30:00.000Z",
    currentStampCount: 2,
    stampsRequired: 6,
    totalStampsEarned: 14,
    rewardsRedeemed: 2,
    badge: { label: "Gone quiet", tone: "quiet", redeemable: false },
  },
  {
    id: "mbr_b2f810",
    identifier: "Phone ending 770",
    initials: "07",
    phoneLine: null,
    joinedLabel: "08 Mar",
    joinedIso: "2026-03-08T09:15:00.000Z",
    lastVisitLabel: "Mon 23 Jun",
    lastVisitIso: "2026-06-23T12:48:00.000Z",
    currentStampCount: 2,
    stampsRequired: 3,
    totalStampsEarned: 23,
    rewardsRedeemed: 7,
    badge: { label: "Redeemed 21 Jun", tone: "redeemed", redeemable: false },
  },
  {
    id: "mbr_c19d47",
    identifier: "s••@icloud.com",
    initials: "SI",
    phoneLine: "07 ··· ··· 39",
    joinedLabel: "17 Jun",
    joinedIso: "2026-06-17T14:20:00.000Z",
    lastVisitLabel: "Thu 25 Jun",
    lastVisitIso: "2026-06-25T17:12:00.000Z",
    currentStampCount: 1,
    stampsRequired: 3,
    totalStampsEarned: 1,
    rewardsRedeemed: 0,
    badge: { label: "Collecting", tone: "collecting", redeemable: false },
  },
]

export const HARNESS_TOTAL_MEMBERS = 1842

// ─── Activity feed ──────────────────────────────────────────────────────────

export const HARNESS_ACTIVITY_SUMMARY: ActivitySummary = {
  total: 96,
  joins: 31,
  stamps: 347,
  rewards: 14,
  qrEvents: 58,
  accountEvents: 2,
}

export const HARNESS_ACTIVITY_ROWS: ActivityDisplayRow[] = [
  {
    id: "evt_join_1",
    eventName: "customer_joined",
    category: "customer",
    badgeLabel: "Join",
    headline: "Phone ending 305 joined",
    summary: "Joined via venue QR and accepted the loyalty programme.",
    timestamp: "2026-06-29T07:55:00.000Z",
    timestampLabel: "Mon 29 Jun 2026, 08:55",
    relativeTime: "12 min ago",
    dateGroup: "today",
    dateGroupLabel: "Today",
    details: [],
    primaryAction: {
      label: "View member",
      href: "/app/customers?highlight=mbr_91ab02",
    },
    searchText: "customer joined phone ending 305",
  },
  {
    id: "evt_stamp_1",
    eventName: "stamp_issued",
    category: "stamp",
    badgeLabel: "Stamp collected",
    headline: "Phone ending 421 collected stamp 3",
    summary: "Customer stamp was issued from the venue QR.",
    timestamp: "2026-06-29T08:42:00.000Z",
    timestampLabel: "Mon 29 Jun 2026, 09:42",
    relativeTime: "Just now",
    dateGroup: "today",
    dateGroupLabel: "Today",
    details: [],
    primaryAction: {
      label: "View member",
      href: "/app/customers?highlight=mbr_0f3a91",
    },
    searchText: "stamp issued phone ending 421",
  },
  {
    id: "evt_reward_1",
    eventName: "reward_redeemed",
    category: "reward",
    badgeLabel: "Reward redeemed",
    headline: "Phone ending 770 redeemed a reward",
    summary: "The customer redeemed a reward.",
    timestamp: "2026-06-29T06:10:00.000Z",
    timestampLabel: "Mon 29 Jun 2026, 07:10",
    relativeTime: "2 hr ago",
    dateGroup: "today",
    dateGroupLabel: "Today",
    details: [],
    primaryAction: {
      label: "View member",
      href: "/app/customers?highlight=mbr_b2f810",
    },
    searchText: "reward redeemed phone ending 770",
  },
  {
    id: "evt_qr_1",
    eventName: "qr_scanned",
    category: "qr",
    badgeLabel: "QR scanned",
    headline: "Someone scanned the QR",
    summary: "A customer opened the venue QR resolver.",
    timestamp: "2026-06-28T19:30:00.000Z",
    timestampLabel: "Sun 28 Jun 2026, 20:30",
    relativeTime: "Yesterday",
    dateGroup: "yesterday",
    dateGroupLabel: "Yesterday",
    details: [],
    primaryAction: { label: "Open QR", href: "/app/qr" },
    searchText: "qr scanned",
  },
  {
    id: "evt_qr_2",
    eventName: "qr_downloaded",
    category: "qr",
    badgeLabel: "QR downloaded",
    headline: "Editorial QR downloaded",
    summary: "A printable or till-ready QR asset was saved.",
    timestamp: "2026-06-28T15:02:00.000Z",
    timestampLabel: "Sun 28 Jun 2026, 16:02",
    relativeTime: "Yesterday",
    dateGroup: "yesterday",
    dateGroupLabel: "Yesterday",
    details: [],
    primaryAction: { label: "Open QR", href: "/app/qr" },
    searchText: "qr downloaded garden asset",
  },
  {
    id: "evt_account_1",
    eventName: "loyalty_card_updated",
    category: "account",
    badgeLabel: "Card setup",
    headline: "Loyalty card setup updated",
    summary: "Stamp target, reward copy, or card status changed.",
    timestamp: "2026-06-27T11:45:00.000Z",
    timestampLabel: "Sat 27 Jun 2026, 12:45",
    relativeTime: "2 days ago",
    dateGroup: "earlier-2026-06-27",
    dateGroupLabel: "Sat 27 Jun",
    details: [],
    primaryAction: { label: "Open card setup", href: "/app/launch?tab=card" },
    searchText: "loyalty card updated card setup",
  },
]
