"use server"

import { revalidatePath } from "next/cache"

import { requireAdminAction } from "@/lib/admin/auth"
import {
  adminActionError,
  adminActionSuccess,
  type AdminActionState,
} from "@/lib/admin/action-state"
import { qrImageContextCacheTag, revalidateCacheTag } from "@/lib/cache/tags"
import { buildExportDownload } from "@/lib/admin/data-export"
import { MARKETING_POLICY_VERSION } from "@/lib/customer/consent"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Admin console actions return structured `AdminActionState` instead of
 * throwing on validation or RPC failure (platform ux production polish):
 * `AdminActionForm` renders the outcome inline next to the submit button, and
 * the segment error boundary stays reserved for render/read failures.
 * Auth failures still hard-fail via `requireAdminAction` — that gate is
 * deliberate defence in depth and unchanged.
 */

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function rpcFailure(
  error: { message?: string } | null | undefined,
  safeMessage: string
): AdminActionState | null {
  return error ? adminActionError(safeMessage) : null
}

export async function adjustStampsAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const membershipId = value(formData, "membershipId")
  const reason = value(formData, "reason")
  const delta = Number.parseInt(value(formData, "delta"), 10)

  if (!membershipId || Number.isNaN(delta)) {
    return adminActionError("Membership and stamp delta are required.")
  }
  if (!reason) {
    return adminActionError("Operator reason is required.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_adjust_membership_stamps", {
    p_membership_id: membershipId,
    p_delta: delta,
    p_reason: reason,
  })

  const failure = rpcFailure(
    error,
    "Stamp adjustment failed. Try again or review audit logs."
  )
  if (failure) return failure

  revalidatePath("/admin/customers")
  revalidatePath("/admin/audit")
  return adminActionSuccess("Stamps adjusted. Logged to the audit trail.")
}

export async function cancelRewardAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const rewardId = value(formData, "rewardId")
  const reason = value(formData, "reason")

  if (!rewardId) {
    return adminActionError("Reward is required.")
  }
  if (!reason) {
    return adminActionError("Operator reason is required.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_cancel_reward", {
    p_reward_id: rewardId,
    p_reason: reason,
  })

  const failure = rpcFailure(
    error,
    "Reward cancellation failed. Try again or review audit logs."
  )
  if (failure) return failure

  revalidatePath("/admin/customers")
  revalidatePath("/admin/audit")
  return adminActionSuccess("Reward cancelled. Logged to the audit trail.")
}

export async function resolveFraudFlagAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const fraudFlagId = value(formData, "fraudFlagId")
  const status = value(formData, "status")
  const reason = value(formData, "reason")

  if (!fraudFlagId) {
    return adminActionError("Fraud flag is required.")
  }
  if (status !== "reviewed" && status !== "dismissed") {
    return adminActionError("Fraud flag status is invalid.")
  }
  if (!reason) {
    return adminActionError("Operator reason is required.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_resolve_fraud_flag", {
    p_fraud_flag_id: fraudFlagId,
    p_status: status,
    p_reason: reason,
  })

  const failure = rpcFailure(
    error,
    "Fraud flag update failed. Try again or review audit logs."
  )
  if (failure) return failure

  revalidatePath("/admin/fraud")
  revalidatePath("/admin/audit")
  return adminActionSuccess(
    status === "reviewed"
      ? "Flag marked reviewed. Logged to the audit trail."
      : "Flag dismissed. Logged to the audit trail."
  )
}

export async function setQrActiveAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const qrCodeId = value(formData, "qrCodeId")
  const reason = value(formData, "reason")
  const isActive = value(formData, "isActive") === "true"

  if (!qrCodeId) {
    return adminActionError("QR code is required.")
  }
  if (!reason) {
    return adminActionError("Operator reason is required.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_set_qr_active", {
    p_qr_code_id: qrCodeId,
    p_is_active: isActive,
    p_reason: reason,
  })

  const failure = rpcFailure(
    error,
    "QR update failed. Try again or review audit logs."
  )
  if (failure) return failure

  revalidateCacheTag(qrImageContextCacheTag(qrCodeId))
  revalidatePath("/admin/merchants")
  revalidatePath("/admin/audit")
  return adminActionSuccess(
    isActive
      ? "QR code enabled. Logged to the audit trail."
      : "QR code disabled. Logged to the audit trail."
  )
}

export async function regenerateQrAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const qrCodeId = value(formData, "qrCodeId")
  const reason = value(formData, "reason")

  if (!qrCodeId) {
    return adminActionError("QR code is required.")
  }
  if (!reason) {
    return adminActionError("Operator reason is required.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_regenerate_qr_code", {
    p_qr_code_id: qrCodeId,
    p_reason: reason,
  })

  const failure = rpcFailure(
    error,
    "QR regeneration failed. Try again or review audit logs."
  )
  if (failure) return failure

  revalidateCacheTag(qrImageContextCacheTag(qrCodeId))
  revalidatePath("/admin/merchants")
  revalidatePath("/admin/audit")
  return adminActionSuccess("QR code regenerated. Logged to the audit trail.")
}

/**
 * Add or remove a venue from the Offers pilot allowlist
 * (`merchants.offer_campaigns_enabled`).
 *
 * Routed through `admin_set_merchant_offer_campaigns` rather than a table
 * update: the RPC carries the `is_internal_admin()` guard and writes the
 * `offer_campaigns_allowlist_set` audit row itself, and a service-role update
 * to `merchants` would bypass both. `requireAdminAction` is the same step-up
 * gate every other mutating admin action uses, and the RPC is called with the
 * operator's own session so the database-side guard actually sees them.
 *
 * There is deliberately no operator-reason field here, unlike the QR controls
 * above: the RPC takes no reason parameter, and a box whose text the audit
 * trail never stores would be a record that does not exist. The consequence is
 * spelled out in the form's confirmation instead.
 */
export async function setMerchantOfferCampaignsAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const merchantId = value(formData, "merchantId")
  const enabled = value(formData, "enabled") === "true"

  if (!merchantId) {
    return adminActionError("Merchant context is required.")
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc(
    "admin_set_merchant_offer_campaigns",
    { p_merchant_id: merchantId, p_enabled: enabled }
  )

  const failure = rpcFailure(
    error,
    "Offers allowlist update failed. Try again or review audit logs."
  )
  if (failure) return failure

  if (data !== true) {
    return adminActionError("That merchant no longer exists.")
  }

  revalidatePath("/admin/merchants")
  revalidatePath("/admin/audit")
  return adminActionSuccess(
    enabled
      ? "Offers turned on for this venue. Its merchants can now build a campaign; nothing is published yet. Logged to the audit trail."
      : "Offers turned off for this venue. Passes customers already hold still work. Logged to the audit trail."
  )
}

export async function recordConsentOptOutAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const customerId = value(formData, "customerId")
  const merchantId = value(formData, "merchantId")
  const channel = value(formData, "channel")
  const source = value(formData, "source") || "support_request"
  const policyVersion =
    value(formData, "policyVersion") || MARKETING_POLICY_VERSION
  const reason = value(formData, "reason")

  if (!customerId || !merchantId) {
    return adminActionError("Customer and merchant context are required.")
  }
  if (!reason) {
    return adminActionError("Operator reason is required.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_record_consent_opt_out", {
    p_customer_id: customerId,
    p_merchant_id: merchantId,
    p_channel: channel,
    p_source: source,
    p_policy_version: policyVersion,
    p_reason: reason,
  })

  const failure = rpcFailure(
    error,
    "Consent opt-out failed. Try again or review audit logs."
  )
  if (failure) return failure

  revalidatePath("/admin/privacy")
  revalidatePath("/admin/audit")
  return adminActionSuccess("Opt-out recorded. Logged to the audit trail.")
}

export async function logDataRequestAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const customerId = value(formData, "customerId")
  const merchantId = value(formData, "merchantId")
  const requestType = value(formData, "requestType")
  const channel = value(formData, "channel")
  const notes = value(formData, "notes")

  if (!customerId || !merchantId) {
    return adminActionError("Customer and merchant context are required.")
  }
  if (!requestType) {
    return adminActionError("Request type is required.")
  }
  if (!channel) {
    return adminActionError("Support channel is required.")
  }
  if (!notes) {
    return adminActionError("Support notes are required.")
  }

  const supabase = await createSupabaseServerClient()

  // For a deletion, scrub bulk loyalty invitation data BEFORE the erasure below
  // nulls the customer's email HMAC — the companion RPC matches unclaimed
  // invitations (which still hold ciphertext, tokens and queue state) by that
  // HMAC, so it must run while the HMAC is still present.
  if (requestType === "deletion") {
    await supabase.rpc("admin_erase_loyalty_invitations_for_customer", {
      p_customer_id: customerId,
    })
    // Offer campaigns hold no contact detail, so there is nothing to scrub;
    // what erasure removes is the subject's outstanding pass scan tokens, the
    // redeemable state of any pass they still hold, and the claim linkage
    // wherever no redemption sits beneath it. The append-only redemption ledger
    // is left intact and is de-identified by the customer-row anonymisation.
    await supabase.rpc("admin_erase_offer_claims_for_customer", {
      p_customer_id: customerId,
    })
  }

  const { data, error } = await supabase.rpc("admin_log_data_request", {
    p_customer_id: customerId,
    p_merchant_id: merchantId,
    p_request_type: requestType,
    p_channel: channel,
    p_notes: notes,
  })

  const failure = rpcFailure(
    error,
    "Data request log failed. Try again or review audit logs."
  )
  if (failure) return failure

  revalidatePath("/admin/privacy")
  revalidatePath("/admin/audit")

  // Extend the subject-access export to cover bulk two-stamp loyalty invitation
  // data, which the monolithic customer export RPC does not touch. (The deletion
  // companion runs above, before the HMAC is erased.)
  // Offer claims, discount passes and redemptions are outside that RPC too, so
  // they are merged in alongside as their own object.
  let exportPayload: unknown = data
  if (requestType === "export" && data && typeof data === "object") {
    const { data: invitations } = await supabase.rpc(
      "loyalty_invitations_export_for_customer",
      { p_customer_id: customerId }
    )
    const { data: offerClaims } = await supabase.rpc(
      "offer_claims_export_for_customer",
      { p_customer_id: customerId }
    )
    exportPayload = {
      ...(data as Record<string, unknown>),
      loyalty_invitations: invitations ?? [],
      offer_campaigns: offerClaims ?? {},
    }
  }

  // An `export` request returns the customer's data export payload; deliver it
  // to the admin as a download instead of discarding it, so a GDPR subject-
  // access request actually produces the data (db privacy lifecycle).
  const download =
    requestType === "export" ? buildExportDownload(exportPayload) : null
  if (download) {
    return adminActionSuccess(
      "Subject-access export ready. Download the customer's data below.",
      download
    )
  }

  return adminActionSuccess("Data request logged to the audit trail.")
}

export async function logPilotNoteAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const merchantId = value(formData, "merchantId")
  const noteType = value(formData, "noteType")
  const notes = value(formData, "notes")
  const setupMinutesValue =
    value(formData, "setupMinutes") || value(formData, "trainingMinutes")
  const setupMinutes = setupMinutesValue
    ? Number.parseInt(setupMinutesValue, 10)
    : null

  if (!merchantId) {
    return adminActionError("Merchant context is required.")
  }
  if (!noteType) {
    return adminActionError("Note type is required.")
  }
  if (!notes) {
    return adminActionError("Support notes are required.")
  }

  if (setupMinutes !== null && Number.isNaN(setupMinutes)) {
    return adminActionError("Setup check minutes must be a number.")
  }
  if (setupMinutes !== null && (setupMinutes < 1 || setupMinutes > 3)) {
    return adminActionError("Setup check minutes must be between 1 and 3.")
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("admin_log_pilot_note", {
    p_merchant_id: merchantId,
    p_note_type: noteType,
    p_notes: notes,
    p_training_minutes: setupMinutes,
  })

  const failure = rpcFailure(
    error,
    "Pilot note log failed. Try again or review audit logs."
  )
  if (failure) return failure

  revalidatePath("/admin/pilot")
  revalidatePath("/admin/audit")
  return adminActionSuccess("Pilot note logged to the audit trail.")
}

export async function captureCommercialEvidenceAction(
  _previousState: AdminActionState,
  formData: FormData
): Promise<AdminActionState> {
  await requireAdminAction()
  const merchantId = value(formData, "merchantId")
  const sourceKind = value(formData, "sourceKind")
  const beforeSummary = value(formData, "beforeSummary")
  const afterSummary = value(formData, "afterSummary")
  const testimonialQuote = value(formData, "testimonialQuote")
  const attributionName = value(formData, "attributionName")
  const measurementStart = value(formData, "measurementStart")
  const measurementEnd = value(formData, "measurementEnd")
  const sourceReference = value(formData, "sourceReference")
  const assetReference = value(formData, "assetReference")
  const approvalReference = value(formData, "approvalReference")
  const merchantApproved = formData.has("merchantApproved")
  const publish = value(formData, "caseStatus") === "published"

  if (
    !merchantId ||
    !sourceKind ||
    !beforeSummary ||
    !afterSummary ||
    !measurementStart ||
    !measurementEnd ||
    !sourceReference
  ) {
    return adminActionError("Complete every required evidence field.")
  }

  if (
    beforeSummary.length > 1200 ||
    afterSummary.length > 1200 ||
    testimonialQuote.length > 600 ||
    attributionName.length > 160 ||
    sourceReference.length > 500 ||
    assetReference.length > 500 ||
    approvalReference.length > 500
  ) {
    return adminActionError("One or more evidence fields are too long.")
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(measurementStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(measurementEnd)
  ) {
    return adminActionError("The evidence measurement window is invalid.")
  }

  if (
    publish &&
    (!merchantApproved || !approvalReference || !attributionName)
  ) {
    return adminActionError(
      "Published evidence needs merchant approval, an approval reference and an approved attribution."
    )
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc(
    "admin_capture_commercial_evidence_case",
    {
      p_merchant_id: merchantId,
      p_source_kind: sourceKind,
      p_before_summary: beforeSummary,
      p_after_summary: afterSummary,
      p_testimonial_quote: testimonialQuote || null,
      p_attribution_name: attributionName || null,
      p_measurement_start: measurementStart,
      p_measurement_end: measurementEnd,
      p_source_reference: sourceReference,
      p_asset_reference: assetReference || null,
      p_approval_reference: approvalReference || null,
      p_merchant_approved: merchantApproved,
      p_publish: publish,
    }
  )

  const failure = rpcFailure(
    error,
    "Evidence capture failed. Check the dates and approval record, then try again."
  )
  if (failure) return failure

  revalidateCacheTag("commercial-evidence")
  revalidatePath("/admin/evidence")
  revalidatePath("/admin/audit")
  revalidatePath("/")
  return adminActionSuccess(
    publish
      ? "Approved evidence published with a reproducible metric snapshot."
      : "Evidence draft saved with a reproducible metric snapshot."
  )
}
