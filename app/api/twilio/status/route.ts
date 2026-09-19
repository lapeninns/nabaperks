import {
  parseTwilioStatus,
  readTwilioWebhook,
} from "@/lib/notifications/twilio-signature-core"
import { logger } from "@/lib/observability/logger"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "cache-control": "no-store, max-age=0" }

export async function POST(request: Request) {
  const verified = await readTwilioWebhook(request, {
    authToken: process.env.TWILIO_AUTH_TOKEN?.trim() ?? "",
    appUrl: process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "",
    path: "/api/twilio/status",
  })
  if ("error" in verified)
    return Response.json(
      { error: verified.error },
      { status: verified.status, headers: NO_STORE }
    )
  const parsed = parseTwilioStatus(verified.params)
  const deliveryId = new URL(request.url).searchParams.get("delivery_id")
  if (
    !parsed ||
    !deliveryId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      deliveryId
    )
  )
    return Response.json(
      { error: "invalid_payload" },
      { status: 400, headers: NO_STORE }
    )
  const { data, error } = await createSupabaseServiceRoleClient().rpc(
    "apply_twilio_message_status",
    {
      p_delivery_id: deliveryId,
      p_provider_message_sid: parsed.providerMessageSid,
      p_provider_status: parsed.providerStatus,
      p_provider_error_code: parsed.providerErrorCode,
    }
  )
  if (error || data !== true) {
    logger.warn("twilio_status_apply_failed", { reason: "database_rejected" })
    return Response.json(
      { error: "apply_deferred" },
      { status: 503, headers: NO_STORE }
    )
  }
  return Response.json({ ok: true }, { headers: NO_STORE })
}
