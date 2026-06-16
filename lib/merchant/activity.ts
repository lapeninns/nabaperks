import "server-only"

import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

const activityEvents = [
  "qr_scanned",
  "customer_joined",
  "stamp_claim_started",
  "stamp_issued",
  "reward_unlocked",
  "reward_redeemed",
  "qr_downloaded",
  "qr_created",
  "qr_enabled",
  "qr_disabled",
  "loyalty_card_created",
  "loyalty_card_updated",
  "merchant_signed_up",
  "subscription_started",
  "subscription_cancelled",
] as const

export type ActivityEventName = (typeof activityEvents)[number] | string

export type ActivityCategory =
  | "customer"
  | "stamp"
  | "reward"
  | "qr"
  | "account"

export type ActivityDetail = {
  label: string
  value: string
}

export type ActivityAction = {
  label: string
  href: string
}

export type ActivityDisplayRow = {
  id: string
  eventName: string
  category: ActivityCategory
  badgeLabel: string
  headline: string
  summary: string
  timestamp: string
  timestampLabel: string
  relativeTime: string
  dateGroup: string
  dateGroupLabel: string
  details: ActivityDetail[]
  primaryAction?: ActivityAction
  secondaryAction?: ActivityAction
  searchText: string
}

export type ActivitySummary = {
  total: number
  joins: number
  stamps: number
  rewards: number
  qrEvents: number
  accountEvents: number
}

export type ActivityQueryResult = {
  rows: ActivityDisplayRow[]
  totalCount: number
  loadedCount: number
  limit: number
  hasMore: boolean
}

export type ActivityQueryOptions = {
  limit?: number
}

type RawActivityRow = {
  id: string
  event_name: string
  created_at: string
  actor_type: string
  actor_id: string | null
  customer_id: string | null
  membership_id: string | null
  qr_code_id: string | null
  metadata: Record<string, unknown> | null
  customers:
    | { email: string | null; phone: string | null }
    | Array<{ email: string | null; phone: string | null }>
    | null
  customer_memberships:
    | {
        id: string
        current_stamp_count: number
        total_stamps_earned: number
        total_rewards_redeemed: number
      }
    | Array<{
        id: string
        current_stamp_count: number
        total_stamps_earned: number
        total_rewards_redeemed: number
      }>
    | null
  qr_codes:
    | { qr_id: string; destination_type: string }
    | Array<{ qr_id: string; destination_type: string }>
    | null
}

export async function getEnrichedMerchantActivity(
  merchantId: string,
  options: ActivityQueryOptions = {}
): Promise<ActivityQueryResult> {
  const limit = clampActivityLimit(options.limit)
  const supabase = createSupabaseServiceRoleClient()
  const { data, error, count } = await supabase
    .from("product_events")
    .select(
      `
      id,
      event_name,
      created_at,
      actor_type,
      actor_id,
      customer_id,
      membership_id,
      qr_code_id,
      metadata,
      customers(email, phone),
      customer_memberships(id, current_stamp_count, total_stamps_earned, total_rewards_redeemed),
      qr_codes(qr_id, destination_type)
    `,
      { count: "exact" }
    )
    .eq("merchant_id", merchantId)
    .in("event_name", [...activityEvents])
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Unable to load activity: ${error.message}`)
  }

  const rows = (data ?? []) as RawActivityRow[]
  const staffIds = new Set<string>()
  const rewardPoolItemIds = new Set<string>()

  for (const row of rows) {
    if (row.actor_type === "staff" && row.actor_id) {
      staffIds.add(row.actor_id)
    }

    const rewardPoolItemId = row.metadata?.reward_pool_item_id
    if (rewardPoolItemId) {
      rewardPoolItemIds.add(String(rewardPoolItemId))
    }
  }

  const [staffById, rewardById] = await Promise.all([
    loadStaffUsers([...staffIds]),
    loadRewardPoolItems([...rewardPoolItemIds]),
  ])

  const displayRows = threadActivityRows(rows, staffById, rewardById)

  return {
    rows: displayRows,
    totalCount: count ?? rows.length,
    loadedCount: rows.length,
    limit,
    hasMore: (count ?? rows.length) > rows.length,
  }
}

export function summarizeActivity(rows: ActivityDisplayRow[]): ActivitySummary {
  return rows.reduce<ActivitySummary>(
    (summary, row) => {
      summary.total += 1

      switch (row.category) {
        case "customer":
          summary.joins += 1
          break
        case "stamp":
          summary.stamps += 1
          break
        case "reward":
          summary.rewards += 1
          break
        case "qr":
          summary.qrEvents += 1
          break
        case "account":
          summary.accountEvents += 1
          break
      }

      return summary
    },
    {
      total: 0,
      joins: 0,
      stamps: 0,
      rewards: 0,
      qrEvents: 0,
      accountEvents: 0,
    }
  )
}

function toActivityDisplayRow(
  row: RawActivityRow,
  staffById: Map<string, { display_name: string; role: string }>,
  rewardById: Map<string, { reward_name: string }>
): ActivityDisplayRow {
  const metadata = row.metadata ?? {}
  const customer = first(row.customers)
  const membership = first(row.customer_memberships)
  const qrCode = first(row.qr_codes)
  const customerLabel = customer
    ? formatMerchantCustomerIdentifier(customer)
    : null
  const staff =
    row.actor_type === "staff" && row.actor_id
      ? staffById.get(row.actor_id)
      : undefined
  const rewardPoolItemId = metadata.reward_pool_item_id
    ? String(metadata.reward_pool_item_id)
    : null
  const rewardFromPool = rewardPoolItemId
    ? rewardById.get(rewardPoolItemId)
    : undefined
  const rewardName = metadata.reward_name
    ? String(metadata.reward_name)
    : rewardFromPool?.reward_name
  const eventName = row.event_name
  const category = activityCategory(eventName)
  const timestamp = row.created_at
  const base = activityBaseFields({
    row,
    customerLabel,
    staffLabel: staff?.display_name,
    rewardName,
    qrId: qrCode?.qr_id,
  })

  const sharedDetails: ActivityDetail[] = [
    staff ? { label: "Staff", value: staff.display_name } : null,
  ].filter(isDetail)

  const actorDetail = formatActorDetail(row.actor_type, staff, customerLabel)
  if (
    actorDetail &&
    actorDetail.value !== customerLabel &&
    actorDetail.value !== staff?.display_name
  ) {
    sharedDetails.push(actorDetail)
  }

  switch (eventName) {
    case "customer_joined":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Join",
        headline: `${customerName(customerLabel)} joined`,
        summary: "Joined via venue QR and accepted the loyalty programme.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          { label: "How", value: "Scanned venue QR and completed join" },
          metadataMarketingOptIn(metadata),
          qrCode ? { label: "QR code", value: qrCode.qr_id } : null,
          membership
            ? {
                label: "Starting stamps",
                value: String(membership.current_stamp_count),
              }
            : null,
        ].filter(isDetail),
      }

    case "stamp_claim_started":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Stamp requested",
        headline: `${customerName(customerLabel)} requested a stamp`,
        summary:
          "The customer opened the stamp-confirm screen from the venue QR.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          {
            label: "How",
            value: "Opened self-service stamp screen",
          },
          membership
            ? {
                label: "Stamps before stamp",
                value: String(membership.current_stamp_count),
              }
            : null,
        ].filter(isDetail),
      }

    case "stamp_issued":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Stamp collected",
        headline: `${customerName(customerLabel)} collected ${stampLabel(row, membership)}`,
        summary: metadata.geo_flagged
          ? "Customer stamp was issued and a location anomaly was flagged."
          : "Customer stamp was issued from the venue QR.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          { label: "How", value: "Self-service QR stamp" },
          metadata.new_stamp_count != null
            ? {
                label: "Stamps now",
                value: String(metadata.new_stamp_count),
              }
            : membership
              ? {
                  label: "Stamps now",
                  value: String(membership.current_stamp_count),
                }
              : null,
          metadata.business_date
            ? {
                label: "Business date",
                value: String(metadata.business_date),
              }
            : null,
          metadata.geo_status
            ? { label: "Location check", value: String(metadata.geo_status) }
            : null,
          membership
            ? {
                label: "Lifetime stamps",
                value: String(membership.total_stamps_earned),
              }
            : null,
        ].filter(isDetail),
      }

    case "reward_unlocked":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Reward unlocked",
        headline: `${customerName(customerLabel)} unlocked ${rewardLabel(rewardName)}`,
        summary: rewardFromPool
          ? `${rewardFromPool.reward_name} is ready to redeem.`
          : "A reward became available after reaching the stamp target.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          {
            label: "How",
            value: "Automatic unlock after stamp target reached",
          },
          metadata.reward_name
            ? { label: "Reward", value: String(metadata.reward_name) }
            : rewardFromPool
              ? { label: "Reward", value: rewardFromPool.reward_name }
              : null,
          membership
            ? {
                label: "Rewards redeemed (lifetime)",
                value: String(membership.total_rewards_redeemed),
              }
            : null,
        ].filter(isDetail),
      }

    case "reward_redeemed":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Reward redeemed",
        headline: `${customerName(customerLabel)} redeemed ${rewardLabel(rewardName)}`,
        summary: metadata.reward_name
          ? `${String(metadata.reward_name)} was redeemed by the customer.`
          : "The customer redeemed a reward.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          { label: "How", value: "Customer self-service redemption" },
          metadata.reward_name
            ? { label: "Reward", value: String(metadata.reward_name) }
            : null,
          metadata.new_stamp_count != null
            ? {
                label: "Stamps after redemption",
                value: String(metadata.new_stamp_count),
              }
            : membership
              ? {
                  label: "Stamps after redemption",
                  value: String(membership.current_stamp_count),
                }
              : null,
          staff ? { label: "Confirmed by", value: staff.display_name } : null,
          membership
            ? {
                label: "Total redemptions",
                value: String(membership.total_rewards_redeemed),
              }
            : null,
        ].filter(isDetail),
      }

    case "qr_scanned":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "QR scanned",
        headline: customerLabel
          ? `${customerLabel} scanned the QR`
          : "Someone scanned the QR",
        summary:
          metadata.available === false
            ? "The QR opened, but join was unavailable at that moment."
            : "A customer opened the venue QR resolver.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          qrCode ? { label: "QR code", value: qrCode.qr_id } : null,
          qrCode
            ? {
                label: "Destination",
                value: formatDestinationType(qrCode.destination_type),
              }
            : metadata.destination_type
              ? {
                  label: "Destination",
                  value: formatDestinationType(
                    String(metadata.destination_type)
                  ),
                }
              : null,
          metadata.available != null
            ? {
                label: "Join available",
                value: metadata.available ? "Yes" : "No",
              }
            : null,
        ].filter(isDetail),
      }

    case "qr_downloaded":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "QR downloaded",
        headline: metadata.asset_type
          ? `${formatAssetType(String(metadata.asset_type))} QR downloaded`
          : "QR asset downloaded",
        summary: "A printable or till-ready QR asset was saved.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          metadata.asset_type
            ? {
                label: "Asset",
                value: formatAssetType(String(metadata.asset_type)),
              }
            : null,
          qrCode ? { label: "QR code", value: qrCode.qr_id } : null,
        ].filter(isDetail),
      }

    case "qr_created":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "QR created",
        headline: "Venue QR created",
        summary: "A permanent join QR was created for this location.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          qrCode ? { label: "QR code", value: qrCode.qr_id } : null,
          metadata.destination_type || qrCode
            ? {
                label: "Destination",
                value: formatDestinationType(
                  String(
                    metadata.destination_type ??
                      qrCode?.destination_type ??
                      "join"
                  )
                ),
              }
            : null,
        ].filter(isDetail),
      }

    case "qr_enabled":
    case "qr_disabled": {
      const enabled = eventName === "qr_enabled"

      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: enabled ? "QR enabled" : "QR disabled",
        headline: enabled ? "Venue QR enabled" : "Venue QR disabled",
        summary: enabled
          ? "Customer scanning is open from the permanent venue QR."
          : "Customer scanning has been paused from the permanent venue QR.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          qrCode ? { label: "QR code", value: qrCode.qr_id } : null,
          { label: "State", value: enabled ? "Enabled" : "Disabled" },
        ].filter(isDetail),
      }
    }

    case "loyalty_card_created":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Card setup",
        headline: "Loyalty card setup created",
        summary: "Your stamp card and reward rules were saved.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          metadata.is_active != null
            ? {
                label: "Active",
                value: metadata.is_active ? "Yes" : "No",
              }
            : null,
        ].filter(isDetail),
      }

    case "loyalty_card_updated":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Card setup",
        headline: "Loyalty card setup updated",
        summary: "Stamp target, reward copy, or card status changed.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          metadata.is_active != null
            ? {
                label: "Active",
                value: metadata.is_active ? "Yes" : "No",
              }
            : null,
        ].filter(isDetail),
      }

    case "merchant_signed_up":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Account",
        headline: "Merchant account joined",
        summary: "Onboarding completed and the venue profile was saved.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          metadata.source
            ? { label: "Source", value: String(metadata.source) }
            : null,
        ].filter(isDetail),
      }

    case "subscription_started":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Billing",
        headline: "Growth Plan started",
        summary: "Stripe marked billing as active for this merchant.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          metadata.plan
            ? { label: "Plan", value: String(metadata.plan) }
            : { label: "Plan", value: "Growth Plan" },
          metadata.status
            ? { label: "Status", value: String(metadata.status) }
            : null,
        ].filter(isDetail),
      }

    case "subscription_cancelled":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Billing",
        headline: "Growth Plan cancelled",
        summary: "Stripe marked the Growth Plan subscription as cancelled.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          metadata.plan
            ? { label: "Plan", value: String(metadata.plan) }
            : { label: "Plan", value: "Growth Plan" },
          metadata.status
            ? { label: "Status", value: String(metadata.status) }
            : null,
        ].filter(isDetail),
      }

    default:
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Activity",
        headline: eventName.replaceAll("_", " "),
        summary: "Merchant activity event.",
        timestamp,
        ...base,
        details: sharedDetails,
      }
  }
}

function threadActivityRows(
  rows: RawActivityRow[],
  staffById: Map<string, { display_name: string; role: string }>,
  rewardById: Map<string, { reward_name: string }>
) {
  const displayRows: ActivityDisplayRow[] = []

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const nextRow = rows[index + 1]

    if (nextRow && shouldThreadStampRows(row, nextRow)) {
      displayRows.push(toThreadedStampRow(row, nextRow, staffById, rewardById))
      index += 1
      continue
    }

    displayRows.push(toActivityDisplayRow(row, staffById, rewardById))
  }

  return displayRows
}

function shouldThreadStampRows(
  newerRow: RawActivityRow,
  olderRow: RawActivityRow
) {
  if (
    newerRow.event_name !== "stamp_issued" ||
    olderRow.event_name !== "stamp_claim_started"
  ) {
    return false
  }

  if (
    !newerRow.membership_id ||
    newerRow.membership_id !== olderRow.membership_id
  ) {
    return false
  }

  const diffMs =
    new Date(newerRow.created_at).getTime() -
    new Date(olderRow.created_at).getTime()

  return diffMs >= 0 && diffMs <= 30 * 60_000 && sameUkDate(newerRow, olderRow)
}

function toThreadedStampRow(
  issuedRow: RawActivityRow,
  claimRow: RawActivityRow,
  staffById: Map<string, { display_name: string; role: string }>,
  rewardById: Map<string, { reward_name: string }>
): ActivityDisplayRow {
  const issued = toActivityDisplayRow(issuedRow, staffById, rewardById)
  const claimOpenedAt = formatActivityDateTime(claimRow.created_at)
  const issuedAt = formatActivityDateTime(issuedRow.created_at)
  const issuedMetadata = issuedRow.metadata ?? {}

  return {
    ...issued,
    id: `${issuedRow.id}:${claimRow.id}`,
    summary: "Stamp request and stamp issue are grouped into one visit.",
    details: [
      { label: "Claim opened", value: claimOpenedAt },
      { label: "Approved", value: issuedAt },
      ...issued.details,
      issuedMetadata.business_date
        ? {
            label: "Business date",
            value: String(issuedMetadata.business_date),
          }
        : null,
    ].filter(uniqueDetails),
    searchText: [
      issued.searchText,
      "stamp claim started",
      "stamp issued",
      claimOpenedAt,
      issuedAt,
    ].join(" "),
  }
}

function activityBaseFields({
  row,
  customerLabel,
  staffLabel,
  rewardName,
  qrId,
}: {
  row: RawActivityRow
  customerLabel: string | null
  staffLabel?: string
  rewardName?: string
  qrId?: string
}): Pick<
  ActivityDisplayRow,
  | "timestampLabel"
  | "relativeTime"
  | "dateGroup"
  | "dateGroupLabel"
  | "primaryAction"
  | "secondaryAction"
  | "searchText"
> {
  const dateGroup = activityDateGroup(row.created_at)

  return {
    timestampLabel: formatActivityDateTime(row.created_at),
    relativeTime: formatRelativeTime(row.created_at),
    dateGroup: dateGroup.key,
    dateGroupLabel: dateGroup.label,
    primaryAction: primaryActivityAction(row),
    secondaryAction: secondaryActivityAction(row),
    searchText: [
      row.event_name.replaceAll("_", " "),
      customerLabel,
      staffLabel,
      rewardName,
      qrId,
      ...metadataSearchValues(row.metadata),
    ]
      .filter((value): value is string => Boolean(value))
      .join(" ")
      .toLowerCase(),
  }
}

function primaryActivityAction(
  row: RawActivityRow
): ActivityAction | undefined {
  if (row.membership_id) {
    return {
      label: "View customer",
      href: `/app/customers?highlight=${encodeURIComponent(row.membership_id)}`,
    }
  }

  if (
    row.event_name === "qr_scanned" ||
    row.event_name === "qr_downloaded" ||
    row.event_name === "qr_created" ||
    row.event_name === "qr_enabled" ||
    row.event_name === "qr_disabled"
  ) {
    return { label: "Open QR", href: "/app/launch?tab=qr" }
  }

  if (
    row.event_name === "loyalty_card_created" ||
    row.event_name === "loyalty_card_updated"
  ) {
    return { label: "Open card setup", href: "/app/launch?tab=card" }
  }

  if (
    row.event_name === "subscription_started" ||
    row.event_name === "subscription_cancelled"
  ) {
    return { label: "Open billing", href: "/app/account?tab=billing" }
  }

  if (row.event_name === "merchant_signed_up") {
    return { label: "Open account", href: "/app/account" }
  }

  return undefined
}

function secondaryActivityAction(
  row: RawActivityRow
): ActivityAction | undefined {
  if (
    row.membership_id &&
    (row.event_name === "stamp_claim_started" ||
      row.event_name === "stamp_issued")
  ) {
    return {
      label: "Open QR setup",
      href: "/app/launch?tab=qr",
    }
  }

  return undefined
}

async function loadStaffUsers(ids: string[]) {
  const staffById = new Map<string, { display_name: string; role: string }>()
  if (!ids.length) return staffById

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("staff_users")
    .select("id, display_name, role")
    .in("id", ids)

  if (error) {
    throw new Error(`Unable to load staff activity context: ${error.message}`)
  }

  for (const staff of data ?? []) {
    staffById.set(staff.id, {
      display_name: staff.display_name,
      role: staff.role,
    })
  }

  return staffById
}

async function loadRewardPoolItems(ids: string[]) {
  const rewardById = new Map<string, { reward_name: string }>()
  if (!ids.length) return rewardById

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_pool_items")
    .select("id, reward_name")
    .in("id", ids)

  if (error) {
    throw new Error(`Unable to load reward activity context: ${error.message}`)
  }

  for (const reward of data ?? []) {
    rewardById.set(reward.id, { reward_name: reward.reward_name })
  }

  return rewardById
}

function activityCategory(eventName: string): ActivityCategory {
  switch (eventName) {
    case "customer_joined":
      return "customer"
    case "stamp_claim_started":
    case "stamp_issued":
      return "stamp"
    case "reward_unlocked":
    case "reward_redeemed":
      return "reward"
    case "qr_scanned":
    case "qr_downloaded":
    case "qr_created":
    case "qr_enabled":
    case "qr_disabled":
      return "qr"
    default:
      return "account"
  }
}

function customerName(customerLabel: string | null) {
  return customerLabel ?? "Customer"
}

function stampLabel(
  row: RawActivityRow,
  membership:
    | {
        id: string
        current_stamp_count: number
        total_stamps_earned: number
        total_rewards_redeemed: number
      }
    | undefined
) {
  const newStampCount = row.metadata?.new_stamp_count
  if (newStampCount != null) {
    return `stamp ${String(newStampCount)}`
  }

  if (membership) {
    return `stamp ${membership.current_stamp_count}`
  }

  return "a stamp"
}

function rewardLabel(rewardName: string | undefined) {
  return rewardName ?? "a reward"
}

function formatActorDetail(
  actorType: string,
  staff: { display_name: string; role: string } | undefined,
  customerLabel: string | null
): ActivityDetail | null {
  switch (actorType) {
    case "merchant":
      return { label: "Actor", value: "Merchant account" }
    case "staff":
      return {
        label: "Actor",
        value: staff?.display_name ?? "Staff member",
      }
    case "customer":
      return {
        label: "Actor",
        value: customerLabel ?? "Customer",
      }
    case "system":
      return { label: "Actor", value: "Automatic" }
    case "admin":
      return { label: "Actor", value: "Nabaperks support" }
    default:
      return null
  }
}

function metadataMarketingOptIn(metadata: Record<string, unknown>) {
  if (metadata.marketing_opt_in == null) return null
  return {
    label: "Marketing opt-in",
    value: metadata.marketing_opt_in ? "Yes" : "No",
  }
}

function formatDestinationType(value: string) {
  return value === "join" ? "Customer join" : value.replaceAll("_", " ")
}

function formatAssetType(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatActivityDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diffMs < minute) return "Just now"
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute)
    return `${minutes} min ago`
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour)
    return `${hours} hr ago`
  }
  const days = Math.floor(diffMs / day)
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  return formatActivityDateTime(value)
}

function activityDateGroup(value: string) {
  const eventKey = ukDateKey(value)
  const todayKey = ukDateKey(new Date().toISOString())
  const yesterdayKey = ukDateKey(offsetDateIso(-1))

  if (eventKey === todayKey) {
    return { key: "today", label: "Today" }
  }

  if (eventKey === yesterdayKey) {
    return { key: "yesterday", label: "Yesterday" }
  }

  if (daysBetweenUkDates(eventKey, todayKey) < 7) {
    return { key: `this-week-${eventKey}`, label: formatDateGroupLabel(value) }
  }

  return { key: `earlier-${eventKey}`, label: formatDateGroupLabel(value) }
}

function isDetail(detail: ActivityDetail | null): detail is ActivityDetail {
  return detail != null && detail.value.length > 0
}

function uniqueDetails(
  detail: ActivityDetail | null,
  index: number,
  details: Array<ActivityDetail | null>
): detail is ActivityDetail {
  if (!isDetail(detail)) return false

  return (
    details.findIndex(
      (item) => item?.label === detail.label && item.value === detail.value
    ) === index
  )
}

function metadataSearchValues(metadata: Record<string, unknown> | null) {
  if (!metadata) return []

  return Object.entries(metadata)
    .filter(([key, value]) => {
      const lowerKey = key.toLowerCase()
      const valueType = typeof value
      return (
        (valueType === "string" || valueType === "number") &&
        !lowerKey.includes("email") &&
        !lowerKey.includes("phone")
      )
    })
    .map(([key, value]) => `${key} ${String(value)}`)
}

function sameUkDate(firstRow: RawActivityRow, secondRow: RawActivityRow) {
  return ukEventDateKey(firstRow) === ukEventDateKey(secondRow)
}

function ukEventDateKey(row: RawActivityRow) {
  const businessDate = row.metadata?.business_date
  return businessDate ? String(businessDate) : ukDateKey(row.created_at)
}

function ukDateKey(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value))

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  return `${year}-${month}-${day}`
}

function offsetDateIso(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString()
}

function daysBetweenUkDates(fromKey: string, toKey: string) {
  const from = Date.UTC(...dateKeyParts(fromKey))
  const to = Date.UTC(...dateKeyParts(toKey))
  return Math.floor((to - from) / 86_400_000)
}

function dateKeyParts(key: string): [number, number, number] {
  const [year, month, day] = key.split("-").map(Number)
  return [year, month - 1, day]
}

function formatDateGroupLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(new Date(value))
}

function clampActivityLimit(limit = 100) {
  if (!Number.isFinite(limit)) return 100
  return Math.min(Math.max(Math.floor(limit), 1), 250)
}

function first<T>(value: T | T[] | null | undefined) {
  if (!value) return undefined
  return Array.isArray(value) ? value[0] : value
}
