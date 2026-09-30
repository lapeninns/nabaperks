import { normalizeEmail } from "@/lib/customer/email-pii-core"

/**
 * Where an "add your email" prompt opens, shared by the home dashboard and the
 * card after a stamp so both treat a pending code the same way. Pure: the
 * callers read the session customer and the pending-code cookie.
 */
export type EmailPromptOpening = {
  /** The unverified email already on the profile, to prefill; null if none. */
  readonly initialEmail: string | null
  /** A code for `initialEmail` is on its way to this customer. */
  readonly codePending: boolean
}

/**
 * Opens at the code step only when the pending code was issued to this
 * customer for the address still saved on the profile; otherwise the prompt
 * opens at the email step with that address prefilled.
 */
export function emailPromptOpening(
  customer: { readonly id: string; readonly email: string | null },
  pending: { readonly customerId: string | null; readonly email: string } | null
): EmailPromptOpening {
  const initialEmail = customer.email?.trim() || null
  const codePending = Boolean(
    pending &&
    initialEmail &&
    pending.customerId === customer.id &&
    normalizeEmail(pending.email) === normalizeEmail(initialEmail)
  )
  return { initialEmail, codePending }
}
