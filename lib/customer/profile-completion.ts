import { validateDateOfBirth } from "@/lib/customer/profile-fields"

export type CustomerProfileCompletion = {
  complete: boolean
  fullName: string | null
  dateOfBirth: string | null
  dateOfBirthVerified: boolean
  email: string | null
  emailVerified: boolean
  emailLocked: boolean
  needsEmailVerification: boolean
}

type ProfileFields = {
  fullName: string | null
  dateOfBirth: string | null
  dateOfBirthVerifiedAt: string | null
  email: string | null
  emailVerifiedAt: string | null
}

export function profileCompletionFrom(
  customer: ProfileFields
): CustomerProfileCompletion {
  const fullName = customer.fullName?.trim() ? customer.fullName.trim() : null
  const dateOfBirth =
    customer.dateOfBirth && validateDateOfBirth(customer.dateOfBirth) === null
      ? customer.dateOfBirth
      : null
  const email = customer.email?.trim() ? customer.email.trim() : null
  const dateOfBirthVerified = Boolean(customer.dateOfBirthVerifiedAt)
  const emailVerified = Boolean(email) && Boolean(customer.emailVerifiedAt)
  const emailLocked = emailVerified
  const needsEmailVerification = Boolean(email) && !customer.emailVerifiedAt
  const complete = Boolean(fullName) && Boolean(dateOfBirth) && emailVerified

  return {
    complete,
    fullName,
    dateOfBirth,
    dateOfBirthVerified,
    email,
    emailVerified,
    emailLocked,
    needsEmailVerification,
  }
}
