import { NextResponse } from "next/server"
import Stripe from "stripe"

import { recordProductEvent } from "@/lib/analytics/events"
import { getServerEnv } from "@/lib/env/server"
import {
  setBillingStatusForSubscription,
  stripeId,
  stripeInvoiceSubscriptionId,
  syncStripeSubscription,
} from "@/lib/stripe/billing"
import { getStripe } from "@/lib/stripe/server"
import {
  claimStripeWebhookEvent,
  markStripeWebhookEventFailed,
  markStripeWebhookEventProcessed,
} from "@/lib/stripe/webhook-events"

export async function POST(request: Request) {
  const env = getServerEnv()
  const stripe = getStripe()
  const signature = request.headers.get("stripe-signature")
  const body = await request.text()

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature" },
      { status: 400 }
    )
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    )
  } catch {
    return NextResponse.json(
      { error: "Invalid Stripe signature" },
      { status: 400 }
    )
  }

  try {
    const claim = await claimStripeWebhookEvent(event)
    if (claim.status === "duplicate") {
      return NextResponse.json({ received: true, duplicate: true })
    }

    await handleStripeEvent(stripe, event)
    await markStripeWebhookEventProcessed(event.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook failed"
    await markStripeWebhookEventFailed(event.id, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

async function handleStripeEvent(stripe: Stripe, event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const subscriptionId = stripeId(session.subscription)

      if (session.mode === "subscription" && subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        const result = await syncStripeSubscription({
          subscription,
          merchantId: session.metadata?.merchant_id,
        })
        await recordProductEvent({
          eventName: "subscription_started",
          merchantId: result.merchantId,
          actorType: "system",
          metadata: {
            stripe_subscription_id: subscription.id,
            billing_status: result.status,
          },
        })
      }
      break
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const result = await syncStripeSubscription({
        subscription: event.data.object as Stripe.Subscription,
      })
      if (result.status === "cancelled") {
        await recordProductEvent({
          eventName: "subscription_cancelled",
          merchantId: result.merchantId,
          actorType: "system",
          metadata: {
            stripe_subscription_id: (event.data.object as Stripe.Subscription)
              .id,
          },
        })
      }
      break
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = stripeInvoiceSubscriptionId(invoice)

      if (subscriptionId) {
        await setBillingStatusForSubscription({
          subscriptionId,
          status: "past_due",
        })
      }
      break
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice
      const subscriptionId = stripeInvoiceSubscriptionId(invoice)

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)
        await syncStripeSubscription({ subscription })
      }
      break
    }
    default:
      break
  }
}
