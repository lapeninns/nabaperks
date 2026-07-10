import "server-only"

import { randomUUID } from "node:crypto"
import { after } from "next/server"

import { scheduleAfterResponseAnalytics } from "@/lib/analytics/after-response"
import {
  deterministicFunnelEventId,
  issueFunnelToken,
  verifyFunnelToken,
} from "@/lib/analytics/funnel-token"
import { pseudonymizeAnalyticsId } from "@/lib/analytics/privacy-core"
import {
  recordProductEvent,
  type ProductEventName,
} from "@/lib/analytics/events"

type PublicFunnelEventName =
  | "merchant_marketing_viewed"
  | "merchant_signup_clicked"
  | "merchant_signup_started"
  | "merchant_otp_verification_viewed"

type AuthFunnelEventName =
  | "merchant_account_created"
  | "merchant_otp_resent"
  | "merchant_email_verified"

export async function recordAnonymousFunnelEvent({
  event,
  funnelToken,
}: {
  event: PublicFunnelEventName
  funnelToken?: string
}): Promise<{ token: string }> {
  const secret = funnelSigningSecret()
  if (!funnelToken) {
    // Issue identity before persistence. If this response is lost there is no
    // orphan milestone; once stored, every retry uses the same event UUID.
    return { token: issueFunnelToken(randomUUID(), secret, Date.now()) }
  }

  const verified = verifyFunnelToken(funnelToken, secret, Date.now())
  if (!verified) {
    // Never let a supplied expired or tampered identity inflate a milestone.
    // Return a fresh token so a later legitimate event can start cleanly, but
    // deliberately do not persist the rejected request.
    return { token: issueFunnelToken(randomUUID(), secret, Date.now()) }
  }

  const funnelKey = pseudonymizeAnalyticsId("funnel", verified.funnelId, secret)
  await recordProductEvent({
    eventId: deterministicFunnelEventId(funnelToken, event),
    eventName: event,
    actorType: "system",
    analyticsIdentity: { domain: "funnel", value: verified.funnelId },
    metadata: { funnel_key: funnelKey, source: eventSource(event) },
  })

  return { token: funnelToken }
}

export function recordMerchantFunnelEventSafely(input: {
  actorId?: string | null
  event: AuthFunnelEventName
  funnelToken?: string
  occurrenceKey?: string
}): void {
  scheduleAfterResponseAnalytics(after, () => persistMerchantFunnelEvent(input))
}

async function persistMerchantFunnelEvent({
  actorId,
  event,
  funnelToken,
  occurrenceKey,
}: {
  actorId?: string | null
  event: AuthFunnelEventName
  funnelToken?: string
  occurrenceKey?: string
}): Promise<void> {
  try {
    const secret = funnelSigningSecret()
    const identity = funnelToken
      ? verifyFunnelToken(funnelToken, secret, Date.now())
      : null
    const semanticEvent = occurrenceKey ? `${event}:${occurrenceKey}` : event
    const fallbackIdentity = actorId
      ? pseudonymizeAnalyticsId("actor", actorId, secret)
      : randomUUID()
    const eventSeed = identity
      ? funnelToken!
      : `unattributed:${fallbackIdentity}`

    await recordProductEvent({
      eventId: deterministicFunnelEventId(eventSeed, semanticEvent),
      eventName: event,
      actorType: actorId ? "merchant" : "system",
      actorId: actorId ?? null,
      analyticsIdentity: identity
        ? { domain: "funnel", value: identity.funnelId }
        : { domain: actorId ? "actor" : "system", value: fallbackIdentity },
      metadata: {
        ...(identity
          ? {
              funnel_key: pseudonymizeAnalyticsId(
                "funnel",
                identity.funnelId,
                secret
              ),
            }
          : {}),
        source: eventSource(event),
      },
    })
  } catch (error) {
    console.error("Merchant funnel analytics recording failed", {
      event,
      error: error instanceof Error ? error.message : "unknown error",
    })
  }
}

function funnelSigningSecret() {
  const secret = process.env.CUSTOMER_SESSION_SECRET?.trim()
  if (!secret) throw new Error("Customer session signing secret is unavailable")
  return secret
}

function eventSource(event: ProductEventName) {
  switch (event) {
    case "merchant_marketing_viewed":
    case "merchant_signup_clicked":
      return "homepage"
    case "merchant_signup_started":
    case "merchant_account_created":
      return "merchant_signup"
    case "merchant_otp_verification_viewed":
    case "merchant_otp_resent":
    case "merchant_email_verified":
      return "email_verification"
    default:
      return "merchant_activation"
  }
}
