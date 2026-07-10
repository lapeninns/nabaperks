import { after } from "next/server"

import type { ProductEventInput } from "@/lib/analytics/events"
import { getServerEnv } from "@/lib/env/server"
import { getStripe } from "@/lib/stripe/server"
import {
  claimStripeWebhookEvent,
  createStripeWebhookProcessorDependencies,
  failStripeWebhookEvent,
  handleStripeWebhookRequest,
  processStripeWebhookEvent,
  type StripeWebhookProcessResult,
} from "@/lib/stripe/webhook-events"

export async function POST(request: Request) {
  const env = getServerEnv()
  const stripe = getStripe()
  const processorDependencies = createStripeWebhookProcessorDependencies(stripe)

  return handleStripeWebhookRequest(request, {
    constructEvent: (body, signature) =>
      stripe.webhooks.constructEvent(
        body,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      ),
    claimEvent: claimStripeWebhookEvent,
    processEvent: (input) =>
      processStripeWebhookEvent(input, processorDependencies),
    failEvent: failStripeWebhookEvent,
    scheduleAppliedSideEffects: scheduleStripeAppliedSideEffects,
  })
}

function scheduleStripeAppliedSideEffects(result: StripeWebhookProcessResult) {
  if (result.status !== "applied" || !result.merchantId) return

  scheduleAfterResponse(async () => {
    const { revalidateMerchantLaunchSurfaces } =
      await import("@/lib/merchant/revalidate-launch-surfaces")
    const { recordProductEvent } = await import("@/lib/analytics/events")

    try {
      revalidateMerchantLaunchSurfaces(result.merchantId as string)
    } catch (error) {
      console.warn("stripe_billing_revalidation_failed", {
        merchantId: result.merchantId,
        error: errorMessage(error),
      })
    }

    const productEvents: readonly ProductEventInput[] = result.productEvents
    const results = await Promise.allSettled(
      productEvents.map((productEvent) => recordProductEvent(productEvent))
    )

    for (const [index, eventResult] of results.entries()) {
      if (eventResult.status === "fulfilled") continue

      const productEvent = productEvents[index]
      if (!productEvent) continue

      console.warn("stripe_product_event_record_failed", {
        eventName: productEvent.eventName,
        error: errorMessage(eventResult.reason),
      })
    }
  })
}

function scheduleAfterResponse(callback: () => Promise<void>) {
  try {
    after(callback)
  } catch (error) {
    if (isOutsideRequestScopeError(error)) {
      void callback()
      return
    }

    throw error
  }
}

function isOutsideRequestScopeError(error: unknown) {
  return (
    error instanceof Error && error.message.includes("outside a request scope")
  )
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error"
}
