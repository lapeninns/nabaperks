import "server-only"

import type Stripe from "stripe"

import type { ProductEventInput } from "@/lib/analytics/events"
import {
  applyStripeSubscriptionEvent,
  mapStripeSubscriptionSnapshot,
  mapStripeSubscriptionStatus,
  resolveStripeSubscriptionMerchant,
  stripeId,
  stripeInvoiceSubscriptionId,
  type StripeBillingOwnership,
  type StripeSubscriptionResolutionInput,
  type SubscriptionApplyResult,
} from "@/lib/stripe/billing"

export type StripeWebhookEventRecord = Pick<
  Stripe.Event,
  "id" | "type" | "livemode" | "created"
>

export type StripeWebhookClaimResult =
  | {
      status: "claimed"
      leaseId: string
      leaseExpiresAt: string
      attemptCount: number
    }
  | { status: "processed"; attemptCount: number }
  | { status: "busy"; attemptCount: number }

export type StripeWebhookProcessResult = {
  status: "applied" | "stale" | "completed"
  merchantId: string | null
  productEvents: ProductEventInput[]
}

export type StripeWebhookRouteDependencies = {
  constructEvent: (body: string, signature: string) => Stripe.Event
  claimEvent: (event: Stripe.Event) => Promise<StripeWebhookClaimResult>
  processEvent: (input: {
    event: Stripe.Event
    leaseId: string
  }) => Promise<StripeWebhookProcessResult>
  failEvent: (input: {
    eventId: string
    leaseId: string
    errorCode: string
  }) => Promise<boolean>
  scheduleAppliedSideEffects: (result: StripeWebhookProcessResult) => void
}

export type StripeWebhookProcessorDependencies = {
  retrieveSubscription: (subscriptionId: string) => Promise<Stripe.Subscription>
  resolveSubscriptionMerchant: (
    input: StripeSubscriptionResolutionInput
  ) => Promise<StripeBillingOwnership>
  applySubscriptionEvent: (input: {
    eventId: string
    leaseId: string
    merchantId: string
    snapshot: ReturnType<typeof mapStripeSubscriptionSnapshot>
    entitlementStatus: ReturnType<typeof mapStripeSubscriptionStatus>
  }) => Promise<SubscriptionApplyResult>
  completeEvent: (input: {
    eventId: string
    leaseId: string
  }) => Promise<boolean>
}

type StripeWebhookProcessingErrorCode =
  | "live_mode_rejected"
  | "ownership_mismatch"
  | "lease_lost"
  | "processing_failed"

const MAX_STRIPE_WEBHOOK_BODY_BYTES = 1_048_576

export class StripeWebhookProcessingError extends Error {
  readonly code: StripeWebhookProcessingErrorCode

  constructor(code: StripeWebhookProcessingErrorCode) {
    super(code)
    this.name = "StripeWebhookProcessingError"
    this.code = code
  }
}

export function stripeWebhookProcessingErrorCode(error: unknown) {
  return error instanceof StripeWebhookProcessingError
    ? error.code
    : "processing_failed"
}

/** HTTP seam used by the route after it supplies signature verification. */
export async function handleStripeWebhookRequest(
  request: Request,
  dependencies: StripeWebhookRouteDependencies
) {
  const signature = request.headers.get("stripe-signature")

  if (!signature) {
    return Response.json({ error: "Missing Stripe signature" }, { status: 400 })
  }

  const body = await readBoundedWebhookBody(request)
  if (body === null) {
    return Response.json(
      { error: "Stripe webhook body is too large" },
      { status: 413 }
    )
  }

  let event: Stripe.Event

  try {
    event = dependencies.constructEvent(body, signature)
  } catch {
    return Response.json({ error: "Invalid Stripe signature" }, { status: 400 })
  }

  if (event.livemode !== false) {
    return Response.json(
      { error: "Live Stripe events are not accepted" },
      { status: 400 }
    )
  }

  let claim: StripeWebhookClaimResult

  try {
    claim = await dependencies.claimEvent(event)
  } catch {
    return Response.json(
      { error: "Stripe webhook could not be claimed" },
      { status: 500 }
    )
  }

  if (claim.status === "processed") {
    return Response.json({ received: true, duplicate: true })
  }

  if (claim.status === "busy") {
    return Response.json(
      { error: "Stripe webhook is already being processed" },
      { status: 503, headers: { "Retry-After": "5" } }
    )
  }

  let result: StripeWebhookProcessResult

  try {
    result = await dependencies.processEvent({
      event,
      leaseId: claim.leaseId,
    })
  } catch (error) {
    const errorCode = stripeWebhookProcessingErrorCode(error)

    try {
      await dependencies.failEvent({
        eventId: event.id,
        leaseId: claim.leaseId,
        errorCode,
      })
    } catch {
      // The 5-minute lease remains reclaimable even if recording failure fails.
    }

    return Response.json(
      { error: "Stripe webhook processing failed" },
      { status: 500 }
    )
  }

  if (result.status === "applied") {
    try {
      dependencies.scheduleAppliedSideEffects(result)
    } catch {
      // Durable billing state already applied; cache/analytics are best-effort.
    }
  }

  return Response.json({
    received: true,
    ...(result.status === "stale" ? { stale: true } : {}),
  })
}

async function readBoundedWebhookBody(
  request: Request
): Promise<string | null> {
  const contentLength = request.headers.get("content-length")
  if (
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > MAX_STRIPE_WEBHOOK_BODY_BYTES
  ) {
    return null
  }

  if (!request.body) return ""

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    byteLength += value.byteLength
    if (byteLength > MAX_STRIPE_WEBHOOK_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }

  const body = new Uint8Array(byteLength)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return new TextDecoder().decode(body)
}

export async function claimStripeWebhookEvent(
  event: StripeWebhookEventRecord
): Promise<StripeWebhookClaimResult> {
  if (event.livemode !== false) {
    throw new StripeWebhookProcessingError("live_mode_rejected")
  }

  const { createSupabaseServiceRoleClient } =
    await import("@/lib/supabase/server")
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("claim_stripe_webhook_event", {
    p_stripe_event_id: event.id,
    p_event_type: event.type,
    p_livemode: event.livemode,
    p_stripe_created_at: new Date(event.created * 1000).toISOString(),
  })

  if (error) {
    throw new Error(`Unable to claim Stripe webhook: ${error.message}`)
  }

  const row = firstRpcRow(data)
  const attemptCount = integerField(row, "attempt_count")

  if (row.claim_status === "processed") {
    return { status: "processed", attemptCount }
  }

  if (row.claim_status === "busy") {
    return { status: "busy", attemptCount }
  }

  if (
    row.claim_status !== "claimed" ||
    typeof row.lease_id !== "string" ||
    typeof row.lease_expires_at !== "string"
  ) {
    throw new Error("Stripe webhook claim returned an invalid result")
  }

  return {
    status: "claimed",
    leaseId: row.lease_id,
    leaseExpiresAt: row.lease_expires_at,
    attemptCount,
  }
}

export async function failStripeWebhookEvent({
  eventId,
  leaseId,
  errorCode,
}: {
  eventId: string
  leaseId: string
  errorCode: string
}): Promise<boolean> {
  const { createSupabaseServiceRoleClient } =
    await import("@/lib/supabase/server")
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("fail_stripe_webhook_event", {
    p_stripe_event_id: eventId,
    p_lease_id: leaseId,
    p_error_code: safeWebhookErrorCode(errorCode),
  })

  if (error) {
    throw new Error(`Unable to fail Stripe webhook lease: ${error.message}`)
  }

  return data === true
}

export async function completeStripeWebhookEvent({
  eventId,
  leaseId,
}: {
  eventId: string
  leaseId: string
}): Promise<boolean> {
  const { createSupabaseServiceRoleClient } =
    await import("@/lib/supabase/server")
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("complete_stripe_webhook_event", {
    p_stripe_event_id: eventId,
    p_lease_id: leaseId,
  })

  if (error) {
    throw new Error(`Unable to complete Stripe webhook lease: ${error.message}`)
  }

  return data === true
}

export async function processStripeWebhookEvent(
  {
    event,
    leaseId,
  }: {
    event: Stripe.Event
    leaseId: string
  },
  dependencies: StripeWebhookProcessorDependencies
): Promise<StripeWebhookProcessResult> {
  if (event.livemode !== false) {
    throw new StripeWebhookProcessingError("live_mode_rejected")
  }

  const context = subscriptionContext(event)

  if (!context) {
    const completed = await dependencies.completeEvent({
      eventId: event.id,
      leaseId,
    })

    if (!completed) {
      throw new StripeWebhookProcessingError("lease_lost")
    }

    return { status: "completed", merchantId: null, productEvents: [] }
  }

  const subscription = await dependencies.retrieveSubscription(
    context.subscriptionId
  )
  assertEventOwnership(subscription, context)

  const ownership = await dependencies.resolveSubscriptionMerchant({
    subscription,
    expectedSubscriptionId: context.subscriptionId,
    merchantIdHint: context.merchantIdHint,
    customerIdHint: context.customerIdHint,
  })
  assertResolvedOwnership(subscription, context, ownership)

  const snapshot = mapStripeSubscriptionSnapshot(subscription)
  const entitlementStatus = mapStripeSubscriptionStatus(subscription.status)
  const applyStatus = await dependencies.applySubscriptionEvent({
    eventId: event.id,
    leaseId,
    merchantId: ownership.merchantId,
    snapshot,
    entitlementStatus,
  })

  if (applyStatus === "stale") {
    return { status: "stale", merchantId: null, productEvents: [] }
  }

  return {
    status: "applied",
    merchantId: ownership.merchantId,
    productEvents: productEventsForAppliedSubscription({
      event,
      merchantId: ownership.merchantId,
      subscription,
      entitlementStatus,
    }),
  }
}

export function createStripeWebhookProcessorDependencies(
  stripe: Stripe
): StripeWebhookProcessorDependencies {
  return {
    retrieveSubscription: (subscriptionId) =>
      stripe.subscriptions.retrieve(subscriptionId),
    resolveSubscriptionMerchant: resolveStripeSubscriptionMerchant,
    applySubscriptionEvent: applyStripeSubscriptionEvent,
    completeEvent: completeStripeWebhookEvent,
  }
}

type SubscriptionEventContext = {
  subscriptionId: string
  merchantIdHint: string | null
  customerIdHint: string | null
}

function subscriptionContext(
  event: Stripe.Event
): SubscriptionEventContext | null {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object
      const subscriptionId = stripeId(session.subscription)

      if (session.mode !== "subscription" || !subscriptionId) return null

      return {
        subscriptionId,
        merchantIdHint: session.metadata?.merchant_id ?? null,
        customerIdHint: stripeId(session.customer),
      }
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.pending_update_applied":
    case "customer.subscription.pending_update_expired":
    case "customer.subscription.resumed":
    case "customer.subscription.trial_will_end": {
      const payload = event.data.object
      return {
        subscriptionId: payload.id,
        merchantIdHint: payload.metadata?.merchant_id ?? null,
        customerIdHint: stripeId(payload.customer),
      }
    }
    case "invoice.payment_failed":
    case "invoice.payment_succeeded": {
      const invoice = event.data.object
      const subscriptionId = stripeInvoiceSubscriptionId(invoice)

      if (!subscriptionId) return null

      return {
        subscriptionId,
        merchantIdHint: null,
        customerIdHint: stripeId(invoice.customer),
      }
    }
    default:
      return null
  }
}

function assertEventOwnership(
  subscription: Stripe.Subscription,
  context: SubscriptionEventContext
) {
  const customerId = stripeId(subscription.customer)
  const metadataMerchantId = subscription.metadata?.merchant_id ?? null

  if (
    subscription.id !== context.subscriptionId ||
    !customerId ||
    (context.customerIdHint && context.customerIdHint !== customerId) ||
    (context.merchantIdHint &&
      metadataMerchantId &&
      context.merchantIdHint !== metadataMerchantId)
  ) {
    throw new StripeWebhookProcessingError("ownership_mismatch")
  }
}

function assertResolvedOwnership(
  subscription: Stripe.Subscription,
  context: SubscriptionEventContext,
  ownership: StripeBillingOwnership
) {
  const customerId = stripeId(subscription.customer)
  const metadataMerchantId = subscription.metadata?.merchant_id ?? null

  if (
    !customerId ||
    (ownership.stripeCustomerId && ownership.stripeCustomerId !== customerId) ||
    (context.merchantIdHint &&
      ownership.merchantId !== context.merchantIdHint) ||
    (metadataMerchantId && ownership.merchantId !== metadataMerchantId)
  ) {
    throw new StripeWebhookProcessingError("ownership_mismatch")
  }
}

function productEventsForAppliedSubscription({
  event,
  merchantId,
  subscription,
  entitlementStatus,
}: {
  event: Stripe.Event
  merchantId: string
  subscription: Stripe.Subscription
  entitlementStatus: ReturnType<typeof mapStripeSubscriptionStatus>
}): ProductEventInput[] {
  if (event.type === "checkout.session.completed") {
    return [
      {
        eventName: "subscription_started",
        merchantId,
        actorType: "system",
        metadata: {
          stripe_subscription_id: subscription.id,
          billing_status: entitlementStatus,
        },
      },
    ]
  }

  if (
    (event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted") &&
    entitlementStatus === "cancelled"
  ) {
    return [
      {
        eventName: "subscription_cancelled",
        merchantId,
        actorType: "system",
        metadata: { stripe_subscription_id: subscription.id },
      },
    ]
  }

  return []
}

function safeWebhookErrorCode(value: string) {
  return /^[a-z0-9_:-]{1,64}$/.test(value) ? value : "processing_failed"
}

function firstRpcRow(value: unknown): Record<string, unknown> {
  const row = Array.isArray(value) ? value[0] : value

  if (!row || typeof row !== "object") {
    throw new Error("Stripe webhook claim returned no result")
  }

  return row as Record<string, unknown>
}

function integerField(row: Record<string, unknown>, field: string) {
  const value = row[field]

  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new Error("Stripe webhook claim returned an invalid attempt count")
  }

  return value as number
}
