import "server-only"

import { emailPromptOpening } from "@/lib/customer/email-prompt-opening"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { getCustomerProfileCompletion } from "@/lib/customer/profile"
import { getPendingEmailVerification } from "@/lib/customer/session"

import type { ProfileGate } from "./types"

const COMPLETE: ProfileGate = {
  complete: true,
  dateOfBirthVerified: true,
  needsEmailVerification: false,
  fullName: null,
  dateOfBirth: null,
  email: null,
  emailLocked: false,
}

/**
 * Resolves the redeem-time profile gate for the signed-in customer. A ready
 * reward is only reachable by an authenticated customer, so the null fallback is
 * a can't-happen guard that leaves redemption to the server/RPC enforcement.
 */
export async function loadProfileGate(): Promise<ProfileGate> {
  const completion = await getCustomerProfileCompletion()
  if (!completion) return COMPLETE

  return {
    complete: completion.complete,
    dateOfBirthVerified: completion.dateOfBirthVerified,
    needsEmailVerification: completion.needsEmailVerification,
    emailCodePending: completion.needsEmailVerification
      ? await emailCodePending()
      : false,
    needsPhoneVerification: completion.needsPhoneVerification,
    fullName: completion.fullName,
    dateOfBirth: completion.dateOfBirth,
    email: completion.email,
    emailLocked: completion.emailLocked,
  }
}

/**
 * A code for the saved address is pending for this customer: the rule the
 * home prompt and the profile use (QA BUG-036).
 */
async function emailCodePending(): Promise<boolean> {
  const [customer, pending] = await Promise.all([
    getCurrentCustomer(),
    getPendingEmailVerification(),
  ])
  return Boolean(
    customer && pending && emailPromptOpening(customer, pending).codePending
  )
}
