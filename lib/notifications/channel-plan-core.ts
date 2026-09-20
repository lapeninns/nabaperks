import type {
  NotificationCategory,
  NotificationEventType,
} from "@/lib/notifications/catalog"
import customerMessagingContentEvents from "@/config/customer-messaging-content-events.json" with { type: "json" }

export type CustomerMessageChannel = "whatsapp" | "sms"
export type NotificationDeliveryChannel = CustomerMessageChannel | "push"
export type CustomerMessagingMode = "off" | "dry_run" | "live"

export const PHONE_CHANNEL_EVENT_TYPES = new Set<NotificationEventType>(
  customerMessagingContentEvents as NotificationEventType[]
)

export type DeliveryDecisionInput = {
  readonly eventType: NotificationEventType
  readonly category: NotificationCategory
  readonly messagingMode: CustomerMessagingMode
  readonly merchantMessagingEnabled: boolean
  readonly phoneMessagesEnabled: boolean
  readonly phoneCategoryEnabled: boolean
  readonly preferredPhoneChannel: CustomerMessageChannel
  readonly whatsappUnavailable: boolean
  readonly phoneRecipientAvailable: boolean
  readonly pushAvailable: boolean
  readonly pushCategoryEnabled: boolean
  readonly pushMarketingConsent: boolean
  readonly phoneMarketingConsent: Readonly<
    Record<CustomerMessageChannel, boolean>
  >
  readonly fallbackFrom: CustomerMessageChannel | null
}

export type DeliveryDecision = {
  readonly channels: readonly NotificationDeliveryChannel[]
  readonly dryRun: boolean
}

export function resolveDeliveryDecision(
  input: DeliveryDecisionInput
): DeliveryDecision {
  const channels: NotificationDeliveryChannel[] = []
  const phoneIsAvailable =
    input.messagingMode !== "off" &&
    input.merchantMessagingEnabled &&
    input.phoneMessagesEnabled &&
    input.phoneCategoryEnabled &&
    input.phoneRecipientAvailable &&
    input.category !== "operational" &&
    PHONE_CHANNEL_EVENT_TYPES.has(input.eventType)

  if (phoneIsAvailable) {
    for (const channel of phoneChannelOrder(input)) {
      if (
        input.category !== "marketing" ||
        input.phoneMarketingConsent[channel]
      ) {
        channels.push(channel)
      }
    }
  }

  if (
    input.pushAvailable &&
    input.pushCategoryEnabled &&
    (input.category !== "marketing" || input.pushMarketingConsent)
  ) {
    channels.push("push")
  }

  return { channels, dryRun: input.messagingMode === "dry_run" }
}

function phoneChannelOrder(
  input: DeliveryDecisionInput
): readonly CustomerMessageChannel[] {
  if (input.fallbackFrom === "whatsapp") return ["sms"]
  if (input.preferredPhoneChannel === "sms") return ["sms"]
  if (input.whatsappUnavailable) return ["sms"]
  return ["whatsapp", "sms"]
}
