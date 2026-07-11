import "server-only"

import { getCustomerProfileCompletion } from "@/lib/customer/profile"
import { hasRewardEmailAssurance } from "@/lib/customer/reward-email-assurance"

import type { ProfileGate } from "./types"

const COMPLETE: ProfileGate = {
  complete: true,
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
export async function loadProfileGate(rewardId: string): Promise<ProfileGate> {
  const completion = await getCustomerProfileCompletion()
  if (!completion) return COMPLETE
  const assured = completion.complete
    ? await hasRewardEmailAssurance(rewardId)
    : false

  return {
    complete: completion.complete && assured,
    needsEmailVerification:
      completion.needsEmailVerification || (completion.complete && !assured),
    fullName: completion.fullName,
    dateOfBirth: completion.dateOfBirth,
    email: completion.email,
    emailLocked: completion.emailLocked,
  }
}
