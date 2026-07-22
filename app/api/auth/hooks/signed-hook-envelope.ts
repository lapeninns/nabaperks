import { NextResponse, type NextRequest } from "next/server"

import { verifyStandardWebhook } from "@/lib/notifications/standard-webhook"

/** Error body shape Supabase expects back from an auth hook endpoint. */
export function hookError(httpCode: number, message: string) {
  return NextResponse.json(
    { error: { http_code: httpCode, message } },
    { status: httpCode }
  )
}

export type SignedHookEnvelope =
  | { readonly ok: true; readonly payload: unknown }
  | { readonly ok: false; readonly response: NextResponse }

/**
 * Shared Standard Webhooks envelope for the Supabase auth hooks: verifies the
 * signature over the raw body, then parses the JSON payload, failing closed
 * with the Supabase hook error shape before any provider delivery runs.
 */
export async function openSignedHookEnvelope(
  request: NextRequest,
  secret: string
): Promise<SignedHookEnvelope> {
  const body = await request.text()
  const verified = verifyStandardWebhook({
    secret,
    id: request.headers.get("webhook-id") ?? "",
    timestamp: request.headers.get("webhook-timestamp") ?? "",
    signatureHeader: request.headers.get("webhook-signature") ?? "",
    body,
  })
  if (!verified) {
    return { ok: false, response: hookError(401, "Invalid signature.") }
  }

  let parsedBody: unknown
  try {
    parsedBody = JSON.parse(body)
  } catch (error) {
    if (!(error instanceof SyntaxError)) {
      throw error
    }

    return { ok: false, response: hookError(400, "Malformed payload.") }
  }

  return { ok: true, payload: parsedBody }
}
