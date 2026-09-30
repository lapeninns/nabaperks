import type { CustomerEmailAuthMode } from "@/lib/customer/email-auth-mode"

/**
 * The landing's "what happens next" line. `/invite` sits outside the proxy
 * matcher, so the page cannot see a customer session: the same line reaches a
 * signed-in phone wallet, a signed-in email-only wallet and a signed-out guest.
 * A signed-in wallet goes straight to the terms step, and since the claim gate
 * accepts a verified email (#395) a guest may confirm an email instead of a
 * phone while email sign-in is on (QA BUG-021).
 */
export function inviteNextStepCopy(mode: CustomerEmailAuthMode): string {
  return mode === "off"
    ? "If you're not already signed in, you'll verify your phone number, then you're in."
    : "If you're not already signed in, you'll confirm your phone number or email, then you're in."
}
