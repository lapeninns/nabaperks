/**
 * The quiet wait before a phone code can be sent again, shared by the join,
 * sign-in and add-a-number code steps so they behave like the email ones.
 * It only disables the control for clarity; the server's send admission stays
 * the authority when a request reaches it. Thirty seconds matches the wait
 * before email is offered as the fallback.
 */
export const PHONE_CODE_RESEND_AFTER_SECONDS = 30

export const SEND_NEW_CODE_LABEL = "Send a new code"

/** When a new phone code may be asked for (ISO), from the send time in epoch seconds. */
export function phoneCodeResendAt(
  sentAtSeconds: number | null | undefined
): string | undefined {
  if (typeof sentAtSeconds !== "number" || !Number.isFinite(sentAtSeconds)) {
    return undefined
  }
  return new Date(
    (sentAtSeconds + PHONE_CODE_RESEND_AFTER_SECONDS) * 1_000
  ).toISOString()
}

/** Seconds as a quiet clock: 24 → "0:24". */
export function resendClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
}

type ResendCountdown = {
  readonly active: boolean
  readonly ready: boolean
  readonly remainingSeconds: number
}

/**
 * The wait is running by the client's own clock. Before that clock starts
 * (server render, hydration) the control stays usable, so a resend still
 * posts and the server decides.
 */
export function resendWaiting(countdown: ResendCountdown): boolean {
  return countdown.ready && countdown.active
}

/** "Send a new code in 0:24" while the wait runs, then "Send a new code". */
export function sendNewCodeLabel(countdown: ResendCountdown): string {
  return resendWaiting(countdown)
    ? `${SEND_NEW_CODE_LABEL} in ${resendClock(countdown.remainingSeconds)}`
    : SEND_NEW_CODE_LABEL
}
