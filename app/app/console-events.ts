"use server"

import { parseConsoleEvent } from "@/lib/analytics/console-contract"
import { capturePostHogEvent } from "@/lib/analytics/events"
import { getCurrentMerchant } from "@/lib/auth/session"

/**
 * The one door from console client components to analytics. Validates the
 * payload against the pure contract, attributes it to the signed-in merchant
 * and mirrors it through `capturePostHogEvent` — the same path as
 * `dashboard_viewed`. Observational only: it never throws to the caller.
 */
export async function recordConsoleEventAction(input: unknown): Promise<void> {
  const event = parseConsoleEvent(input)
  if (!event) return

  try {
    const merchant = await getCurrentMerchant()
    if (!merchant) return

    await capturePostHogEvent({
      eventName: event.name,
      merchantId: merchant.id,
      actorType: "merchant",
      actorId: merchant.id,
      metadata: event.properties,
    })
  } catch {
    // Analytics is best-effort; a failed mirror must never surface at the till.
  }
}
