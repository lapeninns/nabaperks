import "server-only"

import { after } from "next/server"

import { scheduleAfterResponseAnalytics } from "@/lib/analytics/after-response"
import { recordProductEvent } from "@/lib/analytics/events"
import {
  contactEventMetadata,
  type ContactEventMetadata,
  type CustomerContactEventName,
} from "@/lib/customer/contact-event-core"
import { logger } from "@/lib/observability/logger"

export type CustomerContactEventInput = {
  readonly eventName: CustomerContactEventName
  readonly customerId?: string | null
  readonly merchantId?: string | null
  readonly metadata: ContactEventMetadata
}

/**
 * Best-effort contact and sign-in tracking for server actions. The write runs
 * after the response, so it never slows or breaks a sign-in, a code send or a
 * stamp; a failure is logged by event name only. Metadata is re-reduced to the
 * closed `{method, surface, reason}` vocabulary, so a caller cannot widen it.
 */
export function recordCustomerContactEvent(
  input: CustomerContactEventInput
): void {
  const metadata = contactEventMetadata(input.metadata)
  scheduleAfterResponseAnalytics(after, async () => {
    try {
      await recordProductEvent({
        eventName: input.eventName,
        customerId: input.customerId ?? null,
        merchantId: input.merchantId ?? null,
        actorType: input.customerId ? "customer" : "system",
        actorId: input.customerId ?? null,
        metadata,
      })
    } catch (error) {
      logger.warn("customer_contact_event_failed", {
        eventName: input.eventName,
        error,
      })
    }
  })
}
