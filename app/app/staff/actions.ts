"use server"

import { revalidatePath } from "next/cache"

import { addStaffMember, setStaffMemberActive } from "@/lib/merchant/staff-members"
import { createStationPairing, revokeStation } from "@/lib/merchant/stations"

export type AddStaffState = {
  errors?: {
    displayName?: string
    pin?: string
  }
  added?: string
}

export type CreateStationState = {
  errors?: {
    stationName?: string
  }
  pairing?: {
    stationName: string
    pairingCode: string
    pairingExpiresAt: string
  }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

export async function addStaffMemberAction(
  _state: AddStaffState,
  formData: FormData
): Promise<AddStaffState> {
  const displayName = value(formData, "displayName")
  const pin = value(formData, "pin")

  if (!displayName) {
    return { errors: { displayName: "Give the staff member a name." } }
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return { errors: { pin: "PIN must be 4 to 6 digits." } }
  }

  const result = await addStaffMember(displayName, pin)

  if (result.status === "invalid") {
    return { errors: { pin: result.reason } }
  }

  revalidatePath("/app/launch")
  return { added: displayName }
}

export async function setStaffActiveAction(formData: FormData) {
  const staffId = value(formData, "staffId")
  const active = value(formData, "active") === "true"

  if (staffId) {
    await setStaffMemberActive(staffId, active)
  }

  revalidatePath("/app/launch")
}

export async function createStationAction(
  _state: CreateStationState,
  formData: FormData
): Promise<CreateStationState> {
  const stationName = value(formData, "stationName")

  if (!stationName) {
    return { errors: { stationName: "Give the station a name." } }
  }

  const result = await createStationPairing(stationName)

  if (result.status === "invalid") {
    return { errors: { stationName: result.reason } }
  }

  revalidatePath("/app/launch")
  return {
    pairing: {
      stationName: result.stationName,
      pairingCode: result.pairingCode,
      pairingExpiresAt: result.pairingExpiresAt,
    },
  }
}

export async function revokeStationAction(formData: FormData) {
  const stationId = value(formData, "stationId")

  if (stationId) {
    await revokeStation(stationId)
  }

  revalidatePath("/app/launch")
}
