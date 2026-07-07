/** Mirrors supabase config: minimum_password_length = 8,
 *  password_requirements = "lower_upper_letters_digits_symbols". */
export const PASSWORD_MIN_LENGTH = 8

/** Supabase Auth allowed symbols for password_requirements. */
export const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};':\"|<>?,./`~"

export const PASSWORD_HINT =
  "At least 8 characters, with upper and lower case, a number, and a symbol."

export type PasswordRequirements = {
  readonly minLength: boolean
  readonly hasLowercase: boolean
  readonly hasUppercase: boolean
  readonly hasDigit: boolean
  readonly hasSymbol: boolean
}

const HAS_LOWERCASE = /[a-z]/
const HAS_UPPERCASE = /[A-Z]/
const HAS_DIGIT = /\d/

export function hasPasswordSymbol(password: string) {
  return [...password].some((char) => PASSWORD_SYMBOLS.includes(char))
}

export function passwordRequirements(password: string): PasswordRequirements {
  return {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    hasLowercase: HAS_LOWERCASE.test(password),
    hasUppercase: HAS_UPPERCASE.test(password),
    hasDigit: HAS_DIGIT.test(password),
    hasSymbol: hasPasswordSymbol(password),
  }
}

export function allPasswordRequirementsMet(
  requirements: PasswordRequirements
) {
  return (
    requirements.minLength &&
    requirements.hasLowercase &&
    requirements.hasUppercase &&
    requirements.hasDigit &&
    requirements.hasSymbol
  )
}

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return "Use at least 8 characters."
  }

  const requirements = passwordRequirements(password)
  if (!allPasswordRequirementsMet(requirements)) {
    return "Use upper and lower case, a number, and a symbol."
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
