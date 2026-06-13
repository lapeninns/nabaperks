"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { capturePostHogEvent } from "@/lib/analytics/events"
import {
  approveStamp,
  endStaffSession,
  lookupCode,
  pairStation,
  parseStationCookie,
  redeemRewardToken,
  serializeStationCookie,
  startStaffSession,
  STATION_COOKIE,
  undoStamp,
  type ApproveStampResult,
  type CodeLookup,
  type RedeemResult,
  type StationCredentials,
  type UndoResult,
} from "@/lib/staff/station"

export type PairStationState = {
  errors?: {
    pairingCode?: string
  }
}

export type StartSessionState = {
  errors?: {
    pin?: string
    form?: string
  }
}

export type CodeEntryState = {
  lookup?: CodeLookup
  errors?: {
    code?: string
  }
}

export type ApproveState = {
  result?: ApproveStampResult
  errors?: {
    form?: string
  }
}

export type RedeemState = {
  result?: RedeemResult
  errors?: {
    form?: string
  }
}

export type UndoState = {
  result?: UndoResult
  errors?: {
    form?: string
  }
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

async function requireStationCredentials(): Promise<StationCredentials> {
  const cookieStore = await cookies()
  const credentials = parseStationCookie(
    cookieStore.get(STATION_COOKIE)?.value
  )

  if (!credentials) redirect("/staff")

  return credentials
}

export async function pairStationAction(
  _state: PairStationState,
  formData: FormData
): Promise<PairStationState> {
  const pairingCode = value(formData, "pairingCode")

  if (!pairingCode) {
    return { errors: { pairingCode: "Enter the pairing code." } }
  }

  const result = await pairStation(pairingCode)

  if (result.status !== "paired") {
    return {
      errors: { pairingCode: "That pairing code was not accepted." },
    }
  }

  const cookieStore = await cookies()
  cookieStore.set(STATION_COOKIE, serializeStationCookie(result.credentials), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  })

  await capturePostHogEvent({
    eventName: "station_paired",
    actorType: "staff",
    metadata: { station_id: result.credentials.stationId },
  })

  redirect("/staff")
}

export async function startStaffSessionAction(
  _state: StartSessionState,
  formData: FormData
): Promise<StartSessionState> {
  const staffUserId = value(formData, "staffUserId")
  const pin = value(formData, "pin")

  if (!staffUserId) {
    return { errors: { form: "Choose who is on the counter." } }
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return { errors: { pin: "Enter your staff PIN." } }
  }

  const credentials = await requireStationCredentials()
  const result = await startStaffSession(credentials, staffUserId, pin)

  if (result.status === "locked") {
    revalidatePath("/staff")
    return {
      errors: { form: "PIN pad locked. It unlocks itself in ten minutes." },
    }
  }

  if (result.status === "rejected") {
    return { errors: { pin: "That PIN was not accepted." } }
  }

  revalidatePath("/staff")
  return {}
}

export async function endStaffSessionAction(formData: FormData) {
  const sessionId = value(formData, "sessionId")

  if (sessionId) {
    const credentials = await requireStationCredentials()
    await endStaffSession(credentials, sessionId)
  }

  revalidatePath("/staff")
  redirect("/staff")
}

export async function lookupCodeAction(
  _state: CodeEntryState,
  formData: FormData
): Promise<CodeEntryState> {
  const code = value(formData, "code")

  if (!code) {
    return { errors: { code: "Enter the customer's code." } }
  }

  const credentials = await requireStationCredentials()
  const lookup = await lookupCode(credentials, code)

  if (lookup.status === "not_found") {
    return { errors: { code: "That code was not recognised." } }
  }

  return { lookup }
}

export async function approveStampAction(
  _state: ApproveState,
  formData: FormData
): Promise<ApproveState> {
  const tokenId = value(formData, "tokenId")
  const sessionId = value(formData, "sessionId")

  if (!tokenId || !sessionId) {
    return { errors: { form: "Look the code up again before approving." } }
  }

  const credentials = await requireStationCredentials()
  const result = await approveStamp(credentials, sessionId, tokenId)

  if (result.status === "approved" && !result.replayed) {
    await capturePostHogEvent({
      eventName: "stamp_issued",
      actorType: "staff",
      metadata: { station_id: credentials.stationId },
    })
  }

  revalidatePath("/staff")
  return { result }
}

export async function redeemRewardAction(
  _state: RedeemState,
  formData: FormData
): Promise<RedeemState> {
  const tokenId = value(formData, "tokenId")
  const sessionId = value(formData, "sessionId")

  if (!tokenId || !sessionId) {
    return { errors: { form: "Look the code up again before redeeming." } }
  }

  const credentials = await requireStationCredentials()
  const result = await redeemRewardToken(credentials, sessionId, tokenId)

  if (result.status === "redeemed" && !result.replayed) {
    await capturePostHogEvent({
      eventName: "reward_redeemed",
      membershipId: result.membershipId,
      actorType: "staff",
      metadata: { station_id: credentials.stationId, reward_id: result.rewardId },
    })
  }

  revalidatePath("/staff")
  return { result }
}

export async function undoStampAction(
  _state: UndoState,
  formData: FormData
): Promise<UndoState> {
  const stampEventId = value(formData, "stampEventId")
  const sessionId = value(formData, "sessionId")

  if (!stampEventId || !sessionId) {
    return { errors: { form: "There is nothing to undo." } }
  }

  const credentials = await requireStationCredentials()
  const result = await undoStamp(credentials, sessionId, stampEventId)

  revalidatePath("/staff")
  return { result }
}
