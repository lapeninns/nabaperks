/**
 * Email is a fallback, never a first option (owner decision, 28 September
 * 2026): phone leads on the join page and at /home/login, and a phone code
 * step offers email only once the text has had time to arrive.
 *
 * The wait runs from when the server sent the latest code, not from when the
 * screen appeared, so a reload after the wait shows the fallback at once.
 */
export const PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS = 30

/** Epoch seconds when a code sent at `sentAt` may offer email instead. */
export function phoneCodeEmailFallbackAt(sentAt: number): number {
  return sentAt + PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS
}

/**
 * Milliseconds to wait from `nowMs` before offering email, for a fallback
 * available at `availableAt` (epoch seconds, server clock). Never longer than
 * the full delay, so a device clock running behind the server's still offers
 * email within the delay of the step appearing; a clock running ahead only
 * offers it sooner.
 */
export function phoneCodeEmailFallbackWaitMs(
  availableAt: number,
  nowMs: number
): number {
  const remaining = availableAt * 1_000 - nowMs
  const cap = PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS * 1_000
  if (!Number.isFinite(remaining)) return cap
  return Math.min(Math.max(remaining, 0), cap)
}
