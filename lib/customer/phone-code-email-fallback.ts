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
 *
 * The server enforces the same rule ({@link emailFallbackOpen}): a URL or a
 * form post that asks for email before then gets the phone step instead.
 */
export const PHONE_CODE_EMAIL_FALLBACK_DELAY_SECONDS = 30

/** What the server knows, from this browser's own signed cookies. */
export type EmailFallbackFacts = {
  /**
   * Issue time (epoch seconds) of the pending phone code for this flow, or
   * null when none is pending. A resend re-issues it, so this is the latest.
   */
  readonly phoneCodeSentAt?: number | null
  /**
   * This flow already opened email: the latest phone send failed, the number
   * holds no cards (/home/login), or email was taken once the wait was over.
   */
  readonly opened?: boolean
  /** An email code or verified-email handoff for this flow already exists. */
  readonly emailInProgress?: boolean
}

/**
 * Whether a signed-out join or sign-in may take email instead of phone at
 * `nowMs`: only 30 seconds after the latest phone code was sent, once email
 * has been opened for a failed send or a number with no cards, or while an
 * email sign-in is already under way. The answer depends only on this
 * browser's state, never on an address, so it reveals nothing about one.
 */
export function emailFallbackOpen(
  facts: EmailFallbackFacts,
  nowMs: number
): boolean {
  if (facts.opened === true || facts.emailInProgress === true) return true
  const sentAt = facts.phoneCodeSentAt
  if (typeof sentAt !== "number" || !Number.isFinite(sentAt)) return false
  return phoneCodeEmailFallbackInSeconds(sentAt, nowMs) === 0
}

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
 * What a phone code step needs to time the email fallback for a code sent at
 * `sentAt` (epoch seconds, the pending cookie's issue time): the seconds left
 * and the send time itself, which restarts the wait when a resend changes it.
 */
export function phoneCodeStepTiming(
  sentAt: number,
  nowMs: number
): { phoneCodeSentAt: number; emailFallbackInSeconds: number } {
  return {
    phoneCodeSentAt: sentAt,
    emailFallbackInSeconds: phoneCodeEmailFallbackInSeconds(sentAt, nowMs),
  }
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
