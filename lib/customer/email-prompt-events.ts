"use server"

import { recordProductEvent } from "@/lib/analytics/events"
import {
  isClientEmailPromptEvent,
  isEmailPromptSurface,
} from "@/lib/customer/contact-event-core"
import { deterministicContactEventId } from "@/lib/customer/contact-events"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { ukTodayIso } from "@/lib/customer/uk-calendar"
import { logger } from "@/lib/observability/logger"
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"

/** Genuine prompts report a view once per mount and a dismissal once per click. */
const PROMPT_EVENT_LIMIT = 5
const PROMPT_EVENT_WINDOW_MS = 60_000

/**
 * Records that the signed-in customer saw or dismissed the "add your email"
 * prompt. Best-effort analytics modelled on `recordReferralShare`: it never
 * throws into the prompt. Anything a browser sends is untrusted, so only the two
 * prompt events and the two prompt surfaces are accepted, nothing is recorded
 * without a signed-in customer, and the customer id comes from the session.
 *
 * A browser can call this action directly, so it is bounded (QA BUG-025): a few
 * calls per customer, event and surface a minute, and one row per customer,
 * event, surface and UK day. Repeats upsert onto that row and reach PostHog
 * with the same `$insert_id`. A refused call is silent: this is analytics.
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

    await enforceRateLimit({
      key: `email-prompt-event:${customer.id}:${eventName}:${surface}`,
      limit: PROMPT_EVENT_LIMIT,
      windowMs: PROMPT_EVENT_WINDOW_MS,
    })

    await recordProductEvent({
      eventId: deterministicContactEventId([
        "email-prompt",
        customer.id,
        eventName,
        surface,
        ukTodayIso(),
      ]),
      eventName,
      customerId: customer.id,
      actorType: "customer",
      actorId: customer.id,
      metadata: { method: "email", surface },
    })
  } catch (error) {
    if (error instanceof RateLimitError) return
    logger.warn("customer_email_prompt_event_failed", { error })
  }
}
