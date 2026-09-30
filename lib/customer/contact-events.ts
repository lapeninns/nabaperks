import "server-only"

import { createHash, randomUUID } from "node:crypto"

import { headers } from "next/headers"
import { after } from "next/server"

import { scheduleAfterResponseAnalytics } from "@/lib/analytics/after-response"
import { recordProductEvent } from "@/lib/analytics/events"
import {
  contactEventMetadata,
  type ContactEventMetadata,
  type CustomerContactEventName,
} from "@/lib/customer/contact-event-core"
import {
  normalizeRequestId,
  REQUEST_ID_HEADER,
} from "@/lib/observability/request-id"
import { logger } from "@/lib/observability/logger"
import { CUSTOMER_DEVICE_HEADER } from "@/lib/security/rate-limit-core"

export type CustomerContactEventInput = {
  readonly eventName: CustomerContactEventName
  readonly customerId?: string | null
  readonly merchantId?: string | null
  readonly metadata: ContactEventMetadata
}

const EVENT_ID_DOMAIN = "nabaperks:analytics:contact-event-id:v1"
const ATTEMPT_DOMAIN = "nabaperks:analytics:contact-attempt:v1"

/**
 * A stable UUID for one logical analytics event, so a repeat upserts onto the
 * same `product_events` row and PostHog receives the same `$insert_id`.
 */
export function deterministicContactEventId(parts: readonly string[]): string {
  const hash = createHash("sha256").update(EVENT_ID_DOMAIN)
  for (const part of parts) hash.update("\0").update(part)
  const bytes = hash.digest().subarray(0, 16)
  bytes[6] = (bytes[6] & 0x0f) | 0x50
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytes.toString("hex")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

type RequestKeys = { readonly device: string | null; readonly request: string }

function attemptValue(scope: string, value: string): string {
  return createHash("sha256")
    .update(ATTEMPT_DOMAIN)
    .update("\0")
    .update(scope)
    .update("\0")
    .update(value)
    .digest("hex")
}

/**
 * The browser the event came from, as the proxy's verified device id, and the
 * request it came in. Read before the response so the after-response task
 * never depends on the request scope. Outside a request both fall back to a
 * fresh random value: the event stays separate rather than merging with others.
 */
async function requestKeys(): Promise<RequestKeys> {
  try {
    const requestHeaders = await headers()
    const device = requestHeaders.get(CUSTOMER_DEVICE_HEADER)?.trim() || null
    const request =
      normalizeRequestId(requestHeaders.get(REQUEST_ID_HEADER)) ?? randomUUID()
    return { device, request }
  } catch {
    return { device: null, request: randomUUID() }
  }
}

/**
 * Keys for one contact event (QA BUG-027). An anonymous sign-in event gets a
 * per-browser identity: a digest of the verified device id (or, without one,
 * of the request), which PostHog pseudonymises again with the analytics
 * secret. The contact itself is never an input. Every event gets a
 * deterministic id for its request, so PostHog receives `$insert_id`.
 */
export function contactEventKeys(
  input: CustomerContactEventInput,
  metadata: ContactEventMetadata,
  keys: RequestKeys
): {
  readonly eventId: string
  readonly anonymousIdentity: string | null
} {
  const anonymous = !input.customerId && !input.merchantId
  const browser = keys.device
    ? attemptValue("device", keys.device)
    : attemptValue("request", keys.request)
  return {
    eventId: deterministicContactEventId([
      browser,
      keys.request,
      input.eventName,
      input.customerId ?? "",
      input.merchantId ?? "",
      metadata.method ?? "",
      metadata.surface ?? "",
      metadata.reason ?? "",
    ]),
    anonymousIdentity: anonymous ? browser : null,
  }
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
  const keysRead = requestKeys()
  scheduleAfterResponseAnalytics(after, async () => {
    try {
      const { eventId, anonymousIdentity } = contactEventKeys(
        input,
        metadata,
        await keysRead
      )
      await recordProductEvent({
        eventId,
        eventName: input.eventName,
        customerId: input.customerId ?? null,
        merchantId: input.merchantId ?? null,
        actorType: input.customerId ? "customer" : "system",
        actorId: input.customerId ?? null,
        ...(anonymousIdentity
          ? {
              analyticsIdentity: {
                domain: "funnel" as const,
                value: anonymousIdentity,
              },
            }
          : {}),
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
