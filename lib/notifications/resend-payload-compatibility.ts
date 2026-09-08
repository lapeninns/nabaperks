import type { buildTransactionalEmailPayload } from "./transactional-email-payload"

type EmailPayload = ReturnType<typeof buildTransactionalEmailPayload>

/** Replay the pre-metadata payload only after a confirmed key mismatch. */
export async function sendWithPayloadCompatibility({
  payload,
  legacySender,
  idempotencyKey,
  send,
  beforeLegacyAttempt,
}: {
  payload: EmailPayload
  legacySender: string
  idempotencyKey?: string
  send: (payload: EmailPayload) => Promise<Response>
  beforeLegacyAttempt?: () => Promise<void>
}): Promise<Response> {
  const legacyPayload = { ...payload, from: legacySender }
  delete legacyPayload.reply_to
  delete legacyPayload.headers
  const response = await send(payload)
  if (
    !idempotencyKey ||
    JSON.stringify(payload) === JSON.stringify(legacyPayload) ||
    response.status !== 409
  ) {
    return response
  }
  const error: unknown = await response
    .clone()
    .json()
    .catch(() => null)
  if (
    !error ||
    typeof error !== "object" ||
    !("name" in error) ||
    error.name !== "invalid_idempotent_request"
  ) {
    return response
  }
  // Only a confirmed payload mismatch permits one legacy replay. The caller
  // retains the same key and original content, so an accepted legacy
  // request is deduplicated rather than resent under a newly versioned key.
  await beforeLegacyAttempt?.()
  return send(legacyPayload)
}
