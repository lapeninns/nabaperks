import { formatMerchantCustomerIdentifier } from "@/lib/merchant/customer-identity-display"
import {
  activityDateGroup,
  customerName,
  first,
  formatActivityDateTime,
  formatActorDetail,
  formatAssetType,
  formatDestinationType,
  formatRelativeTime,
  isDetail,
  metadataMarketingOptIn,
  metadataSearchValues,
  rewardLabel,
  sameUkDate,
  stampLabel,
  uniqueDetails,
} from "@/lib/merchant/activity-display-helpers"
import { QR_POSTER_PATH } from "@/lib/merchant/qr-nav"

export {
  activityDateGroup,
  clampActivityLimit,
  customerName,
  dateKeyParts,
  daysBetweenUkDates,
  first,
  formatActivityDateTime,
  formatActorDetail,
  formatAssetType,
  formatDateGroupLabel,
  formatDestinationType,
  formatRelativeTime,
  isDetail,
  metadataMarketingOptIn,
  metadataSearchValues,
  offsetDateIso,
  rewardLabel,
  sameUkDate,
  stampLabel,
  ukDateKey,
  ukEventDateKey,
  uniqueDetails,
} from "@/lib/merchant/activity-display-helpers"

export const activityEvents = [
  "qr_scanned",
  "customer_joined",
  "stamp_claim_started",
  "stamp_issued",
  "referral_bonus_awarded",
  "reward_unlocked",
  "reward_redeemed",
  "reward_issued",
  "reward_sent",
  "reward_invite_sent",
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
  "customer" | "stamp" | "reward" | "qr" | "account"

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

export type RawActivityRow = {
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

export const eventsByCategory: Record<ActivityCategory, ActivityEventName[]> = {
  customer: ["customer_joined"],
  stamp: ["stamp_claim_started", "stamp_issued", "referral_bonus_awarded"],
  reward: [
    "reward_unlocked",
    "reward_redeemed",
    "reward_issued",
    "reward_sent",
    "reward_invite_sent",
  ],
  qr: [
    "qr_scanned",
    "qr_downloaded",
    "qr_created",
    "qr_enabled",
    "qr_disabled",
  ],
  account: [
    "loyalty_card_created",
    "loyalty_card_updated",
    "merchant_signed_up",
    "subscription_started",
    "subscription_cancelled",
  ],
}

export function eventsForCategory(filter: "all" | ActivityCategory): string[] {
  if (filter === "all") return [...activityEvents]
  return eventsByCategory[filter] ?? [...activityEvents]
}

/**
 * Project the slim row shape that actually crosses the RSC boundary. `details`
 * is built for internal threading but never rendered by any client consumer, so
 * it is dropped here (kept as `[]` to preserve the row type) along with the
 * unused `secondaryAction`; `primaryAction` is retained for the compact feed.
 */
export function toSlimActivityRow(row: ActivityDisplayRow): ActivityDisplayRow {
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

export function toActivityDisplayRow(
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

    case "referral_bonus_awarded":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Referral bonus",
        headline: `${customerName(customerLabel)} earned a referral bonus stamp`,
        summary: "A referred friend collected their first venue stamp.",
        timestamp,
        ...base,
        details: [
          { label: "Actor", value: "Automatic" },
          {
            label: "How",
            value: "A referred friend completed their first visit",
          },
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

    case "reward_issued": {
      const isBirthday = metadata.source === "birthday_month"
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: isBirthday ? "Birthday treat" : "Reward issued",
        headline: isBirthday
          ? `Birthday treat issued to ${customerName(customerLabel)}`
          : `${rewardLabel(rewardName)} issued to ${customerName(customerLabel)}`,
        summary: isBirthday
          ? "An automatic birthday reward was issued to this member."
          : "A reward was issued to this member.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          rewardName ? { label: "Reward", value: rewardName } : null,
          isBirthday ? { label: "Source", value: "Birthday" } : null,
        ].filter(isDetail),
      }
    }

    case "reward_sent":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Reward sent",
        headline: `Reward sent to ${customerName(customerLabel)}`,
        summary: metadata.reward_name
          ? `${String(metadata.reward_name)} was sent to this member.`
          : "A reward was sent to this member.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          metadata.reward_name
            ? { label: "Reward", value: String(metadata.reward_name) }
            : rewardName
              ? { label: "Reward", value: rewardName }
              : null,
        ].filter(isDetail),
      }

    case "reward_invite_sent":
      return {
        id: row.id,
        eventName,
        category,
        badgeLabel: "Invite sent",
        headline: "Reward invite sent",
        summary:
          "A reward invite was sent to someone not yet on Nabaperks; it attaches when they join.",
        timestamp,
        ...base,
        details: [
          ...sharedDetails,
          metadata.reward_name
            ? { label: "Reward", value: String(metadata.reward_name) }
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

export function threadActivityRows(
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

export function shouldThreadStampRows(
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

export function toThreadedStampRow(
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

export function activityBaseFields({
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

export function primaryActivityAction(
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

export function secondaryActivityAction(
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

export function activityCategory(eventName: string): ActivityCategory {
  switch (eventName) {
    case "customer_joined":
      return "customer"
    case "stamp_claim_started":
    case "stamp_issued":
    case "referral_bonus_awarded":
      return "stamp"
    case "reward_unlocked":
    case "reward_redeemed":
    case "reward_issued":
    case "reward_sent":
    case "reward_invite_sent":
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
