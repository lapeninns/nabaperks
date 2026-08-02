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
 * overflow. This deliberately does NOT reuse `readBoundedRequestBody`: that
 * helper wraps its read loop in a blanket `catch { return null }`, which would
 * turn a client abort or a connection reset into a 413. A 413 tells Svix the
 * payload is permanently wrong (it counts toward the auto-disable budget) and
 * tells GoTrue the auth operation failed, when the truth is a transient
 * transport error that should surface as a retryable 500. So a read error
 * propagates here rather than being relabelled.
 *
 * The declared Content-Length is only a fast path: a malformed or duplicated
 * header (`Headers.get()` collapses duplicates to "123, 123") falls through to
 * the streamed counter, which is authoritative. Rejecting on a malformed header
 * would fail a legitimate delivery for no security gain.
 */
export async function readSignedWebhookBody(
  request: Request
): Promise<string | null> {
  const contentLength = request.headers.get("content-length")
  if (
    contentLength !== null &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > MAX_SIGNED_WEBHOOK_BODY_BYTES
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
    if (byteLength > MAX_SIGNED_WEBHOOK_BODY_BYTES) {
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
