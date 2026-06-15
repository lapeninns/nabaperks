import "server-only"

import { capturePostHogEvent } from "@/lib/analytics/events"

export type JoinFunnelEventName =
  | "join_page_viewed"
  | "join_phone_requested"
  | "join_otp_verified"
  | "join_terms_accepted"
  | "customer_card_viewed"

type JoinFunnelEventInput = {
  readonly eventName: JoinFunnelEventName
  readonly merchantId?: string | null
  readonly customerId?: string | null
  readonly membershipId?: string | null
  readonly qrCodeId?: string | null
  readonly merchantSlug?: string
  readonly qrId?: string
  readonly step?: string
  readonly metadata?: Record<string, unknown>
}

export async function captureJoinFunnelEvent(
  input: JoinFunnelEventInput
): Promise<void> {
  await capturePostHogEvent({
    eventName: input.eventName,
    merchantId: input.merchantId,
    customerId: input.customerId,
    membershipId: input.membershipId,
    qrCodeId: input.qrCodeId,
    actorType: input.customerId ? "customer" : "system",
    actorId: input.customerId ?? null,
    metadata: {
      merchant_slug: input.merchantSlug,
      qr_id: input.qrId,
      step: input.step,
      ...input.metadata,
    },
  })
}
