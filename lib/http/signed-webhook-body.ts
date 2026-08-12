import {
  DEFAULT_REQUEST_BODY_TIMEOUT_MS,
  readBoundedBody,
} from "@/lib/http/bounded-body-reader"

export {
  RequestBodyTimeoutError,
  RequestBodyTransportError,
} from "@/lib/http/bounded-body-reader"

/**
 * Static ceiling on pre-authentication body buffering for signed webhooks.
 *
 * The Supabase auth hooks and the Resend delivery webhook materialise the whole
 * request body BEFORE the HMAC is checked, so an unauthenticated caller decides
 * how much memory is allocated and how much data is hashed. Real payloads are a
 * few kilobytes; 1 MiB matches MAX_STRIPE_WEBHOOK_BODY_BYTES.
 */
export const MAX_SIGNED_WEBHOOK_BODY_BYTES = 1_048_576

/**
 * Read a signed webhook's raw body under a static ceiling, before verification.
 *
 * Returns the exact UTF-8 text (byte-identical to `request.text()`, so the HMAC
 * still matches), or `null` for a genuine overflow — and only for a genuine
 * overflow. The shared bounded reader converts a client abort or connection
 * reset into a typed transport error instead of a 413. A 413 tells Svix the
 * payload is permanently wrong (it counts toward the auto-disable budget) and
 * tells GoTrue the auth operation failed, when the truth is a transient error
 * that should surface as a retryable 500.
 *
 * The declared Content-Length is only a fast path: a malformed or duplicated
 * header (`Headers.get()` collapses duplicates to "123, 123") falls through to
 * the streamed counter, which is authoritative. Rejecting on a malformed header
 * would fail a legitimate delivery for no security gain.
 */
export async function readSignedWebhookBody(
  request: Request,
  timeoutMs = DEFAULT_REQUEST_BODY_TIMEOUT_MS
): Promise<string | null> {
  const contentLength = request.headers.get("content-length")
  if (
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > MAX_SIGNED_WEBHOOK_BODY_BYTES
  ) {
    return null
  }

  const body = await readBoundedBody(
    request,
    MAX_SIGNED_WEBHOOK_BODY_BYTES,
    timeoutMs
  )
  if (body === null) return null

  return new TextDecoder().decode(body)
}
