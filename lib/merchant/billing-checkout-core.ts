import {
  billingCheckoutSuccessHref,
  billingReturnHref,
  resolveBillingReturnBase,
} from "@/lib/merchant/billing-nav"

export type BillingRuntimeEnvironment = "development" | "test" | "production"

export type BillingOriginInput = {
  environment: BillingRuntimeEnvironment
  configuredOrigin: string
  requestOrigin?: string | null
}

function parseHttpOrigin(value: string): URL | null {
  try {
    const url = new URL(value)

    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null
    }

    return url
  } catch {
    return null
  }
}

function isDirectLoopback(url: URL): boolean {
  return (
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]"
  )
}

/**
 * Resolve the app origin used in provider return URLs. Production always uses
 * the configured canonical origin. Development may follow only a direct
 * loopback origin so a local server running on a non-default port returns to
 * itself without trusting arbitrary request headers.
 */
export function resolveBillingAppOrigin({
  environment,
  configuredOrigin,
  requestOrigin,
}: BillingOriginInput): string {
  const canonical = parseHttpOrigin(configuredOrigin)

  if (!canonical) {
    throw new Error("Configured billing app origin must be an HTTP(S) origin")
  }

  if (environment !== "development" || !requestOrigin) {
    return canonical.origin
  }

  const candidate = parseHttpOrigin(requestOrigin)

  return candidate && isDirectLoopback(candidate)
    ? candidate.origin
    : canonical.origin
}

export function buildBillingCheckoutReturnUrls({
  returnBase,
  ...originInput
}: BillingOriginInput & { returnBase: string }): {
  successUrl: string
  cancelUrl: string
} {
  const origin = resolveBillingAppOrigin(originInput)
  const safeReturnBase = resolveBillingReturnBase(returnBase)

  return {
    successUrl: `${origin}${billingCheckoutSuccessHref(safeReturnBase)}`,
    cancelUrl: `${origin}${billingReturnHref(safeReturnBase, {
      checkout: "cancelled",
    })}`,
  }
}

export type CheckoutEligibility =
  | {
      allowed: true
      reason: "absent" | "cancelled" | "incomplete_expired"
      next: "checkout"
    }
  | {
      allowed: false
      reason: "existing_subscription"
      next: "manage"
      status: string
    }

/** Fail closed for every provider state that is not explicitly restartable. */
export function classifyCheckoutEligibility(
  status: string | null | undefined
): CheckoutEligibility {
  if (status == null) {
    return { allowed: true, reason: "absent", next: "checkout" }
  }

  if (status === "cancelled" || status === "canceled") {
    return { allowed: true, reason: "cancelled", next: "checkout" }
  }

  if (status === "incomplete_expired") {
    return { allowed: true, reason: "incomplete_expired", next: "checkout" }
  }

  return {
    allowed: false,
    reason: "existing_subscription",
    next: "manage",
    status,
  }
}

export type ProviderIdReference =
  | string
  | { id?: string | null }
  | null
  | undefined

export type ProviderCheckoutSubscriptionReference =
  | string
  | {
      id?: string | null
      customer?: ProviderIdReference
    }
  | null
  | undefined

export type ProviderCheckoutSession = {
  id: string
  mode?: string | null
  status?: string | null
  payment_status?: string | null
  customer?: ProviderIdReference
  subscription?: ProviderCheckoutSubscriptionReference
  metadata?: Record<string, string | undefined> | null
}

export type CheckoutReturnSessionInput = {
  requestedSessionId: string | null | undefined
  recordedSessionId: string | null | undefined
  expectedMerchantId: string
  expectedCustomerId: string
  session: ProviderCheckoutSession | null | undefined
}

export type CheckoutReturnSessionClassification =
  | { kind: "missing"; reason: "missing_session" }
  | {
      kind: "rejected"
      reason:
        | "foreign_session"
        | "wrong_mode"
        | "incomplete_session"
        | "missing_subscription"
        | "customer_mismatch"
    }
  | {
      kind: "owned_completed"
      sessionId: string
      subscriptionId: string
      customerId: string
    }

export function providerId(value: ProviderIdReference): string | null {
  if (typeof value === "string") return value || null
  return value?.id || null
}

/**
 * Classify a returned Checkout Session against the durable attempt and
 * merchant/customer mapping. Payment status is deliberately not a gate: a
 * completed subscription trial can correctly be `no_payment_required`.
 */
export function classifyCheckoutReturnSession({
  requestedSessionId,
  recordedSessionId,
  expectedMerchantId,
  expectedCustomerId,
  session,
}: CheckoutReturnSessionInput): CheckoutReturnSessionClassification {
  if (!requestedSessionId || !session) {
    return { kind: "missing", reason: "missing_session" }
  }

  if (
    !recordedSessionId ||
    requestedSessionId !== recordedSessionId ||
    session.id !== requestedSessionId ||
    session.metadata?.merchant_id !== expectedMerchantId
  ) {
    return { kind: "rejected", reason: "foreign_session" }
  }

  if (session.mode !== "subscription") {
    return { kind: "rejected", reason: "wrong_mode" }
  }

  if (session.status !== "complete") {
    return { kind: "rejected", reason: "incomplete_session" }
  }

  const subscriptionId = providerId(session.subscription)

  if (!subscriptionId) {
    return { kind: "rejected", reason: "missing_subscription" }
  }

  const customerId = providerId(session.customer)
  const expandedSubscriptionCustomerId =
    typeof session.subscription === "object" && session.subscription
      ? providerId(session.subscription.customer)
      : null

  if (
    !customerId ||
    customerId !== expectedCustomerId ||
    (expandedSubscriptionCustomerId !== null &&
      expandedSubscriptionCustomerId !== expectedCustomerId)
  ) {
    return { kind: "rejected", reason: "customer_mismatch" }
  }

  return {
    kind: "owned_completed",
    sessionId: session.id,
    subscriptionId,
    customerId,
  }
}

export type ProviderSubscription = {
  id: string
  created: number
  status: string
  customer: ProviderIdReference
  items: {
    data: Array<{
      current_period_end?: number | null
      price?: {
        id?: string | null
        recurring?: { interval?: string | null } | null
        unit_amount?: number | null
        currency?: string | null
      } | null
    }>
  }
  current_period_end?: number | null
  cancel_at_period_end: boolean
  cancel_at?: number | null
}

export type AuthoritativeBillingSnapshot = {
  stripe_customer_id: string
  stripe_subscription_id: string
  stripe_subscription_status: string
  stripe_subscription_created_at: string
  stripe_price_id: string
  billing_interval: "month" | "year"
  unit_amount: number
  currency: string
  current_period_end: string
  cancel_at_period_end: boolean
  cancel_at: string | null
}

function requireText(value: string | null | undefined, field: string): string {
  if (!value) throw new Error(`Provider subscription is missing ${field}`)
  return value
}

function unixSecondsToIso(value: number, field: string): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Provider subscription has invalid ${field}`)
  }

  return new Date(value * 1_000).toISOString()
}

/** Map one Stripe-like Subscription object to the complete database snapshot. */
export function mapProviderSubscriptionSnapshot(
  subscription: ProviderSubscription
): AuthoritativeBillingSnapshot {
  const item = subscription.items.data[0]
  const price = item?.price
  const customerId = providerId(subscription.customer)
  const interval = price?.recurring?.interval
  const unitAmount = price?.unit_amount
  const currency = price?.currency?.toLowerCase()
  const periodEnd =
    item?.current_period_end ?? subscription.current_period_end ?? null

  if (!customerId) {
    throw new Error("Provider subscription is missing customer id")
  }

  if (interval !== "month" && interval !== "year") {
    throw new Error("Provider subscription has unsupported billing interval")
  }

  if (!Number.isSafeInteger(unitAmount) || (unitAmount ?? -1) < 0) {
    throw new Error("Provider subscription has invalid unit amount")
  }

  if (!currency || !/^[a-z]{3}$/.test(currency)) {
    throw new Error("Provider subscription has invalid currency")
  }

  if (periodEnd === null) {
    throw new Error("Provider subscription is missing current period end")
  }

  return {
    stripe_customer_id: customerId,
    stripe_subscription_id: requireText(subscription.id, "subscription id"),
    stripe_subscription_status: requireText(subscription.status, "status"),
    stripe_subscription_created_at: unixSecondsToIso(
      subscription.created,
      "created time"
    ),
    stripe_price_id: requireText(price?.id, "price id"),
    billing_interval: interval,
    unit_amount: unitAmount as number,
    currency,
    current_period_end: unixSecondsToIso(periodEnd, "current period end"),
    cancel_at_period_end: subscription.cancel_at_period_end,
    cancel_at:
      subscription.cancel_at == null
        ? null
        : unixSecondsToIso(subscription.cancel_at, "cancel time"),
  }
}
