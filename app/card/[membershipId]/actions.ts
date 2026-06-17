"use server"

import { revalidatePath } from "next/cache"

import { blockReasonCopy } from "@/lib/customer/experience/block-reasons"
import { getStampQrContextForMembership } from "@/lib/customer/join"
import {
  issueSelfServiceStamp,
  type GeoCoordinates,
} from "@/lib/customer/stamp"
import { logger } from "@/lib/observability/logger"

/**
 * The stamp result handed back to the client so the stamp can land *in place*
 * with the slam animation, instead of a full-page redirect that wastes it. The
 * card route is still revalidated so a later visit reflects the new stamp.
 */
export type SelfStampActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "issued"
      newStampCount: number
      rewardUnlocked: boolean
      geoFlagged: boolean
    }

export const initialSelfStampState: SelfStampActionState = { status: "idle" }

function fail(message: string): SelfStampActionState {
  return { status: "error", message }
}

export async function selfStampAction(
  _state: SelfStampActionState,
  formData: FormData
): Promise<SelfStampActionState> {
  const membershipId = value(formData, "membershipId")
  const qrId = value(formData, "qrId")

  if (!membershipId || !qrId) {
    return fail("Scan the venue code to add your stamp.")
  }

  const qrContext = await getStampQrContextForMembership(membershipId, qrId)

  if (!qrContext) {
    return fail("Scan the venue code to add your stamp.")
  }

  let result: Awaited<ReturnType<typeof issueSelfServiceStamp>>
  try {
    result = await issueSelfServiceStamp(membershipId, coordinates(formData))
  } catch (error) {
    // Known RPC blocks already return a calm `blocked` result; only a genuinely
    // unexpected failure reaches here. Keep it inline instead of throwing the
    // customer to a full-page "card unavailable" boundary on a healthy card.
    logger.error("self_service_stamp_unexpected_error", {
      membershipId,
      error,
    })
    return fail(blockReasonCopy("unknown"))
  }

  if (result.status === "blocked") {
    return fail(result.reason)
  }

  // Mark the card route stale so navigating away/back reflects the new stamp.
  // The customer stays on this screen; the UI confirms the stamp in place.
  revalidatePath(`/card/${membershipId}`)

  return {
    status: "issued",
    newStampCount: result.newStampCount,
    rewardUnlocked: result.rewardUnlocked,
    geoFlagged: result.geoFlagged,
  }
}

function coordinates(formData: FormData): GeoCoordinates | undefined {
  const latitude = numberValue(formData, "latitude")
  const longitude = numberValue(formData, "longitude")

  if (latitude === null || longitude === null) return undefined

  return { latitude, longitude }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  if (typeof raw !== "string") return ""

  return raw.trim()
}

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key)
  if (!raw) return null

  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}
