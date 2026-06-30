import "server-only"

import { getCurrentMerchant } from "@/lib/auth/session"
import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"
import { QR_POSTER_PATH } from "@/lib/merchant/qr-nav"
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
  /**
   * Restrict the query to a single activity category. Defaults to all
   * categories. Pushed into the DB query (not just filtered client-side) so
   * "Load more" grows the filtered set and rows beyond the window stay
   * reachable, rather than re-pulling a larger window of every event type.
   */
  filter?: "all" | ActivityCategory
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
  customers?:
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
  const scopedMerchantId = await requireCurrentMerchantId(merchantId)
  const limit = clampActivityLimit(options.limit)
  const filter = options.filter ?? "all"
  const supabase = createSupabaseServiceRoleClient()

  // Push the category filter into the DB so "Load more" grows the FILTERED set
  // — not a larger window of all event types — and so events past the window
  // stay reachable by raising the limit. Served by the composite index
  // (merchant_id, event_name, created_at desc). Over-fetch by one row to derive
  // `hasMore` cheaply (no count: "exact" heap touch) and to let a stamp pair
  // straddling the window boundary still thread instead of rendering as orphan
  // "requested"/"collected" cards.
  //
  // The free-text `q` is intentionally NOT pushed into the query: the only
  // first-class text column here is `event_name`, and narrowing on it would
  // hide rows whose match lives in the customer label, reward name, or
  // metadata (e.g. searching a customer name returns no events). Those joins
  // also carry PII we must not expose to a search predicate. `q` therefore
  // stays a client-side refinement over the loaded window (the feed filters on
  // its richer searchText index).
  const { data, error } = await supabase
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
      customer_memberships(id, current_stamp_count, total_stamps_earned, total_rewards_redeemed),
      qr_codes(qr_id, destination_type)
    `
    )
    .eq("merchant_id", scopedMerchantId)
    .in("event_name", eventsForCategory(filter))
    .order("created_at", { ascending: false })
    .limit(limit + 1)

  if (error) {
    throw new Error(`Unable to load activity: ${error.message}`)
  }

  const fetched = (data ?? []) as RawActivityRow[]
  const hasMore = fetched.length > limit
  const staffIds = new Set<string>()
  const rewardPoolItemIds = new Set<string>()
  const customerIds = new Set<string>()

  for (const row of fetched) {
    if (row.customer_id) {
      customerIds.add(row.customer_id)
    }

    if (row.actor_type === "staff" && row.actor_id) {
      staffIds.add(row.actor_id)
    }

    const rewardPoolItemId = row.metadata?.reward_pool_item_id
    if (rewardPoolItemId) {
      rewardPoolItemIds.add(String(rewardPoolItemId))
    }
  }

  const [staffById, rewardById, customerById] = await Promise.all([
    loadStaffUsers([...staffIds]),
    loadRewardPoolItems([...rewardPoolItemIds]),
    loadMaskedCustomers([...customerIds]),
  ])
  const rowsWithMaskedCustomers = fetched.map((row) => ({
    ...row,
    customers: row.customer_id ? (customerById.get(row.customer_id) ?? null) : null,
  }))

  // Thread over the full fetched window (including the +1 spare) but only emit
  // display rows for the first `limit` raw events; a boundary-straddling stamp
  // pair may borrow the spare so it threads instead of orphaning.
  const displayRows = threadActivityRows(
    rowsWithMaskedCustomers,
    staffById,
    rewardById,
    limit
  )
  const loadedCount = Math.min(fetched.length, limit)

  return {
    rows: displayRows.map(toSlimActivityRow),
    // No exact count is run anymore. totalCount reports the rows loaded so far;
    // whether more exist is carried by `hasMore` (the +1 sentinel), which gates
    // "Load more". When more exist we report loadedCount + 1 so totalCount stays
    // strictly greater than loadedCount for any "X of Y" affordance.
    totalCount: hasMore ? loadedCount + 1 : loadedCount,
    loadedCount,
    limit,
    hasMore,
  }
}

const eventsByCategory: Record<ActivityCategory, ActivityEventName[]> = {
  customer: ["customer_joined"],
  stamp: ["stamp_claim_started", "stamp_issued"],
  reward: ["reward_unlocked", "reward_redeemed"],
  qr: ["qr_scanned", "qr_downloaded", "qr_created", "qr_enabled", "qr_disabled"],
  account: [
    "loyalty_card_created",
    "loyalty_card_updated",
    "merchant_signed_up",
    "subscription_started",
    "subscription_cancelled",
  ],
}

function eventsForCategory(filter: "all" | ActivityCategory): string[] {
  if (filter === "all") return [...activityEvents]
  return eventsByCategory[filter] ?? [...activityEvents]
}

/**
 * Project the slim row shape that actually crosses the RSC boundary. `details`
 * is built for internal threading but never rendered by any client consumer, so
 * it is dropped here (kept as `[]` to preserve the row type) along with the
 * unused `secondaryAction`; `primaryAction` is retained for the compact feed.
 */
function toSlimActivityRow(row: ActivityDisplayRow): ActivityDisplayRow {
  return {
    id: row.id,
    eventName: row.eventName,
    category: row.category,
    badgeLabel: row.badgeLabel,
    headline: row.headline,
    summary: row.summary,
    timestamp: row.timestamp,
    timestampLabel: row.timestampLabel,
    relativeTime: row.relativeTime,
    dateGroup: row.dateGroup,
    dateGroupLabel: row.dateGroupLabel,
    details: [],
    primaryAction: row.primaryAction,
    searchText: row.searchText,
  }
}

const ACTIVITY_SUMMARY_WINDOW_DAYS = 7

/**
 * A true 7-day pulse for the Activity "this week" strip — counted directly from
 * product_events over a fixed window (not the loaded/limited feed rows, which
 * would mislabel "recent N events" as a week). Stamp claims and reward unlocks
 * are excluded so a single visit/redemption is not double-counted.
 */
export async function getMerchantActivitySummary(
  merchantId: string
): Promise<ActivitySummary> {
  const scopedMerchantId = await requireCurrentMerchantId(merchantId)
  const since = new Date(
    Date.now() - ACTIVITY_SUMMARY_WINDOW_DAYS * 86_400_000
  ).toISOString()
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("product_events")
    .select("event_name")
    .eq("merchant_id", scopedMerchantId)
    .in("event_name", [...activityEvents])
    .gte("created_at", since)

  if (error) {
    throw new Error(`Unable to load activity summary: ${error.message}`)
  }

  const summary: ActivitySummary = {
    total: 0,
    joins: 0,
    stamps: 0,
    rewards: 0,
    qrEvents: 0,
    accountEvents: 0,
  }

  for (const raw of data ?? []) {
    const name = (raw as { event_name: string }).event_name
    switch (name) {
      case "customer_joined":
        summary.joins += 1
        break
      case "stamp_issued":
        summary.stamps += 1
        break
      case "reward_redeemed":
        summary.rewards += 1
        break
      case "qr_downloaded":
      case "qr_scanned":
        summary.qrEvents += 1
        break
      default:
        if (activityCategory(name) === "account") {
          summary.accountEvents += 1
          break
        }
        continue
    }
    summary.total += 1
  }

  return summary
}

async function requireCurrentMerchantId(merchantId: string) {
  const merchant = await getCurrentMerchant()
  if (!merchant || merchant.id !== merchantId) {
    throw new Error("Current merchant access required for activity readback.")
  }

  return merchant.id
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
  rewardById: Map<string, { reward_name: string }>,
  maxRows: number = rows.length
) {
  const displayRows: ActivityDisplayRow[] = []
  // Only emit display rows for the first `maxRows` raw events. The +1 spare
  // beyond `maxRows` is consumable solely as the older half of a stamp pair
  // whose newer half is the last in-window row, so a visit split across the
  // window boundary still threads instead of orphaning.
  const lastConsumableIndex = Math.min(maxRows, rows.length) - 1

  for (let index = 0; index <= lastConsumableIndex; index += 1) {
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
      label: "View member",
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
    return { label: "Open QR", href: QR_POSTER_PATH }
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
      href: QR_POSTER_PATH,
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

async function loadMaskedCustomers(ids: string[]) {
  const customerById = new Map<
    string,
    { email: string | null; phone: string | null }
  >()
  if (!ids.length) return customerById

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("customers_masked")
    .select("id, email, phone")
    .in("id", ids)

  if (error) {
    throw new Error(`Unable to load masked activity customers: ${error.message}`)
  }

  for (const customer of (data ?? []) as Array<{
    id: string
    email: string | null
    phone: string | null
  }>) {
    customerById.set(customer.id, {
      email: customer.email,
      phone: customer.phone,
    })
  }

  return customerById
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
  return customerLabel ?? "Member"
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
        value: customerLabel ?? "Member",
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

/**
 * Explicit allowlist of metadata keys that are safe to fold into the
 * client-side search index. An allowlist (rather than a key-name denylist)
 * keeps a future PII key — `full_name`, `address`, `ip`, etc. — from silently
 * shipping to the browser just because its name does not contain
 * "email"/"phone". Only operational, non-PII keys are listed here; mirror this
 * set when a new rendered metadata field is added.
 */
const SEARCHABLE_METADATA_KEYS = new Set<string>([
  "reward_name",
  "new_stamp_count",
  "business_date",
  "geo_status",
  "destination_type",
  "asset_type",
  "source",
  "plan",
  "status",
])

function metadataSearchValues(metadata: Record<string, unknown> | null) {
  if (!metadata) return []

  return Object.entries(metadata)
    .filter(([key, value]) => {
      const valueType = typeof value
      return (
        (valueType === "string" || valueType === "number") &&
        SEARCHABLE_METADATA_KEYS.has(key)
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
