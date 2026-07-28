"use server"

import { revalidatePath } from "next/cache"

import {
  adminActionError,
  adminActionSuccess,
  type AdminActionState,
} from "@/lib/admin/action-state"
import { requireAdminAction } from "@/lib/admin/auth"
import { buildExportDownload } from "@/lib/admin/data-export"
import { MARKETING_POLICY_VERSION } from "@/lib/customer/consent"
import { createSupabaseServerClient } from "@/lib/supabase/server"

const UNAFFILIATED_REQUEST_TYPES = new Set([
  "access",
  "export",
  "deletion",
  "rectification",
])

function formValue(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function revalidatePrivacySupport() {
  revalidatePath("/admin/privacy")
  revalidatePath("/admin/audit")
}

export async function recordUnaffiliatedConsentOptOutAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()

  const customerId = formValue(formData, "customerId")
  const channel = formValue(formData, "channel")
  const source = formValue(formData, "source") || "support_request"
  const policyVersion =
    formValue(formData, "policyVersion") || MARKETING_POLICY_VERSION
  const reason = formValue(formData, "reason")

  if (!customerId) {
    return adminActionError("Customer context is required.")
  }
  if (!reason) {
    return adminActionError("Operator reason is required.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc(
    "admin_record_unaffiliated_consent_opt_out",
    {
      p_customer_id: customerId,
      p_channel: channel,
      p_source: source,
      p_policy_version: policyVersion,
      p_reason: reason,
    }
  )

  if (error) {
    return adminActionError(
      "Account-wide consent opt-out failed. Try again or review audit logs."
    )
  }

  revalidatePrivacySupport()
  return adminActionSuccess(
    "Account-wide opt-out recorded. Logged to the audit trail."
  )
}

export async function logUnaffiliatedDataRequestAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()

  const customerId = formValue(formData, "customerId")
  const requestType = formValue(formData, "requestType")
  const channel = formValue(formData, "channel")
  const notes = formValue(formData, "notes")

  if (!customerId) {
    return adminActionError("Customer context is required.")
  }
  if (!UNAFFILIATED_REQUEST_TYPES.has(requestType)) {
    return adminActionError("Request type is invalid.")
  }
  if (!channel) {
    return adminActionError("Support channel is required.")
  }
  if (!notes) {
    return adminActionError("Support notes are required.")
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc(
    "admin_log_unaffiliated_data_request",
    {
      p_customer_id: customerId,
      p_request_type: requestType,
      p_channel: channel,
      p_notes: notes,
    }
  )

  if (error) {
    return adminActionError(
      "Account privacy request failed. Try again or review audit logs."
    )
  }

  revalidatePrivacySupport()

  const download = requestType === "export" ? buildExportDownload(data) : null
  if (download) {
    return adminActionSuccess(
      "Subject-access export ready. Download the customer's data below.",
      download
    )
  }

  return adminActionSuccess(
    requestType === "deletion"
      ? "Customer data erased. Logged to the audit trail."
      : "Account privacy request logged to the audit trail."
  )
}
