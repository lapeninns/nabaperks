"use server"

import { revalidatePath } from "next/cache"

import { getCurrentMerchant } from "@/lib/auth/session"
import { rotateVenueCode } from "@/lib/merchant/venue-code"
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"

const VENUE_CODE_RESET_LIMIT = 5
const VENUE_CODE_RESET_WINDOW_MS = 15 * 60 * 1000

export type VenueCodeResetActionState = {
  errors?: { form?: string }
  reset?: boolean
}

/**
 * Resets the venue's daily code. A server action is its own HTTP entry point,
 * so it re-proves the owner session here rather than trusting the page that
 * rendered the form; the RPC checks ownership again on its side.
 */
export async function resetVenueCodeAction(
  _state: VenueCodeResetActionState,
  formData: FormData
): Promise<VenueCodeResetActionState> {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    return { errors: { form: "Sign in to your venue account first." } }
  }

  if (formData.get("confirmReset") !== "true") {
    return {
      errors: {
        form: "Tick the box to confirm you'll tell the team the new code.",
      },
    }
  }

  try {
    await enforceRateLimit({
      key: `venue-code-reset:${merchant.id}`,
      limit: VENUE_CODE_RESET_LIMIT,
      windowMs: VENUE_CODE_RESET_WINDOW_MS,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        errors: {
          form: "The code was reset recently. Try again in a few minutes.",
        },
      }
    }
    throw error
  }

  const rotated = await rotateVenueCode(merchant.id)
  if (!rotated) {
    return { errors: { form: "Unable to reset the code right now." } }
  }

  revalidatePath("/app")
  return { reset: true }
}
