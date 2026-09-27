"use server"

import { recordProductEvent } from "@/lib/analytics/events"
import {
  isClientEmailPromptEvent,
  isEmailPromptSurface,
} from "@/lib/customer/contact-event-core"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { logger } from "@/lib/observability/logger"

/**
 * Records that the signed-in customer saw or dismissed the "add your email"
 * prompt. Best-effort analytics modelled on `recordReferralShare`: it never
 * throws into the prompt. Anything a browser sends is untrusted, so only the two
 * prompt events and the two prompt surfaces are accepted, nothing is recorded
 * without a signed-in customer, and the customer id comes from the session.
 */
export async function recordEmailPromptEvent(
  eventName: unknown,
  surface: unknown
): Promise<void> {
  try {
    if (
      !isClientEmailPromptEvent(eventName) ||
      !isEmailPromptSurface(surface)
    ) {
      return
    }
    const customer = await getCurrentCustomer()
    if (!customer) return

    await recordProductEvent({
      eventName,
      customerId: customer.id,
      actorType: "customer",
      actorId: customer.id,
      metadata: { method: "email", surface },
    })
  } catch (error) {
    logger.warn("customer_email_prompt_event_failed", { error })
  }
}
