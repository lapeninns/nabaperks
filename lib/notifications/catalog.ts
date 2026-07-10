export const notificationEventTypes = [
  "push_permission_prompt_viewed",
  "push_permission_granted",
  "push_subscription_created",
  "push_subscription_disabled",
  "push_subscription_failed",
  "one_stamp_away",
  "next_stamp_available",
  "reward_unlocked_waiting",
  "reward_ready",
  "profile_required_to_collect",
  "reward_expiring_soon",
  "reward_expired",
  "reward_collected_cycle_started",
  "dormant_progress",
  "venue_announcement",
  "birthday_reward_issued",
  "merchant_reward_received",
  "referral_bonus_stamp_issued",
  "referral_friend_joined",
  "referral_qualified",
  "referral_bonus_saved",
] as const

export type NotificationEventType = (typeof notificationEventTypes)[number]

export type NotificationCategory =
  | "transactional"
  | "reminder"
  | "marketing"
  | "operational"

export type NotificationPayload = {
  title: string
  body: string
  url: string
  tag: string
  data: {
    eventType: NotificationEventType
    merchantId?: string
    membershipId?: string
    rewardEventId?: string
  }
}

export type BuildNotificationPayloadInput = {
  eventType: NotificationEventType
  businessName?: string | null
  rewardName?: string | null
  announcementTitle?: string | null
  announcementBody?: string | null
  url?: string | null
  merchantId?: string | null
  membershipId?: string | null
  rewardEventId?: string | null
}

const EVENT_CATEGORY: Record<NotificationEventType, NotificationCategory> = {
  push_permission_prompt_viewed: "operational",
  push_permission_granted: "operational",
  push_subscription_created: "operational",
  push_subscription_disabled: "operational",
  push_subscription_failed: "operational",
  one_stamp_away: "transactional",
  next_stamp_available: "reminder",
  reward_unlocked_waiting: "transactional",
  reward_ready: "transactional",
  profile_required_to_collect: "transactional",
  reward_expiring_soon: "reminder",
  reward_expired: "reminder",
  reward_collected_cycle_started: "transactional",
  dormant_progress: "marketing",
  venue_announcement: "marketing",
  birthday_reward_issued: "marketing",
  merchant_reward_received: "marketing",
  referral_bonus_stamp_issued: "transactional",
  referral_friend_joined: "transactional",
  referral_qualified: "transactional",
  referral_bonus_saved: "transactional",
}

const BLOCKED_METADATA_KEYS = new Set([
  "auth",
  "email",
  "endpoint",
  "latitude",
  "longitude",
  "phone",
  "p256dh",
  "raw_coordinates",
  "rawcoordinates",
  "rawlocation",
  "secret",
  "token",
])

type PayloadCopyInput = {
  businessName: string
  rewardName: string
  announcementTitle?: string | null
  announcementBody?: string | null
}

type PayloadCopy = Pick<NotificationPayload, "title" | "body">

const PAYLOAD_COPY: Record<
  NotificationEventType,
  (input: PayloadCopyInput) => PayloadCopy
> = {
  push_permission_prompt_viewed: () => ({
    title: "Notifications",
    body: "Notification preference opened.",
  }),
  push_permission_granted: () => ({
    title: "Notifications enabled",
    body: "Reward and stamp reminders can now reach this browser.",
  }),
  push_subscription_created: () => ({
    title: "Browser subscribed",
    body: "This browser can receive loyalty updates.",
  }),
  push_subscription_disabled: () => ({
    title: "Notifications off",
    body: "This browser will stop receiving loyalty updates.",
  }),
  push_subscription_failed: () => ({
    title: "Notifications unavailable",
    body: "This browser could not keep its push subscription active.",
  }),
  one_stamp_away: (input) => ({
    title: "One stamp away",
    body: `${input.businessName} has a reward nearly ready.`,
  }),
  next_stamp_available: (input) => ({
    title: "Next stamp available",
    body: `${input.businessName} can stamp your card again today.`,
  }),
  reward_unlocked_waiting: (input) => ({
    title: "Reward unlocked",
    body: `${input.rewardName} is waiting for the next eligible collection day.`,
  }),
  reward_ready: (input) => ({
    title: "Reward ready",
    body: `${input.rewardName} is ready to collect at ${input.businessName}.`,
  }),
  profile_required_to_collect: (input) => ({
    title: "Finish your details",
    body: `Complete your profile before collecting ${input.rewardName}.`,
  }),
  reward_expiring_soon: (input) => ({
    title: "Reward expiring soon",
    body: `${input.rewardName} is close to its expiry time.`,
  }),
  reward_expired: (input) => ({
    title: "Reward expired",
    body: `${input.rewardName} can no longer be collected.`,
  }),
  reward_collected_cycle_started: (input) => ({
    title: "Reward collected",
    body: `A new ${input.businessName} stamp cycle has started.`,
  }),
  dormant_progress: (input) => ({
    title: "Stamp card waiting",
    body: `${input.businessName} still has progress on your card.`,
  }),
  venue_announcement: (input) => ({
    title: input.announcementTitle ?? input.businessName,
    body: input.announcementBody ?? `${input.businessName} has an update.`,
  }),
  birthday_reward_issued: (input) => ({
    title: "Birthday treat",
    body: `${input.rewardName} is waiting at ${input.businessName}.`,
  }),
  merchant_reward_received: (input) => ({
    title: "A reward for you",
    body: `${input.businessName} sent you ${input.rewardName}.`,
  }),
  referral_bonus_stamp_issued: (input) => ({
    title: "You earned a bonus stamp",
    body: `Someone you invited to ${input.businessName} collected their first stamp — you both got one.`,
  }),
  referral_friend_joined: (input) => ({
    title: "Your friend joined",
    body: `Someone you invited to ${input.businessName} just joined.`,
  }),
  referral_qualified: (input) => ({
    title: "Your referral qualified",
    body: `Your invited friend made their first visit to ${input.businessName} — your bonus is on its way.`,
  }),
  referral_bonus_saved: (input) => ({
    title: "Bonus saved",
    body: `Your referral bonus at ${input.businessName} is saved and will be added automatically.`,
  }),
}

export function notificationEventCategory(
  eventType: NotificationEventType
): NotificationCategory {
  return EVENT_CATEGORY[eventType]
}

export function notificationRequiresMarketingConsent(
  eventType: NotificationEventType
) {
  return notificationEventCategory(eventType) === "marketing"
}

export function buildNotificationPayload(
  input: BuildNotificationPayloadInput
): NotificationPayload {
  const businessName = cleanText(input.businessName) ?? "Your venue"
  const rewardName = cleanText(input.rewardName) ?? "your reward"
  const url = safeNotificationPath(input.url)

  const base = payloadCopy(input.eventType, {
    businessName,
    rewardName,
    announcementTitle: cleanText(input.announcementTitle),
    announcementBody: cleanText(input.announcementBody),
  })

  return {
    ...base,
    url,
    tag: `${input.eventType}:${input.membershipId ?? input.rewardEventId ?? "customer"}`,
    data: {
      eventType: input.eventType,
      ...(input.merchantId ? { merchantId: input.merchantId } : {}),
      ...(input.membershipId ? { membershipId: input.membershipId } : {}),
      ...(input.rewardEventId ? { rewardEventId: input.rewardEventId } : {}),
    },
  }
}

export function sanitizeNotificationMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(metadata).filter(([key]) => {
      const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase()
      return !BLOCKED_METADATA_KEYS.has(normalized)
    })
  )
}

export function isNotificationEventType(
  value: string
): value is NotificationEventType {
  return (notificationEventTypes as readonly string[]).includes(value)
}

function payloadCopy(
  eventType: NotificationEventType,
  input: PayloadCopyInput
): PayloadCopy {
  return PAYLOAD_COPY[eventType](input)
}

function safeNotificationPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/home"
  }

  return value
}

function cleanText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed.slice(0, 180) : null
}
