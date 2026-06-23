import "server-only"

import { recordProductEvent } from "@/lib/analytics/events"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"
import {
  buildNotificationPayload,
  notificationEventCategory,
  notificationRequiresMarketingConsent,
  sanitizeNotificationMetadata,
  type NotificationEventType,
  type NotificationPayload,
} from "@/lib/notifications/catalog"

export type EnqueueNotificationInput = {
  eventType: NotificationEventType
  customerId: string
  merchantId?: string | null
  membershipId?: string | null
  rewardEventId?: string | null
  cycleNumber?: number | null
  businessDate?: string | null
  dueAt?: string | null
  dedupeKey?: string | null
  payload?: Partial<NotificationPayload> & {
    businessName?: string | null
    rewardName?: string | null
    announcementTitle?: string | null
    announcementBody?: string | null
  }
  metadata?: Record<string, unknown>
}

export type EnqueueNotificationResult =
  | { status: "queued"; eventId: string }
  | { status: "skipped"; reason: string }

type NotificationPreferences = {
  transactional_enabled: boolean
  reminder_enabled: boolean
  marketing_enabled: boolean
}

type MembershipNotificationContext = {
  membershipId: string
  customerId: string
  merchantId: string
  businessName: string
  currentStampCount: number
  activeCycleNumber: number
  stampsRequired: number
}

type RewardNotificationContext = {
  rewardEventId: string
  customerId: string
  merchantId: string
  membershipId: string
  businessName: string
  rewardName: string
  redeemableFrom: string | null
  expiresAt: string | null
  cycleNumber: number | null
  customerFullName: string | null
  customerDateOfBirth: string | null
  customerEmail: string | null
  customerEmailVerifiedAt: string | null
}

type MerchantRelation = {
  business_name?: unknown
}

type CustomerRelation = {
  full_name?: unknown
  date_of_birth?: unknown
  email?: unknown
  email_verified_at?: unknown
}

export async function enqueueNotificationEvent(
  input: EnqueueNotificationInput
): Promise<EnqueueNotificationResult> {
  const supabase = createSupabaseServiceRoleClient()
  const eligibility = await notificationEligibility(supabase, input)

  if (!eligibility.allowed) {
    return { status: "skipped", reason: eligibility.reason }
  }

  const payload = buildNotificationPayload({
    eventType: input.eventType,
    businessName: input.payload?.businessName,
    rewardName: input.payload?.rewardName,
    announcementTitle: input.payload?.announcementTitle,
    announcementBody: input.payload?.announcementBody,
    url: input.payload?.url,
    merchantId: input.merchantId,
    membershipId: input.membershipId,
    rewardEventId: input.rewardEventId,
  })
  const metadata = sanitizeNotificationMetadata({
    ...(input.metadata ?? {}),
    category: notificationEventCategory(input.eventType),
  })

  const { data, error } = await supabase.rpc("enqueue_notification_event", {
    p_event_type: input.eventType,
    p_customer_id: input.customerId,
    p_merchant_id: input.merchantId ?? null,
    p_membership_id: input.membershipId ?? null,
    p_reward_event_id: input.rewardEventId ?? null,
    p_cycle_number: input.cycleNumber ?? null,
    p_business_date: input.businessDate ?? null,
    p_due_at: input.dueAt ?? null,
    p_dedupe_key: input.dedupeKey ?? null,
    p_payload: payload,
    p_metadata: metadata,
  })

  if (error) {
    logger.warn("push_notification_enqueue_failed", {
      eventType: input.eventType,
      customerId: input.customerId,
      merchantId: input.merchantId,
      membershipId: input.membershipId,
      rewardEventId: input.rewardEventId,
      reason: error.message,
    })
    return { status: "skipped", reason: "enqueue_failed" }
  }

  const eventId = typeof data === "string" ? data : String(data)

  void recordPushProductEvent("push_notification_enqueued", input, {
    eventId,
    category: notificationEventCategory(input.eventType),
  })

  return { status: "queued", eventId }
}

export async function enqueueStampTransitionNotifications({
  membershipId,
  newStampCount,
  rewardUnlocked,
}: {
  membershipId: string
  newStampCount: number
  rewardUnlocked: boolean
}) {
  const context = await getMembershipNotificationContext(membershipId)
  if (!context) return

  if (rewardUnlocked) {
    const reward = await getLatestUnlockedRewardContext(membershipId)
    if (!reward) return

    const profileComplete = isRewardProfileComplete(reward)
    const eventType =
      isRedeemableToday(reward.redeemableFrom) && profileComplete
        ? "reward_ready"
        : isRedeemableToday(reward.redeemableFrom)
          ? "profile_required_to_collect"
          : "reward_unlocked_waiting"

    await enqueueNotificationEvent({
      eventType,
      customerId: reward.customerId,
      merchantId: reward.merchantId,
      membershipId: reward.membershipId,
      rewardEventId: reward.rewardEventId,
      cycleNumber: reward.cycleNumber,
      businessDate: londonBusinessDate(new Date()),
      dedupeKey: `${eventType}:${reward.rewardEventId}`,
      payload: {
        businessName: reward.businessName,
        rewardName: reward.rewardName,
        url:
          eventType === "profile_required_to_collect"
            ? `/reward/${reward.rewardEventId}`
            : "/home/rewards",
      },
      metadata: { source: "confirmed_stamp" },
    })
    return
  }

  if (newStampCount === Math.max(context.stampsRequired - 1, 0)) {
    await enqueueNotificationEvent({
      eventType: "one_stamp_away",
      customerId: context.customerId,
      merchantId: context.merchantId,
      membershipId: context.membershipId,
      cycleNumber: context.activeCycleNumber,
      businessDate: londonBusinessDate(new Date()),
      dedupeKey: `one_stamp_away:${context.membershipId}:${context.activeCycleNumber}`,
      payload: {
        businessName: context.businessName,
        url: `/card/${context.membershipId}`,
      },
      metadata: { source: "confirmed_stamp" },
    })
  }
}

export async function enqueueRewardCollectedCycleStarted(rewardEventId: string) {
  const reward = await getRewardNotificationContext(rewardEventId)
  if (!reward) return

  await enqueueNotificationEvent({
    eventType: "reward_collected_cycle_started",
    customerId: reward.customerId,
    merchantId: reward.merchantId,
    membershipId: reward.membershipId,
    rewardEventId: reward.rewardEventId,
    cycleNumber: reward.cycleNumber,
    businessDate: londonBusinessDate(new Date()),
    dedupeKey: `reward_collected_cycle_started:${reward.rewardEventId}`,
    payload: {
      businessName: reward.businessName,
      rewardName: reward.rewardName,
      url: `/card/${reward.membershipId}`,
    },
    metadata: { source: "merchant_confirmed_reward_collection" },
  })
}

async function notificationEligibility(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  input: EnqueueNotificationInput
) {
  const category = notificationEventCategory(input.eventType)
  if (category === "operational") return { allowed: true as const }

  const [preferences, enabledSubscriptions] = await Promise.all([
    getNotificationPreferences(supabase, input.customerId),
    countEnabledSubscriptions(supabase, input.customerId),
  ])

  if (enabledSubscriptions === 0) {
    return { allowed: false as const, reason: "no_enabled_push_subscription" }
  }

  if (category === "transactional" && !preferences.transactional_enabled) {
    return { allowed: false as const, reason: "transactional_push_disabled" }
  }

  if (category === "reminder" && !preferences.reminder_enabled) {
    return { allowed: false as const, reason: "reminder_push_disabled" }
  }

  if (notificationRequiresMarketingConsent(input.eventType)) {
    if (!preferences.marketing_enabled) {
      return { allowed: false as const, reason: "marketing_push_disabled" }
    }

    if (
      !input.merchantId ||
      !(await hasMarketingConsent(supabase, input.customerId, input.merchantId))
    ) {
      return { allowed: false as const, reason: "marketing_consent_missing" }
    }
  }

  return { allowed: true as const }
}

async function getNotificationPreferences(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  customerId: string
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from("notification_preferences")
    .select("transactional_enabled, reminder_enabled, marketing_enabled")
    .eq("customer_id", customerId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load notification preferences: ${error.message}`)
  }

  return {
    transactional_enabled: data?.transactional_enabled ?? true,
    reminder_enabled: data?.reminder_enabled ?? true,
    marketing_enabled: data?.marketing_enabled ?? false,
  }
}

async function countEnabledSubscriptions(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  customerId: string
) {
  const { count, error } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", customerId)
    .eq("enabled", true)
    .is("revoked_at", null)

  if (error) {
    throw new Error(`Unable to load push subscription count: ${error.message}`)
  }

  return count ?? 0
}

async function hasMarketingConsent(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  customerId: string,
  merchantId: string
) {
  const { data, error } = await supabase
    .from("consent_records")
    .select("channel, consent_status, created_at")
    .eq("customer_id", customerId)
    .eq("merchant_id", merchantId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`Unable to load marketing consent: ${error.message}`)
  }

  const latestByChannel = new Map<string, string>()
  for (const record of data ?? []) {
    if (!latestByChannel.has(record.channel)) {
      latestByChannel.set(record.channel, record.consent_status)
    }
  }

  return [...latestByChannel.values()].some((status) => status === "opted_in")
}

async function getMembershipNotificationContext(
  membershipId: string
): Promise<MembershipNotificationContext | null> {
  const supabase = createSupabaseServiceRoleClient()
  const { data: membership, error: membershipError } = await supabase
    .from("customer_memberships")
    .select(
      "id, customer_id, merchant_id, current_stamp_count, active_cycle_number, merchants(business_name)"
    )
    .eq("id", membershipId)
    .maybeSingle()

  if (membershipError) {
    logger.warn("push_membership_context_failed", {
      membershipId,
      reason: membershipError.message,
    })
    return null
  }

  if (!membership) return null

  const { data: card, error: cardError } = await supabase
    .from("loyalty_cards")
    .select("stamps_required")
    .eq("merchant_id", membership.merchant_id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (cardError || !card) {
    if (cardError) {
      logger.warn("push_card_context_failed", {
        membershipId,
        reason: cardError.message,
      })
    }
    return null
  }

  const merchant = first(membership.merchants)

  return {
    membershipId: membership.id,
    customerId: membership.customer_id,
    merchantId: membership.merchant_id,
    businessName: merchant?.business_name ?? "Your venue",
    currentStampCount: membership.current_stamp_count,
    activeCycleNumber: membership.active_cycle_number,
    stampsRequired: card.stamps_required,
  }
}

async function getLatestUnlockedRewardContext(membershipId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_events")
    .select(
      "id, customer_id, merchant_id, membership_id, reward_name, redeemable_from, expires_at, cycle_number, customers(full_name, date_of_birth, email, email_verified_at), merchants(business_name)"
    )
    .eq("membership_id", membershipId)
    .eq("status", "unlocked")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    logger.warn("push_reward_context_failed", {
      membershipId,
      reason: error.message,
    })
    return null
  }

  return data ? rewardContext(data) : null
}

async function getRewardNotificationContext(rewardEventId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("reward_events")
    .select(
      "id, customer_id, merchant_id, membership_id, reward_name, redeemable_from, expires_at, cycle_number, customers(full_name, date_of_birth, email, email_verified_at), merchants(business_name)"
    )
    .eq("id", rewardEventId)
    .maybeSingle()

  if (error) {
    logger.warn("push_reward_context_failed", {
      rewardEventId,
      reason: error.message,
    })
    return null
  }

  return data ? rewardContext(data) : null
}

function rewardContext(row: Record<string, unknown>): RewardNotificationContext {
  const customer = first(row.customers) as CustomerRelation | undefined
  const merchant = first(row.merchants) as MerchantRelation | undefined

  return {
    rewardEventId: stringValue(row.id),
    customerId: stringValue(row.customer_id),
    merchantId: stringValue(row.merchant_id),
    membershipId: stringValue(row.membership_id),
    businessName: stringValue(merchant?.business_name) || "Your venue",
    rewardName: stringValue(row.reward_name) || "your reward",
    redeemableFrom: nullableString(row.redeemable_from),
    expiresAt: nullableString(row.expires_at),
    cycleNumber: numberValue(row.cycle_number),
    customerFullName: nullableString(customer?.full_name),
    customerDateOfBirth: nullableString(customer?.date_of_birth),
    customerEmail: nullableString(customer?.email),
    customerEmailVerifiedAt: nullableString(customer?.email_verified_at),
  }
}

function isRewardProfileComplete(reward: RewardNotificationContext) {
  return Boolean(
    reward.customerFullName?.trim() &&
      reward.customerDateOfBirth &&
      (!reward.customerEmail || reward.customerEmailVerifiedAt)
  )
}

function isRedeemableToday(redeemableFrom: string | null) {
  return !redeemableFrom || redeemableFrom <= londonBusinessDate(new Date())
}

function londonBusinessDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}`
}

function part(parts: Intl.DateTimeFormatPart[], type: string) {
  return parts.find((entry) => entry.type === type)?.value ?? "00"
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

async function recordPushProductEvent(
  eventName: string,
  input: EnqueueNotificationInput,
  metadata: Record<string, unknown>
) {
  try {
    await recordProductEvent({
      eventName,
      merchantId: input.merchantId,
      customerId: input.customerId,
      membershipId: input.membershipId,
      actorType: "system",
      metadata: sanitizeNotificationMetadata({
        notification_event_type: input.eventType,
        ...metadata,
      }),
    })
  } catch (error) {
    logger.warn("push_product_event_failed", {
      eventName,
      notificationEventType: input.eventType,
      error,
    })
  }
}
