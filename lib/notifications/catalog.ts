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
  input: {
    businessName: string
    rewardName: string
    announcementTitle?: string | null
    announcementBody?: string | null
  }
): Pick<NotificationPayload, "title" | "body"> {
  switch (eventType) {
    case "push_permission_prompt_viewed":
      return {
        title: "Notifications",
        body: "Notification preference opened.",
      }
    case "push_permission_granted":
      return {
        title: "Notifications enabled",
        body: "Reward and stamp reminders can now reach this browser.",
      }
    case "push_subscription_created":
      return {
        title: "Browser subscribed",
        body: "This browser can receive loyalty updates.",
      }
    case "push_subscription_disabled":
      return {
        title: "Notifications off",
        body: "This browser will stop receiving loyalty updates.",
      }
    case "push_subscription_failed":
      return {
        title: "Notifications unavailable",
        body: "This browser could not keep its push subscription active.",
      }
    case "one_stamp_away":
      return {
        title: "One stamp away",
        body: `${input.businessName} has a reward nearly ready.`,
      }
    case "next_stamp_available":
      return {
        title: "Next stamp available",
        body: `${input.businessName} can stamp your card again today.`,
      }
    case "reward_unlocked_waiting":
      return {
        title: "Reward unlocked",
        body: `${input.rewardName} is waiting for the next eligible collection day.`,
      }
    case "reward_ready":
      return {
        title: "Reward ready",
        body: `${input.rewardName} is ready to collect at ${input.businessName}.`,
      }
    case "profile_required_to_collect":
      return {
        title: "Finish your details",
        body: `Complete your profile before collecting ${input.rewardName}.`,
      }
    case "reward_expiring_soon":
      return {
        title: "Reward expiring soon",
        body: `${input.rewardName} is close to its expiry time.`,
      }
    case "reward_expired":
      return {
        title: "Reward expired",
        body: `${input.rewardName} can no longer be collected.`,
      }
    case "reward_collected_cycle_started":
      return {
        title: "Reward collected",
        body: `A new ${input.businessName} stamp cycle has started.`,
      }
    case "dormant_progress":
      return {
        title: "Stamp card waiting",
        body: `${input.businessName} still has progress on your card.`,
      }
    case "venue_announcement":
      return {
        title: input.announcementTitle ?? input.businessName,
        body: input.announcementBody ?? `${input.businessName} has an update.`,
      }
  }
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
