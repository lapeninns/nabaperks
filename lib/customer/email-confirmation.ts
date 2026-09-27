import "server-only"

import type { ContactEventSurface } from "@/lib/customer/contact-event-core"
import { recordCustomerContactEvent } from "@/lib/customer/contact-events"
import { checkCustomerEmailVerification } from "@/lib/customer/email-verification"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  CUSTOMER_EMAIL_CONFLICT_MESSAGE,
  markCustomerEmailVerified,
} from "@/lib/customer/profile"

export type EmailCodeConfirmation =
  | { readonly status: "verified" }
  | { readonly status: "conflict" }
  | { readonly status: "rejected" }
  | { readonly status: "check_failed" }
  | { readonly status: "confirm_failed" }

/**
 * Checks an emailed code for the signed-in customer and, when it matches,
 * confirms the address. Shared by the profile editor, the reward gate and the
 * "add your email" prompts so each shows its own copy for the same outcomes.
 * A `conflict` (another wallet already holds this verified email) changes
 * nothing and is recorded as `customer_contact_conflict`.
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
  if (checked.status !== "approved") return { status: "rejected" }

  let marked: Awaited<ReturnType<typeof markCustomerEmailVerified>>
  try {
    marked = await markCustomerEmailVerified(checked.email)
  } catch {
    return { status: "confirm_failed" }
  }

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

/** The shared guest copy for every outcome except `verified` (which is null). */
export function emailConfirmationErrors(
  confirmation: EmailCodeConfirmation
): EmailConfirmationErrors | null {
  switch (confirmation.status) {
    case "check_failed":
      return { form: "We couldn't check that code. Try again." }
    case "rejected":
      return { otp: "That code didn't match. Check your email and try again." }
    case "confirm_failed":
      return { form: "We couldn't confirm your email. Try again." }
    case "conflict":
      return { form: CUSTOMER_EMAIL_CONFLICT_MESSAGE }
    case "verified":
      return null
  }
}
