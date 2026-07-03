/**
 * Validation for the customer profile fields (Name, Date of birth, optional
 * Email). Shared by the redeem-time gate and the /home profile editor so the two
 * surfaces enforce exactly the same rules. Pure — no I/O, framework-free.
 */

export type ProfileFieldValues = {
  fullName: string
  dateOfBirth: string
  email: string
}

export type ProfileFieldErrors = {
  fullName?: string
  dateOfBirth?: string
  email?: string
}

export function validateProfileFields(
  values: ProfileFieldValues
): ProfileFieldErrors {
  const errors: ProfileFieldErrors = {}

  if (!values.fullName) errors.fullName = "Enter your name."

  const dobError = validateDateOfBirth(values.dateOfBirth)
  if (dobError) errors.dateOfBirth = dobError

  if (values.email && !isEmailAddress(values.email)) {
    errors.email = "Enter a valid email address."
  }

  return errors
}

/** Minimum age (years) required to hold a profile and redeem rewards. */
export const MINIMUM_AGE_YEARS = 18

export function validateDateOfBirth(raw: string): string | null {
  if (!raw) return "Enter your date of birth."
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "Enter a valid date of birth."

  const date = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return "Enter a valid date of birth."
  if (date.getTime() > Date.now()) return "Date of birth can't be in the future."
  if (Number(raw.slice(0, 4)) < 1900) return "Enter a valid date of birth."

  // Age gate: the customer must be at least MINIMUM_AGE_YEARS old. Compare the
  // Nth birthday (UTC midnight) to now — if it is still in the future they are
  // under age. On the birthday itself the instant is <= now, so they pass.
  const nthBirthday = Date.UTC(
    date.getUTCFullYear() + MINIMUM_AGE_YEARS,
    date.getUTCMonth(),
    date.getUTCDate()
  )
  if (nthBirthday > Date.now()) return `You must be ${MINIMUM_AGE_YEARS} or over.`

  return null
}

/**
 * The latest date of birth that still counts as an adult today, as `YYYY-MM-DD`
 * — i.e. exactly {@link MINIMUM_AGE_YEARS} years ago. Used as the `max` on the
 * DOB date input so the native picker won't offer under-age dates. Kept in step
 * with the age rule in {@link validateDateOfBirth}.
 */
export function latestAdultBirthDate(now: Date = new Date()): string {
  const cutoff = new Date(
    Date.UTC(
      now.getUTCFullYear() - MINIMUM_AGE_YEARS,
      now.getUTCMonth(),
      now.getUTCDate()
    )
  )
  return cutoff.toISOString().slice(0, 10)
}

export function isEmailAddress(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
}
