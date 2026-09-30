import "server-only"

import type { ContactEventSurface } from "@/lib/customer/contact-event-core"
import { recordCustomerContactEvent } from "@/lib/customer/contact-events"
import { emailSignInEnabled } from "@/lib/customer/email-auth-mode"
import { checkCustomerEmailVerification } from "@/lib/customer/email-verification"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  CustomerContactLockedError,
  markCustomerEmailVerified,
} from "@/lib/customer/profile"

export type EmailCodeConfirmation =
  | { readonly status: "verified" }
  | { readonly status: "conflict" }
  | { readonly status: "rejected" }
  | { readonly status: "expired" }
  | { readonly status: "already_verified" }
  | { readonly status: "check_failed" }
  | { readonly status: "confirm_failed" }

/**
 * Checks an emailed code for the signed-in customer and, when it matches,
 * confirms the address. Shared by the profile editor, the reward gate and the
 * "add your email" prompts so each shows its own copy for the same outcomes.
 * A `conflict` (another wallet already holds this verified email) confirms
 * nothing, releases the refused address from this profile when it keeps a
 * phone (so a reload does not prefill it), and is recorded as
 * `customer_contact_conflict`.
 */
export async function confirmCustomerEmailCode(
  code: string,
  surface: ContactEventSurface
): Promise<EmailCodeConfirmation> {
  let checked: Awaited<ReturnType<typeof checkCustomerEmailVerification>>
  try {
    checked = await checkCustomerEmailVerification(code)
  } catch {
    return { status: "check_failed" }
  }
  if (checked.status === "expired") return { status: "expired" }
  if (checked.status !== "approved") return { status: "rejected" }

  let marked: Awaited<ReturnType<typeof markCustomerEmailVerified>>
  try {
    marked = await markCustomerEmailVerified(checked.email, surface)
  } catch (error) {
    // Another code already confirmed a different address for this wallet,
    // and a verified email is locked (QA BUG-032).
    return error instanceof CustomerContactLockedError
      ? { status: "already_verified" }
      : { status: "confirm_failed" }
  }
  // The profile no longer holds this address unverified (QA BUG-032).
  if (marked.status === "expired") return marked

  const customer = await getCurrentCustomer()
  recordCustomerContactEvent({
    eventName:
      marked.status === "conflict"
        ? "customer_contact_conflict"
        : "customer_email_verified",
    customerId: customer?.id ?? null,
    metadata:
      marked.status === "conflict"
        ? { method: "email", surface, reason: "email_in_use" }
        : { method: "email", surface },
  })
  return marked
}

export type EmailConfirmationErrors = {
  readonly otp?: string
  readonly form?: string
}

/**
 * Copy shown wherever a verified email turns out to belong to another wallet.
 * It points to email sign-in only while email can open a wallet
 * (`CUSTOMER_EMAIL_AUTH_MODE` `existing` or `full`); otherwise it promises
 * nothing that is not live.
 */
export function customerEmailConflictMessage(
  env: Record<string, string | undefined> = process.env
): string {
  return emailSignInEnabled(env)
    ? "This email is already used by another Nabaperks wallet. Sign in with that email, or ask the venue for help."
    : "This email is already used by another Nabaperks wallet. Use a different email, or ask the venue for help."
}

/** The shared guest copy for every outcome except `verified` (which is null). */
export function emailConfirmationErrors(
  confirmation: EmailCodeConfirmation,
  env: Record<string, string | undefined> = process.env
): EmailConfirmationErrors | null {
  switch (confirmation.status) {
    case "check_failed":
      return { form: "We couldn't check that code. Try again." }
    case "rejected":
      return { otp: "That code didn't match. Check your email and try again." }
    case "expired":
      return { otp: "That code has expired. Email me a new code." }
    case "already_verified":
      return { form: "Your email is already confirmed." }
    case "confirm_failed":
      return { form: "We couldn't confirm your email. Try again." }
    case "conflict":
      return { form: customerEmailConflictMessage(env) }
    case "verified":
      return null
  }
}
