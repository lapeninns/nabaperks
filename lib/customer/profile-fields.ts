/**
 * Validation for the customer profile fields (Name, Date of birth, optional
 * Email). Shared by the redeem-time gate and the /home profile editor so the two
 * surfaces enforce exactly the same rules. Pure — no I/O, framework-free.
 */

import { formatLondonIso } from "@/lib/customer/uk-calendar"

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

export function validateDateOfBirth(
  raw: string,
  now: Date = new Date()
): string | null {
  if (!raw) return "Enter your date of birth."
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "Enter a valid date of birth."

  const today = formatLondonIso(now)
  const date = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return "Enter a valid date of birth."
  if (date.toISOString().slice(0, 10) !== raw) {
    return "Enter a valid date of birth."
  }
  if (raw > today) return "Date of birth can't be in the future."
  if (Number(raw.slice(0, 4)) < 1900) return "Enter a valid date of birth."

  if (raw > latestAdultBirthDate(now)) {
    return `You must be ${MINIMUM_AGE_YEARS} or over.`
  }

  return null
}

/**
 * The latest date of birth that still counts as an adult today, as `YYYY-MM-DD`
 * — i.e. exactly {@link MINIMUM_AGE_YEARS} years ago. Used as the `max` on the
 * DOB date input so the native picker won't offer under-age dates. Kept in step
 * with the age rule in {@link validateDateOfBirth}.
 */
export function latestAdultBirthDate(now: Date = new Date()): string {
  const today = formatLondonIso(now)
  const [year, month, day] = today.split("-").map(Number)
  const cutoff = new Date(Date.UTC(year - MINIMUM_AGE_YEARS, month - 1, day))

  return cutoff.toISOString().slice(0, 10)
}

export function isEmailAddress(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
}
