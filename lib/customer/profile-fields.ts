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

export function validateDateOfBirth(raw: string): string | null {
  if (!raw) return "Enter your date of birth."
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "Enter a valid date of birth."

  const date = new Date(`${raw}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return "Enter a valid date of birth."
  if (date.getTime() > Date.now()) return "Date of birth can't be in the future."
  if (Number(raw.slice(0, 4)) < 1900) return "Enter a valid date of birth."

  return null
}

export function isEmailAddress(raw: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
}
