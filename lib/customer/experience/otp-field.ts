/**
 * The OTP text-input cap (F20 of the auth-forms friction audit). Over-typing a
 * code should fail fast in the browser, not after a server round-trip — but the
 * cap must track the *configured* accepted length, never a hardcoded 6. The
 * server accepts `^\d{4,8}$` (app/m/[merchantSlug]/join/actions.ts and
 * app/home/actions.ts), and the dev/bypass codes are 4 digits, so the input may
 * hold anywhere from 4 to 8 digits. This pure helper is the single source of the
 * `maxLength` value, kept out of the components so it can be triangulated and
 * counted toward coverage.
 */

/** Lower bound of the server-accepted code length (the 4 in `/^\d{4,8}$/`). */
export const OTP_MIN_DIGITS = 4
/** Upper bound of the server-accepted code length (the 8 in `/^\d{4,8}$/`). */
export const OTP_MAX_DIGITS = 8

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
