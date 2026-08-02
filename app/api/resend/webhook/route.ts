import { NextResponse, type NextRequest } from "next/server"

import { readSignedWebhookBody } from "@/lib/http/signed-webhook-body"
import { parseResendDeliveryEvent } from "@/lib/loyalty-invites/webhook-core"
import { verifyStandardWebhook } from "@/lib/notifications/standard-webhook"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Signed, replay-safe Resend delivery webhook for bulk loyalty invitations.
 *
 * Resend signs with the Standard Webhooks (Svix) scheme, so verification reuses
 * verifyStandardWebhook (HMAC over `${id}.${timestamp}.${body}`, 5-minute replay
 * window). Delivered/bounced/complained/failed events are applied idempotently
 * to the recipient by provider message id; bounces and complaints also suppress
 * the address globally. It fails closed when RESEND_WEBHOOK_SECRET is unset.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "cache-control": "no-store, max-age=0" }

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!secret) {
    logger.warn("loyalty_invite_webhook_unconfigured", {})
    return NextResponse.json(
      { error: "unconfigured" },
      { status: 503, headers: NO_STORE }
    )
  }

  // Bounded BEFORE the HMAC: an unauthenticated caller must not choose how much
  // we allocate or how much we hash.
  const body = await readSignedWebhookBody(request)
  if (body === null) {
    return NextResponse.json(
      { error: "payload_too_large" },
      { status: 413, headers: NO_STORE }
    )
  }

  // Resend signs with Svix and sends `svix-*` headers; accept the Standard
  // Webhooks `webhook-*` aliases too for forward-compatibility.
  const header = (svix: string, standard: string) =>
    request.headers.get(svix) ?? request.headers.get(standard) ?? ""
  const verified = verifyStandardWebhook({
    secret,
    id: header("svix-id", "webhook-id"),
    timestamp: header("svix-timestamp", "webhook-timestamp"),
    body,
    signatureHeader: header("svix-signature", "webhook-signature"),
  })
  if (!verified) {
    return NextResponse.json(
      { error: "invalid_signature" },
      { status: 401, headers: NO_STORE }
    )
  }

  let payload: unknown
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json(
      { error: "invalid_payload" },
      { status: 400, headers: NO_STORE }
    )
  }

  const parsed = parseResendDeliveryEvent(payload)
  if (!parsed) {
    // Acknowledge unhandled event types (sent/opened/clicked/delivery_delayed).
    return NextResponse.json({ ok: true, ignored: true }, { headers: NO_STORE })
  }

  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("apply_loyalty_invite_delivery_event", {
    p_provider_message_id: parsed.providerMessageId,
    p_event: parsed.event,
  })
  if (error) {
    logger.warn("loyalty_invite_webhook_apply_failed", {
      reason: "database_rejected",
    })
    return NextResponse.json(
      { error: "apply_failed" },
      { status: 500, headers: NO_STORE }
    )
  }

  return NextResponse.json({ ok: true }, { headers: NO_STORE })
}
