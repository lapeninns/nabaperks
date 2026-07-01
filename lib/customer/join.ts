import "server-only"

import { after } from "next/server"

import { recordProductEvent } from "@/lib/analytics/events"
import { loyaltyAvailability } from "@/lib/customer/availability"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { logger } from "@/lib/observability/logger"
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
    stamps_required: number
    reward_terms: string
  }
}

type BillingCustomerEmbed =
  | { status: string | null }
  | Array<{ status: string | null }>
  | null

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
        requires_billing: boolean
        billing_customers: BillingCustomerEmbed
      }
    | Array<{
        id: string
        business_name: string
        business_slug: string
        email: string
        phone: string | null
        status: string
        requires_billing: boolean
        billing_customers: BillingCustomerEmbed
      }>
  loyalty_cards:
    | {
        id: string
        card_name: string
        stamps_required: number
        reward_terms: string
        is_active: boolean
      }
    | Array<{
        id: string
        card_name: string
        stamps_required: number
        reward_terms: string
        is_active: boolean
      }>
}

type ResolveQrForJoinOptions = {
  enforceScanRateLimit?: boolean
  recordScan?: boolean
  scanRateLimitIdentity?: string
}

export async function resolveQrForJoin(
  qrId: string,
  {
    enforceScanRateLimit = true,
    recordScan = true,
    scanRateLimitIdentity = "anonymous",
  }: ResolveQrForJoinOptions = {}
) {
  if (enforceScanRateLimit) {
    await enforceRateLimit({
      key: `qr-scan:${qrId}:${scanRateLimitIdentity}`,
      limit: 60,
      windowMs: 60_000,
    })
  }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("qr_codes")
    .select(
      "id, qr_id, is_active, destination_type, merchants(id, business_name, business_slug, email, phone, status, requires_billing, billing_customers(status)), loyalty_cards!loyalty_card_id(id, card_name, stamps_required, reward_terms, is_active)"
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
  const billingStatus =
    firstNullable(merchant.billing_customers)?.status ?? null
  const availability = loyaltyAvailability({
    merchantStatus: merchant.status,
    cardActive: loyaltyCard.is_active,
    billingStatus,
    requiresBilling: merchant.requires_billing,
  })
  const available =
    qrCode.destination_type === "join" &&
    qrCode.is_active &&
    availability.available

  if (recordScan) {
    // Defer the scan-analytics write off the critical path. `/q/[qrId]` is the
    // highest-traffic public endpoint and redirects the customer the instant
    // availability is resolved, so recording the event with `after()` keeps a
    // DB write (or its failure) from delaying or breaking the scan. The
    // rate-limit check above stays inline — that's a gate, not telemetry.
    after(async () => {
      try {
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
      } catch (error) {
        logger.warn("Deferred QR scan analytics failed", {
          error,
          merchantId: merchant.id,
          qrCodeId: qrCode.id,
        })
      }
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
      "id, business_name, business_slug, email, phone, status, requires_billing, billing_customers(status), loyalty_cards(id, card_name, stamps_required, reward_terms, is_active)"
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
  const billingStatus = firstNullable(data.billing_customers)?.status ?? null
  const availability = loyaltyAvailability({
    merchantStatus: data.status,
    cardActive: loyaltyCard.is_active,
    billingStatus,
    requiresBilling: data.requires_billing,
  })

  return {
    available: availability.available,
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
      stamps_required: loyaltyCard.stamps_required,
      reward_terms: loyaltyCard.reward_terms,
    },
  } satisfies CustomerJoinContext
}

export async function getExistingMembershipForCurrentUser(merchantId: string) {
  const customerId = await getCurrentCustomerId()
  if (!customerId) return null

  const supabase = createSupabaseServiceRoleClient()
  const { data: membership, error: membershipError } = await supabase
    .from("customer_memberships")
    .select("id, current_stamp_count, total_rewards_redeemed")
    .eq("merchant_id", merchantId)
    .eq("customer_id", customerId)
    .maybeSingle()

  if (membershipError) {
    throw new Error(`Unable to load membership: ${membershipError.message}`)
  }

  return membership
}

export async function getCurrentCustomerId(): Promise<string | null> {
  const customer = await getCurrentCustomer()
  return customer?.id ?? null
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

function first<T>(value: T | T[]) {
  return Array.isArray(value) ? value[0] : value
}

function firstNullable<T>(value: T | T[] | null) {
  if (!value) return null
  return Array.isArray(value) ? value[0] : value
}
