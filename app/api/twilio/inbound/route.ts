import { customerPhoneHmac } from "@/lib/customer/phone-pii-core"
import {
  inboundTwiml,
  parseTwilioInbound,
} from "@/lib/notifications/inbound-keyword-core"
import { readTwilioWebhook } from "@/lib/notifications/twilio-signature-core"
import { logger } from "@/lib/observability/logger"
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "cache-control": "no-store, max-age=0" }

export async function POST(request: Request) {
  const verified = await readTwilioWebhook(request, {
    authToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? "",
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "",
    path: "/api/twilio/inbound",
  })
  if ("error" in verified)
    return Response.json(
      { error: verified.error },
      { status: verified.status, headers: NO_STORE }
    )
  const parsed = parseTwilioInbound(verified.params)
  if (!parsed)
    return Response.json(
      { error: "invalid_payload" },
      { status: 400, headers: NO_STORE }
    )
  if (!process.env.CUSTOMER_PHONE_HMAC_SECRET?.trim())
    return Response.json(
      { error: "unconfigured" },
      { status: 503, headers: NO_STORE }
    )
  const phoneHmac = customerPhoneHmac(parsed.sender)
  try {
    await enforceRateLimit({
      key: `twilio-inbound:${phoneHmac}`,
      limit: 60,
      windowMs: 60_000,
    })
  } catch (error) {
    if (error instanceof RateLimitError)
      return Response.json(
        { error: "rate_limited" },
        { status: 429, headers: NO_STORE }
      )
    throw error
  }
  const { error } = await createSupabaseServiceRoleClient().rpc(
    "record_customer_messaging_inbound",
    {
      p_provider_message_sid: parsed.providerMessageSid,
      p_channel: parsed.channel,
      p_phone_hmac: phoneHmac,
      p_keyword: parsed.keyword,
    }
  )
  if (error) {
    logger.warn("twilio_inbound_apply_failed", { reason: "database_rejected" })
    return Response.json(
      { error: "apply_failed" },
      { status: 500, headers: NO_STORE }
    )
  }
  return new Response(inboundTwiml(parsed), {
    headers: { ...NO_STORE, "content-type": "application/xml; charset=utf-8" },
  })
}
