import "server-only"

import { recordProductEvent } from "@/lib/analytics/events"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { enforceRateLimit, RateLimitError } from "@/lib/security/rate-limit"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

export type CustomerJoinContext = {
  available: boolean
  qrId?: string
  qrCodeId?: string
  merchant: {
    id: string
    business_name: string
    business_slug: string
    email: string
    phone: string | null
  }
  loyaltyCard: {
    id: string
    card_name: string
    reward_name: string
    stamps_required: number
    reward_terms: string
    min_spend_pence: number | null
  }
}

type RawQrLookup = {
  id: string
  qr_id: string
  is_active: boolean
  destination_type: string
  merchants:
    | {
        id: string
        business_name: string
        business_slug: string
        email: string
        phone: string | null
        status: string
      }
    | Array<{
        id: string
        business_name: string
        business_slug: string
        email: string
        phone: string | null
        status: string
      }>
  loyalty_cards:
    | {
        id: string
        card_name: string
        reward_name: string
        stamps_required: number
        reward_terms: string
        min_spend_pence: number | null
        is_active: boolean
      }
    | Array<{
        id: string
        card_name: string
        reward_name: string
        stamps_required: number
        reward_terms: string
        min_spend_pence: number | null
        is_active: boolean
      }>
}

type ResolveQrForJoinOptions = {
  enforceScanRateLimit?: boolean
  recordScan?: boolean
}

export async function resolveQrForJoin(
  qrId: string,
  {
    enforceScanRateLimit = true,
    recordScan = true,
  }: ResolveQrForJoinOptions = {}
) {
  if (enforceScanRateLimit) {
    await enforceRateLimit({
      key: `qr-scan:${qrId}`,
      limit: 60,
      windowMs: 60_000,
    })
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("qr_codes")
    .select(
      "id, qr_id, is_active, destination_type, merchants(id, business_name, business_slug, email, phone, status), loyalty_cards!loyalty_card_id(id, card_name, reward_name, stamps_required, reward_terms, min_spend_pence, is_active)"
    )
    .eq("qr_id", qrId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to resolve QR code: ${error.message}`)
  }

  if (!data) return null

  const qrCode = data as RawQrLookup
  const merchant = first(qrCode.merchants)
  const loyaltyCard = first(qrCode.loyalty_cards)
  const billingBlocked = await isMerchantBillingBlocked(merchant.id)
  const available =
    qrCode.destination_type === "join" &&
    qrCode.is_active &&
    loyaltyCard.is_active &&
    !billingBlocked &&
    isMerchantProgrammeActive(merchant.status)

  if (recordScan) {
    await recordProductEvent({
      eventName: "qr_scanned",
      merchantId: merchant.id,
      qrCodeId: qrCode.id,
      actorType: "system",
      metadata: {
        available,
        destination_type: qrCode.destination_type,
      },
    })
  }

  return {
    available,
    qrId: qrCode.qr_id,
    qrCodeId: qrCode.id,
    merchant,
    loyaltyCard,
  } satisfies CustomerJoinContext
}

export async function getMerchantJoinContext(
  merchantSlug: string,
  qrId?: string
) {
  if (qrId) {
    let qrContext: Awaited<ReturnType<typeof resolveQrForJoin>>

    try {
      qrContext = await resolveQrForJoin(qrId, {
        enforceScanRateLimit: false,
        recordScan: false,
      })
    } catch (error) {
      if (error instanceof RateLimitError) return null
      throw error
    }

    if (!qrContext) return null
    if (qrContext.merchant.business_slug !== merchantSlug) return null
    return qrContext
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("merchants")
    .select(
      "id, business_name, business_slug, email, phone, status, loyalty_cards(id, card_name, reward_name, stamps_required, reward_terms, min_spend_pence, is_active)"
    )
    .eq("business_slug", merchantSlug)
    .eq("loyalty_cards.is_active", true)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load merchant join page: ${error.message}`)
  }

  if (!data) return null

  const loyaltyCard = first(data.loyalty_cards)
  if (!loyaltyCard?.is_active) return null
  const billingBlocked = await isMerchantBillingBlocked(data.id)

  return {
    available: !billingBlocked && isMerchantProgrammeActive(data.status),
    merchant: {
      id: data.id,
      business_name: data.business_name,
      business_slug: data.business_slug,
      email: data.email,
      phone: data.phone,
    },
    loyaltyCard: {
      id: loyaltyCard.id,
      card_name: loyaltyCard.card_name,
      reward_name: loyaltyCard.reward_name,
      stamps_required: loyaltyCard.stamps_required,
      reward_terms: loyaltyCard.reward_terms,
      min_spend_pence: loyaltyCard.min_spend_pence,
    },
  } satisfies CustomerJoinContext
}

export async function getExistingMembershipForCurrentUser(merchantId: string) {
  const customer = await getCurrentCustomer()
  if (!customer) return null

  const supabase = createSupabaseServiceRoleClient()
  const { data: membership, error: membershipError } = await supabase
    .from("customer_memberships")
    .select("id, current_stamp_count, total_rewards_redeemed")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customer.id)
    .maybeSingle()

  if (membershipError) {
    throw new Error(`Unable to load membership: ${membershipError.message}`)
  }

  return membership
}

export async function getStampQrContextForMembership(
  membershipId: string,
  qrId: string
) {
  const qrContext = await resolveQrForJoin(qrId, {
    enforceScanRateLimit: false,
    recordScan: false,
  })

  if (!qrContext || !qrContext.available) return null

  const membership = await getExistingMembershipForCurrentUser(
    qrContext.merchant.id
  )

  if (!membership || membership.id !== membershipId) return null

  return qrContext
}

async function isMerchantBillingBlocked(merchantId: string) {
  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("billing_customers")
    .select("status")
    .eq("merchant_id", merchantId)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to load billing status: ${error.message}`)
  }

  // Mirror the RPC: both `cancelled` and `suspended` block join/QR availability.
  return data?.status === "cancelled" || data?.status === "suspended"
}

/**
 * Mirror the stamp/redeem RPCs' merchant guard: only `trial`/`active` programmes
 * accept customers. A paused/cancelled/suspended merchant must read as
 * unavailable on the join + QR resolver path, not onboard a member whose first
 * stamp the RPC will then reject.
 */
function isMerchantProgrammeActive(status: string | null | undefined) {
  return status === "trial" || status === "active"
}

function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value
}
