"use server"

import type { VenueCodeResetActionState } from "@/app/app/actions"

/** DB-free stand-in so the harness can render the reset form's states. */
export async function noopResetVenueCodeAction(): Promise<VenueCodeResetActionState> {
  return { reset: true }
}
