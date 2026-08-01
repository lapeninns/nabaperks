"use server"

import { revalidatePath } from "next/cache"

import {
  adminActionError,
  adminActionSuccess,
  type AdminActionState,
} from "@/lib/admin/action-state"
import { requireAdminAction } from "@/lib/admin/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

function value(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function optionalDate(
  formData: FormData,
  key: string
): { ok: true; value: string | null } | { ok: false } {
  const raw = value(formData, key)
  if (!raw) return { ok: true, value: null }
  const date = new Date(raw)
  return Number.isFinite(date.getTime())
    ? { ok: true, value: date.toISOString() }
    : { ok: false }
}

function revalidateBillingAdmin(): void {
  revalidatePath("/admin/billing")
  revalidatePath("/admin/audit")
  revalidatePath("/app/account")
}

export async function markLaunchDispatchedAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const merchantId = value(formData, "merchantId")
  const dispatchedAt = optionalDate(formData, "dispatchedAt")
  if (!merchantId || !dispatchedAt.ok) {
    return adminActionError("Merchant and a valid dispatch time are required.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc(
    "admin_mark_merchant_launch_dispatched",
    {
      p_merchant_id: merchantId,
      p_dispatched_at: dispatchedAt.value,
    }
  )
  if (error) {
    return adminActionError(
      "Dispatch could not be recorded. Review the current status and retry."
    )
  }
  revalidateBillingAdmin()
  return adminActionSuccess("Poster dispatch recorded in the audit trail.")
}

export async function confirmLaunchDeliveredAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const merchantId = value(formData, "merchantId")
  const deliveredAt = optionalDate(formData, "deliveredAt")
  if (!merchantId || !deliveredAt.ok) {
    return adminActionError("Merchant and a valid delivery time are required.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc(
    "admin_confirm_merchant_launch_delivered",
    {
      p_merchant_id: merchantId,
      p_delivered_at: deliveredAt.value,
    }
  )
  if (error) {
    return adminActionError(
      "Delivery could not be confirmed. Review the dispatch evidence and retry."
    )
  }
  revalidateBillingAdmin()
  return adminActionSuccess(
    "Delivery confirmed. The 28-day platform pilot has started."
  )
}

export async function extendLaunchPilotAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const merchantId = value(formData, "merchantId")
  const extensionEnd = optionalDate(formData, "extensionEnd")
  if (!merchantId || !extensionEnd.ok || !extensionEnd.value) {
    return adminActionError("Merchant and a valid extension end are required.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc(
    "admin_set_merchant_launch_pilot_extension",
    {
      p_merchant_id: merchantId,
      p_extension_end: extensionEnd.value,
    }
  )
  if (error) {
    return adminActionError(
      "The extension could not be saved. It must be later than the current pilot end."
    )
  }
  revalidateBillingAdmin()
  return adminActionSuccess(
    "Pilot extension saved and queued for Stripe synchronisation."
  )
}
