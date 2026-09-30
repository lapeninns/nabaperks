/**
 * The OTP text-input cap should fail fast in the browser, not after a server
 * round-trip, and must track the configured accepted length instead of a
 * hardcoded 6. The server accepts `^\d{4,8}$` (app/m/[merchantSlug]/join/actions.ts
 * and app/home/actions.ts), and the dev/bypass codes are 4 digits, so the input
 * may hold anywhere from 4 to 8 digits.
 */

/** Lower bound of the server-accepted code length (the 4 in `/^\d{4,8}$/`). */
export const OTP_MIN_DIGITS = 4
/** Upper bound of the server-accepted code length (the 8 in `/^\d{4,8}$/`). */
export const OTP_MAX_DIGITS = 8

export function normalizeOtpInput(value: string): string {
  return value.replace(/\D/g, "")
}

/**
 * The effective `maxLength` for an OTP input. With no configured length the cap
 * is the largest code the server will accept, so a longer Twilio code still
 * fits. A configured length (e.g. a 4-digit dev code) is honoured but clamped
 * into the accepted range; a non-finite value falls back to the maximum.
 */
export function otpFieldMaxLength(configuredLength?: number): number {
  if (configuredLength === undefined || !Number.isFinite(configuredLength)) {
    return OTP_MAX_DIGITS
  }

  const whole = Math.floor(configuredLength)
  if (whole < OTP_MIN_DIGITS) return OTP_MIN_DIGITS
  if (whole > OTP_MAX_DIGITS) return OTP_MAX_DIGITS
  return whole
}

/** A run of digits a code can be written as: "123456", "123 456", "12-34-56". */
const OTP_DIGIT_RUN = /\d(?:[  -]?\d)*/g

/**
 * What the OTP field keeps from its current text, typed or pasted.
 *
 * The field carries no `maxlength` attribute: the browser applies that cap
 * to pasted text before the `input` event, so "Your code is 123456" arrived
 * as "Your cod" and normalised to nothing (QA BUG-050). Instead this takes
 * the first run of digits that is a whole code (4 to 8 digits, grouping
 * spaces or hyphens allowed), so the rest of a pasted message — "It expires
 * in 10 minutes" — is not glued onto it. Text with no such run (a code
 * being typed, or a run longer than any code) keeps all of its digits.
 * Either way the result is capped at `maxDigits`.
 */
export function otpFieldDigits(value: string, maxDigits: number): string {
  for (const run of value.match(OTP_DIGIT_RUN) ?? []) {
    const digits = normalizeOtpInput(run)
    if (digits.length >= OTP_MIN_DIGITS && digits.length <= OTP_MAX_DIGITS) {
      return digits.slice(0, maxDigits)
    }
  }
  return normalizeOtpInput(value).slice(0, maxDigits)
}
