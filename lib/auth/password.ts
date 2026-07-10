/** Mirrors supabase config: minimum_password_length = 8,
 *  password_requirements = "letters_digits". */
export const PASSWORD_MIN_LENGTH = 8

export type PasswordRequirements = {
  readonly minLength: boolean
  readonly hasLetter: boolean
  readonly hasDigit: boolean
}

const HAS_LETTER = /[A-Za-z]/
const HAS_DIGIT = /\d/

export function passwordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasLetter: HAS_LETTER.test(password),
    hasDigit: HAS_DIGIT.test(password),
  }
}

export function allPasswordRequirementsMet(requirements: PasswordRequirements) {
  return (
    requirements.minLength && requirements.hasLetter && requirements.hasDigit
  )
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return "Use at least 8 characters."
  }

  const requirements = passwordRequirements(password)
  if (!allPasswordRequirementsMet(requirements)) {
    return "Use at least one letter and one number."
  }

  return null
}

export function validateConfirmPassword(
  password: string,
  confirmPassword: string
): string | null {
  if (password !== confirmPassword) return "Passwords do not match."
  return null
}
