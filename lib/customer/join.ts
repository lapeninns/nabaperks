import "server-only"

import { after } from "next/server"

import { recordProductEvent } from "@/lib/analytics/events"
import { loyaltyAvailability } from "@/lib/customer/availability"
import { getCurrentCustomer } from "@/lib/customer/identity"
import {
  loadMerchantIdBySlug,
  loadMerchantJoinState,
  loadQrIdentity,
  loadQrJoinState,
  type JoinLoyaltyCardRow,
} from "@/lib/customer/join-lookup"
import { rewardExamplesFromPool } from "@/lib/customer/reward-examples"
import { enforceQrScanRateLimit } from "@/lib/customer/qr-rate-limit"
import { isValidPublicQrId } from "@/lib/customer/qr-rate-limit-core"
import { logger } from "@/lib/observability/logger"
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
    /** Active reward-pool names in display order — examples of the draw,
     *  never a promise of one reward. */
    reward_examples: string[]
  }
}

type ResolveQrForJoinOptions = {
  enforceScanRateLimit?: boolean
  recordScan?: boolean
  scanRateLimitIdentity?: string
  /** Optional channel tag from ?src= on the share URL (nfc | qr). */
  scanSource?: string | null
}

/**
 * Resolve a public QR id to its merchant, card and availability.
 *
 * The lookup itself is served from the data cache (`lib/customer/join-lookup.ts`)
 * so the join wizard, its actions and the stamp page do not each re-read
 * Postgres. The scan rate limiter and the `qr_scanned` event stay here, in
 * front of and after the cached read: `/q/[qrId]` is the only caller that
 * enables them, so one physical scan is one admission and one event.
 */
export async function resolveQrForJoin(
  qrId: string,
  {
    enforceScanRateLimit = true,
    recordScan = true,
    scanRateLimitIdentity = "anonymous",
    scanSource = null,
  }: ResolveQrForJoinOptions = {}
) {
  if (!isValidPublicQrId(qrId)) return null

  if (enforceScanRateLimit) {
    await enforceQrScanRateLimit({ qrId, identity: scanRateLimitIdentity })
  }

  const identity = await loadQrIdentity(qrId)
  if (!identity) return null

  const qrCode = await loadQrJoinState(identity.merchantId, identity.qrCodeId)
  if (!qrCode) return null

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
            ...(scanSource ? { src: scanSource } : {}),
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
    loyaltyCard: joinLoyaltyCard(loyaltyCard),
  } satisfies CustomerJoinContext
}

/**
 * Join context for the wizard, its actions and the public merchant pages.
 * Never rate-limits and never records a scan: those belong to the physical
 * scan on `/q/[qrId]`, and every read here is a cache hit behind it.
 */
export async function getMerchantJoinContext(
  merchantSlug: string,
  qrId?: string
) {
  if (qrId) {
    const qrContext = await resolveQrForJoin(qrId, {
      enforceScanRateLimit: false,
      recordScan: false,
    })

    if (!qrContext) return null
    if (qrContext.merchant.business_slug !== merchantSlug) return null
    return qrContext
  }

  const identity = await loadMerchantIdBySlug(merchantSlug)
  if (!identity) return null

  const data = await loadMerchantJoinState(identity.merchantId)
  if (!data) return null
  if (data.business_slug !== merchantSlug) return null

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
    loyaltyCard: joinLoyaltyCard(loyaltyCard),
  } satisfies CustomerJoinContext
}

function joinLoyaltyCard(card: JoinLoyaltyCardRow) {
  return {
    id: card.id,
    card_name: card.card_name,
    stamps_required: card.stamps_required,
    reward_terms: card.reward_terms,
    reward_examples: rewardExamplesFromPool(card.reward_pool_items),
  }
}

export async function getMembershipForCustomer(
  merchantId: string,
  customerId: string
) {
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

export async function getExistingMembershipForCurrentUser(merchantId: string) {
  const customerId = await getCurrentCustomerId()
  if (!customerId) return null

  return getMembershipForCustomer(merchantId, customerId)
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
