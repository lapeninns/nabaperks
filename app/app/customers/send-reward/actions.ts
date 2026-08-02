"use server"

import { createHash, randomBytes } from "node:crypto"

import { after } from "next/server"

import { getCurrentMerchant } from "@/lib/auth/session"
import {
  customerEmailHmac,
  looksLikeEmail,
  maskEmail,
  normalizeEmail,
} from "@/lib/customer/email-pii-core"
import { normalizePhone } from "@/lib/customer/phone"
import { customerPhoneHmac } from "@/lib/customer/phone-pii-core"
import {
  SEND_REWARD_SUCCESS,
  hasSendRewardErrors,
  validateSendRewardFields,
  type SendRewardErrors,
} from "@/lib/merchant/send-reward-fields"
import { shouldSuppressRewardInviteEmail } from "@/lib/merchant/reward-invite-suppression"
import { buildRewardInviteEmail } from "@/lib/notifications/reward-invite-email"
import { sendTransactionalEmail } from "@/lib/notifications/resend"
import { RateLimitError, enforceRateLimit } from "@/lib/security/rate-limit"
import {
  createSupabaseServerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"

export type SendRewardState = {
  fields?: {
    membershipId?: string
    contact?: string
    rewardName?: string
    rewardTerms?: string
    expiresInDays?: string
    message?: string
  }
  errors?: SendRewardErrors
  message?: string
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key)
  return typeof raw === "string" ? raw.trim() : ""
}

function sendRewardError(message: string) {
  if (/already been sent to this member today/i.test(message)) {
    return "You've already sent this member a reward today."
  }
  if (/daily sent-reward limit/i.test(message)) {
    return "You've reached today's sent-reward limit. Try again tomorrow."
  }
  return "Reward could not be sent. Check the details and try again."
}

type RewardInviteCreateResult = { readonly ok: true } | { readonly ok: false }

/**
 * Match a typed contact against THIS merchant's own members (phone by HMAC,
 * email by verified plaintext). Returns the membership id or null. Runs at the
 * service-role tier because customer contact is RLS-protected — the merchant
 * only ever learns the outcome via the uniform response, never the raw match.
 */
async function matchMerchantMembershipForContact(
  merchantId: string,
  contact: string
): Promise<string | null> {
  const raw = contact.trim()
  if (!raw) return null

  const supabase = createSupabaseServiceRoleClient()
  let customerIds: string[] = []

  if (looksLikeEmail(raw)) {
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("email", normalizeEmail(raw))
      .not("email_verified_at", "is", null)
      .limit(5)
    customerIds = (data ?? []).map((row) => row.id as string)
  } else {
    const normalized = normalizePhone(raw, "GB")
    if (!normalized.ok) return null
    let hmac: string
    try {
      hmac = customerPhoneHmac(normalized.phone.e164)
    } catch {
      return null
    }
    const { data } = await supabase
      .from("customers")
      .select("id")
      .eq("phone_hmac", hmac)
      .limit(5)
    customerIds = (data ?? []).map((row) => row.id as string)
  }

  if (customerIds.length === 0) return null

  const { data } = await supabase
    .from("customer_memberships")
    .select("id")
    .eq("merchant_id", merchantId)
    .in("customer_id", customerIds)
    .limit(1)
    .maybeSingle()

  return (data?.id as string | undefined) ?? null
}

async function isInviteEmailSuppressed(
  merchantId: string,
  emailHmac: string
): Promise<boolean> {
  const supabase = createSupabaseServiceRoleClient()
  // Venue-scoped: one venue's unsubscribe must not silence every other venue.
  // Legacy unscoped rows (merchant_id is null) still suppress everywhere.
  const result = await supabase.rpc("reward_invite_email_suppressed", {
    p_merchant_id: merchantId,
    p_email_hmac: emailHmac,
  })
  return shouldSuppressRewardInviteEmail(result)
}

/**
 * A typed contact that matches no existing member becomes a pending invite. The
 * contact is hashed (never stored raw); an email invite additionally gets one
 * one-off email (unless deduped, suppressed, or over the fatigue cap). Phone
 * invites have no SMS — they attach silently when the person joins.
 */
async function createRewardInviteForUnmatchedContact(
  merchant: { id: string; business_name?: string | null },
  input: {
    contact: string
    rewardName: string
    rewardTerms: string
    message: string
  },
  expiresInDays: number
): Promise<RewardInviteCreateResult> {
  const raw = input.contact.trim()
  const isEmail = looksLikeEmail(raw)

  let emailHmac: string | null = null
  let emailMasked: string | null = null
  let phoneHmac: string | null = null
  let phoneLast4: string | null = null

  if (isEmail) {
    try {
      emailHmac = customerEmailHmac(raw)
      emailMasked = maskEmail(raw)
    } catch {
      return { ok: false }
    }
  } else {
    const normalized = normalizePhone(raw, "GB")
    if (!normalized.ok) return { ok: false }
    try {
      phoneHmac = customerPhoneHmac(normalized.phone.e164)
      phoneLast4 = normalized.phone.e164.replace(/\D/g, "").slice(-4)
    } catch {
      return { ok: false }
    }
  }

  // Two independent capabilities. Reusing one value for both meant a leaked
  // claim URL also carried unsubscribe authority.
  const token = randomBytes(32).toString("base64url")
  const claimTokenHash = createHash("sha256").update(token).digest("hex")
  const unsubscribeToken = randomBytes(32).toString("base64url")
  const unsubscribeTokenHash = createHash("sha256")
    .update(unsubscribeToken)
    .digest("hex")

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.rpc("create_merchant_reward_invite", {
    p_merchant_id: merchant.id,
    p_email_hmac: emailHmac,
    p_phone_hmac: phoneHmac,
    p_email_masked: emailMasked,
    p_phone_last4: phoneLast4,
    p_reward_name: input.rewardName,
    p_reward_terms: input.rewardTerms,
    p_personal_message: input.message || null,
    p_reward_expires_after_days: expiresInDays,
    p_claim_token_hash: claimTokenHash,
    p_unsubscribe_token_hash: unsubscribeTokenHash,
  })
  if (error) return { ok: false }

  const inviteId = data?.[0]?.invite_id as string | undefined
  const deduped = data?.[0]?.deduped === true

  if (!isEmail || !emailHmac || deduped) return { ok: true }
  if (await isInviteEmailSuppressed(merchant.id, emailHmac)) return { ok: true }

  try {
    await enforceRateLimit({
      key: `invite-email:${emailHmac}`,
      limit: 3,
      windowMs: 30 * 86_400_000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) return { ok: true }
    throw error
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://nabaperks.com"
  const claimUrl = `${appUrl}/claim/${token}`
  const email = buildRewardInviteEmail({
    businessName: merchant.business_name ?? "A local venue",
    rewardName: input.rewardName,
    personalMessage: input.message || null,
    claimUrl,
    // Its own route and its own secret: the claim token must not be replayable
    // as an opt-out, and the opt-out must not be replayable as a claim.
    unsubscribeUrl: `${appUrl}/claim/unsubscribe/${unsubscribeToken}`,
  })

  after(async () => {
    const service = createSupabaseServiceRoleClient()
    try {
      await sendTransactionalEmail({
        to: raw,
        subject: email.subject,
        text: email.text,
        html: email.html,
      })
      if (inviteId) {
        await service
          .from("pending_reward_invites")
          .update({ email_send_status: "sent" })
          .eq("id", inviteId)
      }
    } catch {
      if (inviteId) {
        await service
          .from("pending_reward_invites")
          .update({ email_send_status: "failed" })
          .eq("id", inviteId)
      }
    }
  })

  return { ok: true }
}

export async function sendMerchantRewardAction(
  _state: SendRewardState,
  formData: FormData
): Promise<SendRewardState> {
  const merchant = await getCurrentMerchant()
  if (!merchant) {
    return {
      errors: { form: "Complete merchant onboarding before sending rewards." },
    }
  }

  const input = {
    membershipId: value(formData, "membershipId"),
    contact: value(formData, "contact"),
    rewardName: value(formData, "rewardName"),
    rewardTerms: value(formData, "rewardTerms"),
    expiresInDays: value(formData, "expiresInDays") || "30",
    message: value(formData, "message"),
  }
  const fields = { ...input }
  const contactEntered = !input.membershipId

  const { errors, expiresInDays } = validateSendRewardFields(input)
  if (hasSendRewardErrors(errors) || expiresInDays === null) {
    return { fields, errors }
  }

  try {
    await enforceRateLimit({
      key: `send-reward:${merchant.id}`,
      limit: 50,
      windowMs: 86_400_000,
    })
  } catch (error) {
    if (error instanceof RateLimitError) {
      return {
        fields,
        errors: {
          form: "You've sent the maximum rewards for today. Try again tomorrow.",
        },
      }
    }
    throw error
  }

  let membershipId = input.membershipId || null
  if (!membershipId) {
    membershipId = await matchMerchantMembershipForContact(
      merchant.id,
      input.contact
    )
    if (!membershipId) {
      // No existing member matches — hold it as a pending invite that attaches
      // when they join. The uniform response keeps membership unprobeable.
      const inviteResult = await createRewardInviteForUnmatchedContact(
        merchant,
        {
          contact: input.contact,
          rewardName: input.rewardName,
          rewardTerms: input.rewardTerms,
          message: input.message,
        },
        expiresInDays
      )
      if (!inviteResult.ok) {
        return { fields, errors: { form: sendRewardError("") } }
      }
      return { message: SEND_REWARD_SUCCESS }
    }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.rpc("issue_merchant_direct_reward", {
    p_merchant_id: merchant.id,
    p_membership_id: membershipId,
    p_reward_name: input.rewardName,
    p_reward_terms: input.rewardTerms,
    p_expires_in_days: expiresInDays,
    p_reason: input.message || null,
  })

  if (error) {
    if (contactEntered) {
      return { message: SEND_REWARD_SUCCESS }
    }
    return { fields, errors: { form: sendRewardError(error.message) } }
  }

  return { message: SEND_REWARD_SUCCESS }
}
