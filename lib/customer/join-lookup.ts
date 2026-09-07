import "server-only"

import { cacheByScope, merchantCacheTag } from "@/lib/cache/tags"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Cached, side-effect-free reads behind the customer join surfaces.
 *
 * `/q/[qrId]`, the join wizard and its actions all need the same answer —
 * which merchant and card a QR points at, and whether they are live — and
 * used to read it from Postgres on every hop. These loaders answer from the
 * data cache instead, in two stages:
 *
 *  - stage A holds only immutable identity (`qr_codes.id` + `merchant_id`,
 *    or slug → merchant id), so it needs no invalidation tag;
 *  - stage B holds every mutable field (QR active flag, card, merchant status,
 *    billing) under the merchant cache tag, which every merchant, admin and
 *    Stripe writer already revalidates via `revalidateMerchantLaunchSurfaces`.
 *
 * The 60s window bounds anything that bypasses the tag (ops-only SQL). Rate
 * limiting and scan analytics stay in `lib/customer/join.ts`, outside the
 * cache, so a cache hit can neither skip the limiter nor drop the event.
 *
 * Nothing here may touch request-scoped Next APIs (headers, cookies, the
 * post-response scheduler): the loaders run inside `unstable_cache`, where
 * those are unavailable.
 */
export const JOIN_CONTEXT_CACHE_SECONDS = 60

export type QrIdentity = {
  qrCodeId: string
  merchantId: string
}

export type MerchantIdentity = {
  merchantId: string
}

export type BillingCustomerEmbed =
  { status: string | null } | Array<{ status: string | null }> | null

export type JoinMerchantRow = {
  id: string
  business_name: string
  business_slug: string
  email: string
  phone: string | null
  status: string
  requires_billing: boolean
  billing_customers: BillingCustomerEmbed
}

export type JoinLoyaltyCardRow = {
  id: string
  card_name: string
  stamps_required: number
  reward_terms: string
  is_active: boolean
}

export type QrJoinStateRow = {
  id: string
  qr_id: string
  is_active: boolean
  destination_type: string
  merchants: JoinMerchantRow | JoinMerchantRow[]
  loyalty_cards: JoinLoyaltyCardRow | JoinLoyaltyCardRow[]
}

export type MerchantJoinStateRow = Omit<JoinMerchantRow, "id"> & {
  id: string
  loyalty_cards: JoinLoyaltyCardRow | JoinLoyaltyCardRow[] | null
}

const QR_JOIN_STATE_SELECT =
  "id, qr_id, is_active, destination_type, merchants(id, business_name, business_slug, email, phone, status, requires_billing, billing_customers(status)), loyalty_cards!loyalty_card_id(id, card_name, stamps_required, reward_terms, is_active)"

const MERCHANT_JOIN_STATE_SELECT =
  "id, business_name, business_slug, email, phone, status, requires_billing, billing_customers(status), loyalty_cards(id, card_name, stamps_required, reward_terms, is_active)"

const cacheOptions = { revalidateSeconds: JOIN_CONTEXT_CACHE_SECONDS }

/** Stage A: public QR id → immutable row identity. */
export function loadQrIdentity(qrId: string): Promise<QrIdentity | null> {
  return cacheByScope(
    async () => {
      const supabase = createSupabaseServiceRoleClient()
      const { data, error } = await supabase
        .from("qr_codes")
        .select("id, merchant_id")
        .eq("qr_id", qrId)
        .maybeSingle()

      if (error) {
        throw new Error(`Unable to resolve QR code: ${error.message}`)
      }
      if (!data) return null

      return { qrCodeId: data.id, merchantId: data.merchant_id }
    },
    ["qr-code-identity", qrId],
    [],
    cacheOptions
  )
}

/** Stage B: the QR's live state, merchant, card and billing, by row identity. */
export function loadQrJoinState(
  merchantId: string,
  qrCodeId: string
): Promise<QrJoinStateRow | null> {
  return cacheByScope(
    async () => {
      const supabase = createSupabaseServiceRoleClient()
      const { data, error } = await supabase
        .from("qr_codes")
        .select(QR_JOIN_STATE_SELECT)
        .eq("id", qrCodeId)
        .eq("merchant_id", merchantId)
        .maybeSingle()

      if (error) {
        throw new Error(`Unable to resolve QR code: ${error.message}`)
      }

      return (data as QrJoinStateRow | null) ?? null
    },
    ["qr-join-context", merchantId, qrCodeId],
    [merchantCacheTag(merchantId)],
    cacheOptions
  )
}

/** Stage A′: public merchant slug → merchant id. */
export function loadMerchantIdBySlug(
  merchantSlug: string
): Promise<MerchantIdentity | null> {
  return cacheByScope(
    async () => {
      const supabase = createSupabaseServiceRoleClient()
      const { data, error } = await supabase
        .from("merchants")
        .select("id")
        .eq("business_slug", merchantSlug)
        .maybeSingle()

      if (error) {
        throw new Error(`Unable to load merchant join page: ${error.message}`)
      }
      if (!data) return null

      return { merchantId: data.id }
    },
    ["merchant-id-by-slug", merchantSlug],
    [],
    cacheOptions
  )
}

/** Stage B′: the merchant's live state, active card and billing, by id. */
export function loadMerchantJoinState(
  merchantId: string
): Promise<MerchantJoinStateRow | null> {
  return cacheByScope(
    async () => {
      const supabase = createSupabaseServiceRoleClient()
      const { data, error } = await supabase
        .from("merchants")
        .select(MERCHANT_JOIN_STATE_SELECT)
        .eq("id", merchantId)
        .eq("loyalty_cards.is_active", true)
        .maybeSingle()

      if (error) {
        throw new Error(`Unable to load merchant join page: ${error.message}`)
      }

      return (data as MerchantJoinStateRow | null) ?? null
    },
    ["merchant-join-context", merchantId],
    [merchantCacheTag(merchantId)],
    cacheOptions
  )
}
