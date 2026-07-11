import "server-only"

import { headers } from "next/headers"
import { after } from "next/server"

import { scheduleAfterResponseAnalytics } from "@/lib/analytics/after-response"
import { recordProductEvent } from "@/lib/analytics/events"
import {
  deterministicFunnelEventId,
  verifyFunnelToken,
} from "@/lib/analytics/funnel-token"
import { pseudonymizeAnalyticsId } from "@/lib/analytics/privacy-core"
import {
  JOIN_JOURNEY_HEADER,
  productEventJoinMetadata,
  type JoinEntry,
  type JoinStep,
  type JoinSurface,
} from "@/lib/customer/join-observability-contract"
import {
  normalizeRequestId,
  REQUEST_ID_HEADER,
} from "@/lib/observability/request-id"
import { logger } from "@/lib/observability/logger"

export type JoinFunnelEventName =
  | "join_page_viewed"
  | "join_phone_requested"
  | "join_otp_verified"
  | "join_terms_accepted"
  | "join_first_stamp_issued"
  | "join_first_stamp_pending"
  | "customer_card_viewed"

export type JoinFunnelEventInput = {
  readonly eventName: JoinFunnelEventName
  readonly merchantId?: string | null
  readonly customerId?: string | null
  readonly membershipId?: string | null
  readonly qrCodeId?: string | null
  readonly scopeKey?: string
  readonly entry?: JoinEntry
  readonly step: JoinStep
  readonly surface?: JoinSurface
}

export async function captureJoinFunnelEvent(
  input: JoinFunnelEventInput
): Promise<void> {
  const requestHeaders = await headers()
  const token = requestHeaders.get(JOIN_JOURNEY_HEADER)
  const requestId =
    normalizeRequestId(requestHeaders.get(REQUEST_ID_HEADER)) ?? "unavailable"
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()
  if (!token || !secret) return

  const identity = verifyFunnelToken(token, secret, Date.now())
  if (!identity) return

  scheduleAfterResponseAnalytics(after, async () => {
    try {
      const funnelKey = pseudonymizeAnalyticsId(
        "funnel",
        identity.funnelId,
        secret
      )
      await recordProductEvent({
        awaitExternalMirror: true,
        eventId: deterministicFunnelEventId(
          token,
          `${input.merchantId ?? input.scopeKey ?? "unknown"}:${input.eventName}:${input.step}`
        ),
        eventName: input.eventName,
        merchantId: input.merchantId,
        customerId: input.customerId,
        membershipId: input.membershipId,
        qrCodeId: input.qrCodeId,
        actorType: input.customerId ? "customer" : "system",
        actorId: input.customerId ?? null,
        analyticsIdentity: { domain: "funnel", value: identity.funnelId },
        metadata: productEventJoinMetadata({
          entry: input.entry,
          funnelKey,
          step: input.step,
          surface: input.surface ?? "customer_join",
        }),
      })
    } catch (error) {
      if (!(error instanceof Error)) throw error
      logger.warn("customer_join_event_persist_failed", {
        requestId,
        eventName: input.eventName,
        operation: "product_event_persist",
      })
    }
  })
}
