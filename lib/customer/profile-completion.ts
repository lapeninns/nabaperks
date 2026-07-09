import { validateDateOfBirth } from "@/lib/customer/profile-fields"

export type CustomerProfileCompletion = {
  complete: boolean
  fullName: string | null
  dateOfBirth: string | null
  email: string | null
  emailVerified: boolean
  emailLocked: boolean
  needsEmailVerification: boolean
}

type ProfileFields = {
  fullName: string | null
  dateOfBirth: string | null
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
  const emailVerified = Boolean(email) && Boolean(customer.emailVerifiedAt)
  const emailLocked = emailVerified
  const needsEmailVerification = Boolean(email) && !customer.emailVerifiedAt
  const complete =
    Boolean(fullName) && Boolean(dateOfBirth) && !needsEmailVerification

  return {
    complete,
    fullName,
    dateOfBirth,
    email,
    emailVerified,
    emailLocked,
    needsEmailVerification,
  }
}
