import type { ActivityDisplayRow } from "@/lib/merchant/activity"
import type { MerchantCustomerReadbackRow } from "@/lib/merchant/customer-readback"
import { maskAdminContact } from "@/components/admin/support"

/**
 * Deterministic, obviously-sample-but-plausible mock data for the merchant and
 * admin console preview harness. No real metrics, claims, or PII: venue and
 * person names are fictional, contacts are masked through the real
 * `maskAdminContact` policy so the preview shows exactly what an operator sees.
 *
 * Pure data + the masking helper (which is not `server-only`). Imported by the
 * `/dev` screen components only.
 */

// Fixed timestamps keep screenshots and a11y runs byte-stable across runs.
const T = {
  recent: "2026-06-18T09:14:00.000Z",
  earlier: "2026-06-17T16:02:00.000Z",
  joined: "2026-05-29T11:30:00.000Z",
  periodEnd: "2026-07-19T00:00:00.000Z",
} as const

export const MERCHANT_PREVIEW_MOCK = {
  businessName: "Old Crown Girton",
  businessType: "Pub",
  locationName: "Main counter",
  email: "hello@oldcrowngirton.example",
  phone: "07700 900123",
} as const

export const MERCHANT_DASHBOARD_METRICS = {
  members: 184,
  memberTrend: {
    label: "+5 vs last week",
    direction: "up" as const,
  },
  secondary: [
    {
      label: "New members (7d)",
      value: "23",
      trend: { label: "+5 vs last week", direction: "up" as const },
    },
    {
      label: "Stamps (7d)",
      value: "48",
      trend: { label: "+12 vs last week", direction: "up" as const },
    },
    {
      label: "Repeat customers",
      value: "96",
      helper: "Customers with two or more stamps, all time.",
    },
    {
      label: "Rewards (7d)",
      value: "9",
      trend: { label: "−2 vs last week", direction: "down" as const },
    },
    {
      label: "QR downloads (7d)",
      value: "3",
      trend: { label: "Same as last week", direction: "flat" as const },
    },
  ],
} as const

export const MERCHANT_COMPACT_ACTIVITY: ActivityDisplayRow[] = [
  {
    id: "act-compact-1",
    eventName: "stamp_issued",
    category: "stamp",
    badgeLabel: "Stamp",
    headline: "Stamp added · 2 of 3",
    summary: "A member collected today's stamp at the counter.",
    timestamp: T.recent,
    timestampLabel: "18 Jun 2026, 10:14",
    relativeTime: "2 hours ago",
    dateGroup: "2026-06-18",
    dateGroupLabel: "Today",
    details: [
      { label: "Member", value: "J. M." },
      { label: "Card", value: "Mystery Visit Card" },
    ],
    searchText: "stamp issued j m mystery visit card",
  },
  {
    id: "act-compact-2",
    eventName: "customer_joined",
    category: "customer",
    badgeLabel: "Join",
    headline: "New member joined",
    summary: "A customer saved your card from the venue QR.",
    timestamp: T.earlier,
    timestampLabel: "17 Jun 2026, 17:02",
    relativeTime: "Yesterday",
    dateGroup: "2026-06-17",
    dateGroupLabel: "Yesterday",
    details: [{ label: "Member", value: "A. P." }],
    searchText: "customer joined a p",
  },
  {
    id: "act-compact-3",
    eventName: "reward_redeemed",
    category: "reward",
    badgeLabel: "Reward",
    headline: "Reward collected",
    summary: "A member redeemed their surprise reward at the counter.",
    timestamp: T.earlier,
    timestampLabel: "17 Jun 2026, 15:40",
    relativeTime: "Yesterday",
    dateGroup: "2026-06-17",
    dateGroupLabel: "Yesterday",
    details: [
      { label: "Member", value: "S. R." },
      { label: "Reward", value: "Free filter coffee" },
    ],
    searchText: "reward redeemed s r free filter coffee",
  },
]

export const MERCHANT_ACTIVITY_FEED: ActivityDisplayRow[] = [
  ...MERCHANT_COMPACT_ACTIVITY,
  {
    id: "act-detail-4",
    eventName: "qr_downloaded",
    category: "qr",
    badgeLabel: "QR",
    headline: "Counter poster downloaded",
    summary: "The A4 counter poster was downloaded from the launch kit.",
    timestamp: T.joined,
    timestampLabel: "29 May 2026, 12:30",
    relativeTime: "3 weeks ago",
    dateGroup: "2026-05-29",
    dateGroupLabel: "29 May 2026",
    details: [{ label: "Asset", value: "Counter poster (A4)" }],
    primaryAction: { label: "Open launch kit", href: "/app/launch?tab=qr" },
    searchText: "qr downloaded counter poster a4",
  },
]

export const MERCHANT_CUSTOMERS: MerchantCustomerReadbackRow[] = [
  {
    id: "membership-1",
    identifier: "J. M.",
    initials: "JM",
    phoneLine: "Phone hashed",
    joinedLabel: "29 May 2026",
    joinedIso: T.joined,
    lastVisitLabel: "Today",
    lastVisitIso: T.recent,
    currentStampCount: 2,
    stampsRequired: 3,
    totalStampsEarned: 5,
    rewardsRedeemed: 1,
    badge: { label: "1 to go", tone: "waiting", redeemable: false },
    scanRewardId: null,
  },
  {
    id: "membership-2",
    identifier: "A. P.",
    initials: "AP",
    phoneLine: "Phone hashed",
    joinedLabel: "17 Jun 2026",
    joinedIso: T.earlier,
    lastVisitLabel: "Yesterday",
    lastVisitIso: T.earlier,
    currentStampCount: 0,
    stampsRequired: 3,
    totalStampsEarned: 0,
    rewardsRedeemed: 0,
    badge: { label: "New", tone: "new", redeemable: false },
    scanRewardId: null,
  },
  {
    id: "membership-3",
    identifier: "S. R.",
    initials: "SR",
    phoneLine: "Phone hashed",
    joinedLabel: "12 May 2026",
    joinedIso: "2026-05-12T10:00:00.000Z",
    lastVisitLabel: "Yesterday",
    lastVisitIso: T.earlier,
    currentStampCount: 3,
    stampsRequired: 3,
    totalStampsEarned: 6,
    rewardsRedeemed: 2,
    badge: { label: "Ready to redeem", tone: "ready", redeemable: true },
    scanRewardId: "00000000-0000-4000-8000-0000000000aa",
  },
]

// ---------------------------------------------------------------------------
// Admin mock data — shaped to the real admin readback rows used by the pages.
// Contacts run through maskAdminContact so the preview shows masked output.
// ---------------------------------------------------------------------------

export type AdminMerchantRow = {
  id: string
  business_name: string
  business_slug: string
  email: string
  status: string
  created_at: string
  billing_customers:
    | { status: string; plan: string; current_period_end: string }[]
    | null
}

export const ADMIN_MERCHANTS: AdminMerchantRow[] = [
  {
    id: "merchant-1",
    business_name: "Old Crown Girton",
    business_slug: "old-crown-girton",
    email: "hello@oldcrowngirton.example",
    status: "active",
    created_at: T.joined,
    billing_customers: [
      { status: "trialing", plan: "growth", current_period_end: T.periodEnd },
    ],
  },
  {
    id: "merchant-2",
    business_name: "Riverside Roastery",
    business_slug: "riverside-roastery",
    email: "team@riversideroastery.example",
    status: "active",
    created_at: T.earlier,
    billing_customers: [
      { status: "active", plan: "growth", current_period_end: T.periodEnd },
    ],
  },
  {
    id: "merchant-3",
    business_name: "Harbour Books & Coffee",
    business_slug: "harbour-books-coffee",
    email: "hello@harbourbooks.example",
    status: "pending",
    created_at: T.recent,
    billing_customers: null,
  },
]

export type AdminPilotMerchantRow = {
  id: string
  business_name: string
  email: string
  status: string
  created_at: string
  billing_customers: { status: string }[] | null
}

export const ADMIN_PILOT_MERCHANTS: AdminPilotMerchantRow[] =
  ADMIN_MERCHANTS.map((merchant) => ({
    id: merchant.id,
    business_name: merchant.business_name,
    email: merchant.email,
    status: merchant.status,
    created_at: merchant.created_at,
    billing_customers: merchant.billing_customers
      ? [{ status: merchant.billing_customers[0]!.status }]
      : null,
  }))

export type AdminPilotChecklistItem = {
  item: string
  value: number | string
  target: string
  source: string
}

export type AdminPilotMetricRow = {
  label: string
  value: number | string
  source: string
  target: string
}

export const ADMIN_PILOT_REPORT: {
  checklist: AdminPilotChecklistItem[]
  metrics: AdminPilotMetricRow[]
} = {
  checklist: [
    {
      item: "Merchants onboarded",
      value: 3,
      target: "Pilot target: 5",
      source: "Source: merchants table",
    },
    {
      item: "Cards live",
      value: 3,
      target: "Pilot target: 5",
      source: "Source: loyalty_cards",
    },
    {
      item: "Joins",
      value: 184,
      target: "Pilot target: 150",
      source: "Source: product_events",
    },
    {
      item: "Rewards redeemed",
      value: 41,
      target: "Pilot target: 25",
      source: "Source: reward_events",
    },
  ],
  metrics: [
    {
      label: "Merchant signed up",
      value: 3,
      source: "product_events",
      target: "5",
    },
    {
      label: "Loyalty card created",
      value: 3,
      source: "product_events",
      target: "5",
    },
    {
      label: "Customer joined",
      value: 184,
      source: "product_events",
      target: "150",
    },
    {
      label: "Stamp issued",
      value: 612,
      source: "product_events",
      target: "400",
    },
    {
      label: "Reward redeemed",
      value: 41,
      source: "reward_events",
      target: "25",
    },
  ],
}

export type AdminQrCodeRow = {
  id: string
  qr_id: string
  is_active: boolean
  created_at: string
  merchants: { business_name: string }[] | null
}

export const ADMIN_QR_CODES: AdminQrCodeRow[] = [
  {
    id: "qr-1",
    qr_id: "WHEF",
    is_active: true,
    created_at: T.joined,
    merchants: [{ business_name: "Old Crown Girton" }],
  },
  {
    id: "qr-2",
    qr_id: "RSTR",
    is_active: true,
    created_at: T.earlier,
    merchants: [{ business_name: "Riverside Roastery" }],
  },
]

export type AdminContactJoin = { email?: string; phone?: string }
export type AdminMerchantJoin = { business_name: string }

export type AdminCustomerRow = {
  id: string
  current_stamp_count: number
  total_stamps_earned: number
  total_rewards_redeemed: number
  created_at: string
  customers: AdminContactJoin[] | null
  merchants: AdminMerchantJoin[] | null
}

export const ADMIN_CUSTOMERS: AdminCustomerRow[] = [
  {
    id: "membership-1",
    current_stamp_count: 2,
    total_stamps_earned: 5,
    total_rewards_redeemed: 1,
    created_at: T.joined,
    customers: [{ email: "jordan.miller@example.com" }],
    merchants: [{ business_name: "Old Crown Girton" }],
  },
  {
    id: "membership-2",
    current_stamp_count: 0,
    total_stamps_earned: 0,
    total_rewards_redeemed: 0,
    created_at: T.earlier,
    customers: [{ phone: "+447700900456" }],
    merchants: [{ business_name: "Riverside Roastery" }],
  },
]

export type AdminRewardRow = {
  id: string
  status: string
  created_at: string
  customers: AdminContactJoin[] | null
  merchants: AdminMerchantJoin[] | null
  loyalty_cards: { reward_name: string }[] | null
}

export const ADMIN_REWARDS: AdminRewardRow[] = [
  {
    id: "reward-1",
    status: "assigned",
    created_at: T.recent,
    customers: [{ email: "sam.rowe@example.com" }],
    merchants: [{ business_name: "Old Crown Girton" }],
    loyalty_cards: [{ reward_name: "Free filter coffee" }],
  },
  {
    id: "reward-2",
    status: "redeemed",
    created_at: T.earlier,
    customers: [{ phone: "+447700900789" }],
    merchants: [{ business_name: "Riverside Roastery" }],
    loyalty_cards: [{ reward_name: "Pastry on the house" }],
  },
]

export type AdminBillingRow = {
  id: string
  plan: string
  status: string
  current_period_end: string
  stripe_subscription_id?: string
  merchants: { business_name: string; email: string }[] | null
}

export const ADMIN_BILLING: AdminBillingRow[] = [
  {
    id: "billing-1",
    plan: "growth",
    status: "trialing",
    current_period_end: T.periodEnd,
    stripe_subscription_id: "sub_demo_0001",
    merchants: [
      {
        business_name: "Old Crown Girton",
        email: "hello@oldcrowngirton.example",
      },
    ],
  },
  {
    id: "billing-2",
    plan: "growth",
    status: "active",
    current_period_end: T.periodEnd,
    stripe_subscription_id: "sub_demo_0002",
    merchants: [
      {
        business_name: "Riverside Roastery",
        email: "team@riversideroastery.example",
      },
    ],
  },
]

export type AdminPrivacyRow = {
  id: string
  merchant_id: string
  customer_id: string
  customers: AdminContactJoin[] | null
  merchants: AdminMerchantJoin[] | null
}

export const ADMIN_PRIVACY_ROWS: AdminPrivacyRow[] = [
  {
    id: "membership-1abc2def",
    merchant_id: "merchant-1aaa2bbb",
    customer_id: "customer-1ccc2ddd",
    customers: [{ email: "jordan.miller@example.com" }],
    merchants: [{ business_name: "Old Crown Girton" }],
  },
]

export type AdminConsentRow = {
  id: string
  channel: string
  consent_status: string
  source: string
  policy_version: string
  created_at: string
  customers: AdminContactJoin[] | null
  merchants: AdminMerchantJoin[] | null
}

export const ADMIN_CONSENT_RECORDS: AdminConsentRow[] = [
  {
    id: "consent-1",
    channel: "email",
    consent_status: "opted_in",
    source: "join_flow",
    policy_version: "2026-06-06",
    created_at: T.joined,
    customers: [{ email: "jordan.miller@example.com" }],
    merchants: [{ business_name: "Old Crown Girton" }],
  },
  {
    id: "consent-2",
    channel: "sms",
    consent_status: "opted_out",
    source: "support_request",
    policy_version: "2026-06-06",
    created_at: T.earlier,
    customers: [{ phone: "+447700900456" }],
    merchants: [{ business_name: "Riverside Roastery" }],
  },
]

export type AdminFraudFlagRow = {
  id: string
  signal: string
  severity: string
  status: string
  created_at: string
  customers: AdminContactJoin[] | null
  merchants: AdminMerchantJoin[] | null
}

export const ADMIN_FRAUD_FLAGS: AdminFraudFlagRow[] = [
  {
    id: "flag-1",
    signal: "geofence_distance",
    severity: "low",
    status: "open",
    created_at: T.recent,
    customers: [{ email: "jordan.miller@example.com" }],
    merchants: [{ business_name: "Old Crown Girton" }],
  },
  {
    id: "flag-2",
    signal: "rapid_repeat_attempt",
    severity: "medium",
    status: "reviewing",
    created_at: T.earlier,
    customers: [{ phone: "+447700900456" }],
    merchants: [{ business_name: "Riverside Roastery" }],
  },
]

export type AdminRedemptionFailureRow = {
  id: string
  event_name: string
  created_at: string
  merchants: AdminMerchantJoin[] | null
}

export const ADMIN_REDEMPTION_FAILURES: AdminRedemptionFailureRow[] = [
  {
    id: "failure-1",
    event_name: "reward_redeem_blocked_same_day",
    created_at: T.earlier,
    merchants: [{ business_name: "Riverside Roastery" }],
  },
]

export type AdminAuditRow = {
  id: string
  actor_type: string
  actor_id?: string
  action: string
  target_table: string
  target_id?: string
  created_at: string
  customers: AdminContactJoin[] | null
  merchants: AdminMerchantJoin[] | null
}

export const ADMIN_AUDIT_LOGS: AdminAuditRow[] = [
  {
    id: "audit-1",
    actor_type: "admin",
    actor_id: "operator-1aaa2bbb",
    action: "stamp_adjusted",
    target_table: "customer_memberships",
    target_id: "membership-1abc2def",
    created_at: T.recent,
    customers: [{ email: "jordan.miller@example.com" }],
    merchants: [{ business_name: "Old Crown Girton" }],
  },
  {
    id: "audit-2",
    actor_type: "admin",
    actor_id: "operator-1aaa2bbb",
    action: "qr_regenerated",
    target_table: "qr_codes",
    target_id: "qr-2cccdddd",
    created_at: T.earlier,
    customers: null,
    merchants: [{ business_name: "Riverside Roastery" }],
  },
]

export const ADMIN_OVERVIEW = {
  merchants: 3,
  customers: 184,
  billingIssues: 1,
} as const

export const ADMIN_FUNNEL_COUNTS: Record<string, number> = {
  "Merchant signed up": 3,
  "Loyalty card created": 3,
  "Customer joined": 184,
  "Stamp issued": 612,
  "Reward redeemed": 41,
}

export { maskAdminContact }
