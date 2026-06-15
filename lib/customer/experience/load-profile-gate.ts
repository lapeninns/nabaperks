import "server-only"

import { getCustomerProfileCompletion } from "@/lib/customer/profile"

import type { ProfileGate } from "./types"

const COMPLETE: ProfileGate = {
  complete: true,
  needsEmailVerification: false,
  fullName: null,
  dateOfBirth: null,
  email: null,
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
    needsEmailVerification: completion.needsEmailVerification,
    fullName: completion.fullName,
    dateOfBirth: completion.dateOfBirth,
    email: completion.email,
  }
}
