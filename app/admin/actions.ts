"use server"

import { revalidatePath } from "next/cache"

import { requireAdminAction } from "@/lib/admin/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function requireValue(currentValue: string, message: string) {
  if (!currentValue) {
    throw new Error(message)
  }
}

function assertAdminRpcSuccess(
  error: { message?: string } | null | undefined,
  safeMessage: string
) {
  if (error) {
    throw new Error(safeMessage)
  }
}

export async function adjustStampsAction(formData: FormData) {
  await requireAdminAction()
  const membershipId = value(formData, "membershipId")
  const reason = value(formData, "reason")
  const delta = Number.parseInt(value(formData, "delta"), 10)

  if (!membershipId || Number.isNaN(delta)) {
    throw new Error("Membership and stamp delta are required.")
  }
  requireValue(reason, "Operator reason is required.")

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_adjust_membership_stamps", {
    p_membership_id: membershipId,
    p_delta: delta,
    p_reason: reason,
  })

  assertAdminRpcSuccess(
    error,
    "Stamp adjustment failed. Try again or review audit logs."
  )

  revalidatePath("/admin/customers")
  revalidatePath("/admin/audit")
}

export async function cancelRewardAction(formData: FormData) {
  await requireAdminAction()
  const rewardId = value(formData, "rewardId")
  const reason = value(formData, "reason")

  if (!rewardId) {
    throw new Error("Reward is required.")
  }
  requireValue(reason, "Operator reason is required.")

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_cancel_reward", {
    p_reward_id: rewardId,
    p_reason: reason,
  })

  assertAdminRpcSuccess(
    error,
    "Reward cancellation failed. Try again or review audit logs."
  )

  revalidatePath("/admin/customers")
  revalidatePath("/admin/audit")
}

export async function setQrActiveAction(formData: FormData) {
  await requireAdminAction()
  const qrCodeId = value(formData, "qrCodeId")
  const reason = value(formData, "reason")
  const isActive = value(formData, "isActive") === "true"

  if (!qrCodeId) {
    throw new Error("QR code is required.")
  }
  requireValue(reason, "Operator reason is required.")

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_set_qr_active", {
    p_qr_code_id: qrCodeId,
    p_is_active: isActive,
    p_reason: reason,
  })

  assertAdminRpcSuccess(
    error,
    "QR update failed. Try again or review audit logs."
  )

  revalidatePath("/admin/merchants")
  revalidatePath("/admin/audit")
}

export async function regenerateQrAction(formData: FormData) {
  await requireAdminAction()
  const qrCodeId = value(formData, "qrCodeId")
  const reason = value(formData, "reason")

  if (!qrCodeId) {
    throw new Error("QR code is required.")
  }
  requireValue(reason, "Operator reason is required.")

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_regenerate_qr_code", {
    p_qr_code_id: qrCodeId,
    p_reason: reason,
  })

  assertAdminRpcSuccess(
    error,
    "QR regeneration failed. Try again or review audit logs."
  )

  revalidatePath("/admin/merchants")
  revalidatePath("/admin/audit")
}

export async function recordConsentOptOutAction(formData: FormData) {
  await requireAdminAction()
  const customerId = value(formData, "customerId")
  const merchantId = value(formData, "merchantId")
  const channel = value(formData, "channel")
  const source = value(formData, "source") || "support_request"
  const policyVersion = value(formData, "policyVersion") || "2026-06-06"
  const reason = value(formData, "reason")

  if (!customerId || !merchantId) {
    throw new Error("Customer and merchant context are required.")
  }
  requireValue(reason, "Operator reason is required.")

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_record_consent_opt_out", {
    p_customer_id: customerId,
    p_merchant_id: merchantId,
    p_channel: channel,
    p_source: source,
    p_policy_version: policyVersion,
    p_reason: reason,
  })

  assertAdminRpcSuccess(
    error,
    "Consent opt-out failed. Try again or review audit logs."
  )

  revalidatePath("/admin/privacy")
  revalidatePath("/admin/audit")
}

export async function logDataRequestAction(formData: FormData) {
  await requireAdminAction()
  const customerId = value(formData, "customerId")
  const merchantId = value(formData, "merchantId")
  const requestType = value(formData, "requestType")
  const channel = value(formData, "channel")
  const notes = value(formData, "notes")

  if (!customerId || !merchantId) {
    throw new Error("Customer and merchant context are required.")
  }
  requireValue(requestType, "Request type is required.")
  requireValue(channel, "Support channel is required.")
  requireValue(notes, "Support notes are required.")

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_log_data_request", {
    p_customer_id: customerId,
    p_merchant_id: merchantId,
    p_request_type: requestType,
    p_channel: channel,
    p_notes: notes,
  })

  assertAdminRpcSuccess(
    error,
    "Data request log failed. Try again or review audit logs."
  )

  revalidatePath("/admin/privacy")
  revalidatePath("/admin/audit")
}

export async function logPilotNoteAction(formData: FormData) {
  await requireAdminAction()
  const merchantId = value(formData, "merchantId")
  const noteType = value(formData, "noteType")
  const notes = value(formData, "notes")
  const trainingMinutesValue = value(formData, "trainingMinutes")
  const trainingMinutes = trainingMinutesValue
    ? Number.parseInt(trainingMinutesValue, 10)
    : null

  if (!merchantId) {
    throw new Error("Merchant context is required.")
  }
  requireValue(noteType, "Note type is required.")
  requireValue(notes, "Support notes are required.")

  if (trainingMinutes !== null && Number.isNaN(trainingMinutes)) {
    throw new Error("Training minutes must be a number.")
  }
  if (
    trainingMinutes !== null &&
    (trainingMinutes < 1 || trainingMinutes > 3)
  ) {
    throw new Error("Training minutes must be between 1 and 3.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_log_pilot_note", {
    p_merchant_id: merchantId,
    p_note_type: noteType,
    p_notes: notes,
    p_training_minutes: trainingMinutes,
  })

  assertAdminRpcSuccess(
    error,
    "Pilot note log failed. Try again or review audit logs."
  )

  revalidatePath("/admin/pilot")
  revalidatePath("/admin/audit")
}
