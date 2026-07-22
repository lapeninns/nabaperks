"use server"

import { randomUUID } from "node:crypto"

import { revalidatePath } from "next/cache"

import { getCurrentMerchant, getCurrentUser } from "@/lib/auth/session"
import { encryptCustomerEmail } from "@/lib/customer/email-encryption-core"
import { customerEmailHmac, maskEmail } from "@/lib/customer/email-pii-core"
import { isLoyaltyInvitesEnabled } from "@/lib/loyalty-invites/access"
import { LOYALTY_INVITE_LINK_TTL_DAYS } from "@/lib/loyalty-invites/constants"
import { parseInviteEmailInput } from "@/lib/loyalty-invites/import-core"
import { inviteTokenSet } from "@/lib/loyalty-invites/tokens"
import {
  LOYALTY_INVITE_SEND_SUCCESS,
  validateInviteConfirm,
  validateInviteRecipients,
  type LoyaltyInviteConfirmErrors,
} from "@/lib/merchant/loyalty-invite-fields"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type LoyaltyInviteState = {
  step?: "input" | "preview"
  fields?: { recipients?: string; legalBasis?: string }
  errors?: LoyaltyInviteConfirmErrors & { recipients?: string; form?: string }
  preview?: {
    campaignId: string
    eligible: number
    invalid: number
    duplicate: number
    notEligible: number
    sample: string[]
  }
  message?: string
}

function value(formData: FormData, key: string): string {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

async function requireEnabledMerchant() {
  const [merchant, user] = await Promise.all([
    getCurrentMerchant(),
    getCurrentUser(),
  ])
  if (!merchant) return { error: "Sign in to invite customers." as const }
  if (!isLoyaltyInvitesEnabled(Boolean(merchant.loyalty_invites_enabled))) {
    return {
      error:
        "Customer invitations aren't available for your venue yet." as const,
    }
  }
  return { merchant, actorUserId: user?.id ?? null }
}

export async function previewLoyaltyInviteAction(
  _previousState: LoyaltyInviteState,
  formData: FormData
): Promise<LoyaltyInviteState> {
  const gate = await requireEnabledMerchant()
  if ("error" in gate) return { step: "input", errors: { form: gate.error } }

  const recipients = value(formData, "recipients")
  const validation = validateInviteRecipients(recipients)
  if (!validation.ok) {
    return {
      step: "input",
      fields: { recipients },
      errors: { recipients: validation.error },
    }
  }

  const parsed = parseInviteEmailInput(recipients)
  let recipientIds: string[]
  let emailHmacs: string[]
  let ciphertexts: string[]
  let maskeds: string[]
  let claimHashes: string[]
  let unsubHashes: string[]
  try {
    recipientIds = parsed.emails.map(() => randomUUID())
    emailHmacs = parsed.emails.map((email) => customerEmailHmac(email))
    ciphertexts = parsed.emails.map((email) => encryptCustomerEmail(email))
    maskeds = parsed.emails.map((email) => maskEmail(email) ?? "")
    const tokenSets = recipientIds.map((id) => inviteTokenSet(id))
    claimHashes = tokenSets.map((set) => set.claimTokenHash)
    unsubHashes = tokenSets.map((set) => set.unsubscribeTokenHash)
  } catch {
    return {
      step: "input",
      fields: { recipients },
      errors: { form: "Invitations aren't configured yet. Contact support." },
    }
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase.rpc("create_loyalty_invite_draft", {
    p_merchant_id: gate.merchant.id,
    p_created_by: gate.actorUserId,
    p_recipient_ids: recipientIds,
    p_email_hmacs: emailHmacs,
    p_email_ciphertexts: ciphertexts,
    p_email_maskeds: maskeds,
    p_claim_token_hashes: claimHashes,
    p_unsubscribe_token_hashes: unsubHashes,
    p_invalid_count: parsed.invalidCount,
    p_duplicate_count: parsed.duplicateCount,
  })

  if (error) {
    return {
      step: "input",
      fields: { recipients },
      errors: { form: mapDraftError(error.message) },
    }
  }

  const row = Array.isArray(data) ? data[0] : data
  const campaignId = row?.campaign_id as string
  const eligible = (row?.eligible_count as number) ?? 0
  const notEligible = (row?.not_eligible_count as number) ?? 0

  const { data: sampleRows } = await supabase
    .from("loyalty_invite_recipients")
    .select("email_masked")
    .eq("campaign_id", campaignId)
    .not("email_masked", "is", null)
    .limit(8)

  return {
    step: "preview",
    fields: { recipients },
    preview: {
      campaignId,
      eligible,
      invalid: parsed.invalidCount,
      duplicate: parsed.duplicateCount,
      notEligible,
      sample: (sampleRows ?? [])
        .map((sampleRow) => sampleRow.email_masked)
        .filter((masked): masked is string => Boolean(masked)),
    },
  }
}

export async function sendLoyaltyInviteAction(
  _previousState: LoyaltyInviteState,
  formData: FormData
): Promise<LoyaltyInviteState> {
  const gate = await requireEnabledMerchant()
  if ("error" in gate) return { errors: { form: gate.error } }

  const campaignId = value(formData, "campaignId")
  const legalBasis = value(formData, "legalBasis")
  const attested = formData.get("attestation") === "on"

  const confirmation = validateInviteConfirm(legalBasis, attested)
  if (!confirmation.ok) {
    return {
      step: "preview",
      fields: { legalBasis },
      errors: confirmation.errors,
    }
  }

  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("confirm_loyalty_invite_campaign", {
    p_merchant_id: gate.merchant.id,
    p_campaign_id: campaignId,
    p_legal_basis: legalBasis,
    p_link_ttl_days: LOYALTY_INVITE_LINK_TTL_DAYS,
    p_actor_user_id: gate.actorUserId,
  })
  if (error) {
    return {
      step: "preview",
      errors: { form: "The campaign could not be sent. Try again." },
    }
  }

  revalidatePath("/app/customers/invite")
  return { message: LOYALTY_INVITE_SEND_SUCCESS }
}

export async function cancelLoyaltyInviteAction(
  _previousState: LoyaltyInviteState,
  formData: FormData
): Promise<LoyaltyInviteState> {
  const gate = await requireEnabledMerchant()
  if ("error" in gate) return { errors: { form: gate.error } }

  const campaignId = value(formData, "campaignId")
  const supabase = createSupabaseServiceRoleClient()
  const { error } = await supabase.rpc("cancel_loyalty_invite_campaign", {
    p_merchant_id: gate.merchant.id,
    p_campaign_id: campaignId,
    p_actor_user_id: gate.actorUserId,
  })
  if (error) {
    return {
      errors: { form: "The campaign could not be cancelled. Try again." },
    }
  }

  revalidatePath("/app/customers/invite")
  return { message: "Campaign cancelled. Unsent invitations were stopped." }
}

/**
 * Single dispatcher so one useActionState drives the whole form. The submit
 * button's `intent` selects preview (default), send or cancel.
 */
export async function loyaltyInviteFormAction(
  previousState: LoyaltyInviteState,
  formData: FormData
): Promise<LoyaltyInviteState> {
  const intent = value(formData, "intent")
  if (intent === "send") return sendLoyaltyInviteAction(previousState, formData)
  if (intent === "cancel")
    return cancelLoyaltyInviteAction(previousState, formData)
  return previewLoyaltyInviteAction(previousState, formData)
}

function mapDraftError(message: string): string {
  if (/already in progress/i.test(message)) {
    return "You already have a campaign in progress. Cancel it before starting another."
  }
  if (/per 24 hours/i.test(message)) {
    return "That would exceed the 2,000 invitations per 24 hours limit."
  }
  if (/not enabled/i.test(message)) {
    return "Customer invitations aren't available for your venue yet."
  }
  return "We couldn't prepare that list. Check the addresses and try again."
}
