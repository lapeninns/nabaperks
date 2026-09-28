/**
 * Email is a fallback, never a first option (owner decision, 28 September
 * 2026): phone leads on the join page and at /home/login, and a phone code
 * step offers email only once the code has had time to arrive, by text or on
 * WhatsApp.
 *
 * The server works out how long is left from its own send time and its own
 * clock, and the step counts that down from when it appears. The device clock
 * never takes part, so a clock that is wrong cannot offer email early; a slow
 * page only offers it later, and a reload after the wait gets 0 and offers it
 * at once.
 */
export const PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS = 30

/**
 * Whole seconds, 0 to 30, before a phone code sent at `sentAt` (epoch
 * seconds) may offer email, at `nowMs`. Server clock only: `sentAt` is the
 * pending code cookie's issue time.
 */
export function phoneCodeEmailFallbackInSeconds(
  sentAt: number,
  nowMs: number
): number {
  const remaining = Math.ceil(
    sentAt + PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS - nowMs / 1_000
  )
  return clampToDelay(remaining)
}

/**
 * Milliseconds a code step waits, from when it appears, for the server's
 * seconds left. Never longer than the full delay; anything unusable waits the
 * full delay rather than offering email early.
 */
export function phoneCodeEmailFallbackWaitMs(inSeconds: number): number {
  return clampToDelay(inSeconds) * 1_000
}

function clampToDelay(seconds: number): number {
  if (!Number.isFinite(seconds)) return PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS
  return Math.min(Math.max(seconds, 0), PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS)
}
