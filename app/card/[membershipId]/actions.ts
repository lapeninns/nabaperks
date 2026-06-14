"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getStampQrContextForMembership } from "@/lib/customer/join"
import {
  issueSelfServiceStamp,
  type GeoCoordinates,
} from "@/lib/customer/stamp"

export type SelfStampActionState = {
  errors?: {
    form?: string
  }
}

export async function selfStampAction(
  _state: SelfStampActionState,
  formData: FormData
): Promise<SelfStampActionState> {
  const membershipId = value(formData, "membershipId")
  const qrId = value(formData, "qrId")

  if (!membershipId || !qrId) {
    return { errors: { form: "Scan the venue code to add your stamp." } }
  }

  const qrContext = await getStampQrContextForMembership(membershipId, qrId)

  if (!qrContext) {
    return { errors: { form: "Scan the venue code to add your stamp." } }
  }

  const result = await issueSelfServiceStamp(membershipId, coordinates(formData))

  if (result.status === "blocked") {
    return { errors: { form: result.reason } }
  }

  revalidatePath(`/card/${membershipId}`)
  redirect(
    `/card/${membershipId}?stamp=issued${result.geoFlagged ? "&geo=flagged" : ""}`
  )
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
