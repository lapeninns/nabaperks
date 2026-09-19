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
  "collection_window_opens",
  "reward_upgraded",
  "loyalty_terms_updated",
  "venue_paused",
] as const

export type NotificationEventType = (typeof notificationEventTypes)[number]

export type NotificationCategory =
  "transactional" | "reminder" | "marketing" | "operational"

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
  expiresAt?: string | null
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
  collection_window_opens: "marketing",
  reward_upgraded: "transactional",
  loyalty_terms_updated: "transactional",
  venue_paused: "transactional",
}

const BLOCKED_METADATA_KEYS = new Set([
  "auth",
  "body",
  "email",
  "endpoint",
  "e164",
  "from",
  "latitude",
  "longitude",
  "phone",
  "p256dh",
  "raw_coordinates",
  "rawcoordinates",
  "rawlocation",
  "recipient",
  "secret",
  "token",
  "to",
])

type PayloadCopyInput = {
  businessName: string
  rewardName: string
  url: string
  announcementTitle?: string | null
  announcementBody?: string | null
  expiresAt?: string | null
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
    body: input.expiresAt
      ? `Collect ${input.rewardName} by ${input.expiresAt}.`
      : `${input.rewardName} is close to its expiry time.`,
  }),
  reward_expired: (input) => ({
    title: "Reward expired",
    body: `${input.rewardName} can no longer be collected.`,
  }),
  reward_collected_cycle_started: (input) => ({
    title: "Reward collected",
    body: `${input.rewardName} collected at ${input.businessName}.`,
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
  collection_window_opens: (input) => ({
    title: "Collection window open",
    body: `${input.businessName} has a reward collection window open now.`,
  }),
  reward_upgraded: (input) => ({
    title: "Reward upgraded",
    body: `${input.rewardName} was upgraded at ${input.businessName}.`,
  }),
  loyalty_terms_updated: () => ({
    title: "Loyalty terms updated",
    body: "Your card now keeps earning while you hold a reward. Rewards are collectable from the next day; one per visit.",
  }),
  venue_paused: (input) => ({
    title: "Loyalty programme paused",
    body: `${input.businessName} paused its loyalty programme. Existing rewards remain in your wallet.`,
  }),
}

export type PhoneMessageCopy = {
  readonly smsBody: string
  readonly whatsappVariables: Readonly<Record<string, string>>
}

export const PHONE_COPY: Record<
  NotificationEventType,
  (input: PayloadCopyInput) => PhoneMessageCopy
> = {
  push_permission_prompt_viewed: phoneCopyFor("push_permission_prompt_viewed"),
  push_permission_granted: phoneCopyFor("push_permission_granted"),
  push_subscription_created: phoneCopyFor("push_subscription_created"),
  push_subscription_disabled: phoneCopyFor("push_subscription_disabled"),
  push_subscription_failed: phoneCopyFor("push_subscription_failed"),
  one_stamp_away: phoneCopyFor("one_stamp_away"),
  next_stamp_available: phoneCopyFor("next_stamp_available"),
  reward_unlocked_waiting: phoneCopyFor("reward_unlocked_waiting"),
  reward_ready: phoneCopyFor("reward_ready"),
  profile_required_to_collect: phoneCopyFor("profile_required_to_collect"),
  reward_expiring_soon: phoneCopyFor("reward_expiring_soon"),
  reward_expired: phoneCopyFor("reward_expired"),
  reward_collected_cycle_started: phoneCopyFor(
    "reward_collected_cycle_started"
  ),
  dormant_progress: phoneCopyFor("dormant_progress"),
  venue_announcement: phoneCopyFor("venue_announcement"),
  birthday_reward_issued: phoneCopyFor("birthday_reward_issued"),
  merchant_reward_received: phoneCopyFor("merchant_reward_received"),
  referral_bonus_stamp_issued: phoneCopyFor("referral_bonus_stamp_issued"),
  referral_friend_joined: phoneCopyFor("referral_friend_joined"),
  referral_qualified: phoneCopyFor("referral_qualified"),
  referral_bonus_saved: phoneCopyFor("referral_bonus_saved"),
  collection_window_opens: phoneCopyFor("collection_window_opens"),
  reward_upgraded: phoneCopyFor("reward_upgraded"),
  loyalty_terms_updated: phoneCopyFor("loyalty_terms_updated"),
  venue_paused: phoneCopyFor("venue_paused"),
}

export function buildPhoneMessageCopy(
  input: BuildNotificationPayloadInput
): PhoneMessageCopy | null {
  const copy = PHONE_COPY[input.eventType]
  if (!copy) return null
  return copy({
    businessName: cleanText(input.businessName) ?? "Your venue",
    rewardName: cleanText(input.rewardName) ?? "your reward",
    url: safeNotificationPath(input.url),
    announcementTitle: cleanText(input.announcementTitle),
    announcementBody: cleanText(input.announcementBody),
    expiresAt: formatLondonDeadline(input.expiresAt),
  })
}

function phoneCopyFor(eventType: NotificationEventType) {
  return (input: PayloadCopyInput): PhoneMessageCopy => {
    const payload = PAYLOAD_COPY[eventType](input)
    return phoneCopyFromPayload(eventType, { ...payload, url: input.url })
  }
}

export function buildPhoneMessageCopyFromPayload(
  eventType: NotificationEventType,
  payload: Readonly<Record<string, unknown>>
): PhoneMessageCopy | null {
  if (
    typeof payload.title !== "string" ||
    typeof payload.body !== "string" ||
    typeof payload.url !== "string"
  ) {
    return null
  }
  return phoneCopyFromPayload(eventType, {
    title: payload.title,
    body: payload.body,
    url: payload.url,
  })
}

function phoneCopyFromPayload(
  eventType: NotificationEventType,
  payload: Pick<NotificationPayload, "title" | "body" | "url">
): PhoneMessageCopy {
  const suffix =
    EVENT_CATEGORY[eventType] === "marketing" ? " Reply STOP to opt out." : ""
  const maximumBodyLength = 160 - suffix.length
  return {
    smsBody: `${payload.body.slice(0, maximumBodyLength).trimEnd()}${suffix}`,
    whatsappVariables: {
      "1": payload.title,
      "2": payload.body,
      "3": payload.url,
    },
  }
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
    url,
    announcementTitle: cleanText(input.announcementTitle),
    announcementBody: cleanText(input.announcementBody),
    expiresAt: formatLondonDeadline(input.expiresAt),
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

function formatLondonDeadline(value: string | null | undefined) {
  if (!value) return null
  const deadline = new Date(value)
  if (Number.isNaN(deadline.getTime())) return null
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(deadline)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ""
  return `${part("weekday")} ${part("day")} ${part("month")} at ${part("hour")}:${part("minute")}`
}
