/** Preserve a previously accepted delivery's key when its sender changes. */
export async function sendWithSenderCompatibility({
  sender,
  legacySender,
  idempotencyKey,
  send,
  beforeLegacyAttempt,
}: {
  sender: string
  legacySender: string
  idempotencyKey?: string
  send: (sender: string) => Promise<Response>
  beforeLegacyAttempt?: () => Promise<void>
}): Promise<Response> {
  const response = await send(sender)
  if (!idempotencyKey || sender === legacySender || response.status !== 409) {
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
  // retains the same key and every other payload field, so an accepted legacy
  // request is deduplicated rather than resent under a newly versioned key.
  await beforeLegacyAttempt?.()
  return send(legacySender)
}
