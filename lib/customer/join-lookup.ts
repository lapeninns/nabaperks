import "server-only"

import { revalidateTag } from "next/cache"

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
 * The merchant tag is revalidated with the "max" profile, so the first read
 * after a write is still served the previous row while it refreshes. That is
 * fine for names and terms but not for availability, so (QA BUG-041):
 *
 *  - a cached row that says "unavailable" is never trusted on its own:
 *    `lib/customer/join.ts` re-reads it live (`readQrJoinState`,
 *    `readMerchantJoinState`) before turning a customer away. This also
 *    covers writers that skip the tags (ops SQL) and the 60s time-based
 *    refresh, which is stale-while-revalidate as well;
 *  - writers that switch a QR or venue off or on also expire the
 *    join-availability tag (`expireJoinAvailability`) so the next scan waits
 *    for the new state instead of admitting one scan on the old one.
 *
 * Rate limiting and scan analytics stay in `lib/customer/join.ts`, outside
 * the cache, so a cache hit can neither skip the limiter nor drop the event.
 *
 * Nothing here may touch request-scoped Next APIs (headers, cookies, the
 * post-response scheduler): the loaders run inside `unstable_cache`, where
 * those are unavailable.
 */
export const JOIN_CONTEXT_CACHE_SECONDS = 60

/**
 * Bump when the shape of a stage-B row changes: the key then misses the
 * entries a previous deploy wrote, instead of serving a row the new code
 * cannot read. Stage A holds only identity, so it never needs this. v5 adds
 * the join-availability tag, which entries written before it do not carry.
 */
export const JOIN_CONTEXT_SHAPE = "v5"

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

export type JoinRewardPoolItemRow = {
  id: string
  created_at: string
  reward_terms: string
  requires_age_check: boolean
  reward_name: string
  is_active: boolean
  display_order: number | null
}

export type JoinLocationRow = {
  trading_day_starts_at: string
  venue_collection_windows: {
    isodow: number
    starts_at: string
    ends_at: string
    is_active: boolean
    reward_pool_items: JoinRewardPoolItemRow | JoinRewardPoolItemRow[] | null
  }[]
}

export type JoinLoyaltyCardRow = {
  location_id: string
  reward_expires_after_days: number | null
  merchant_locations: JoinLocationRow | JoinLocationRow[] | null
  minimum_spend_pence: number | null
  one_transaction_per_stamp: boolean
  id: string
  card_name: string
  stamps_required: number
  reward_terms: string
  is_active: boolean
  /** The venue's reward pool, embedded so the welcome pitch can name real
   *  examples of what the mystery draw can land on. */
  reward_pool_items?: JoinRewardPoolItemRow[] | null
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

// reward_pool_items reaches loyalty_cards through two foreign keys (a simple
// loyalty_card_id and a composite merchant/location/card context key), so
// the embed names the simple constraint explicitly; an unhinted embed is a
// PostgREST 300 that would turn every scan into "unavailable".
const CARD_COLUMNS =
  "id, location_id, card_name, stamps_required, reward_terms, reward_expires_after_days, merchant_locations!location_id(trading_day_starts_at), minimum_spend_pence, one_transaction_per_stamp, is_active, reward_pool_items!reward_pool_items_loyalty_card_id_fkey(reward_name, reward_terms, requires_age_check, is_active, display_order, id, created_at)"

const QR_JOIN_STATE_SELECT = `id, qr_id, is_active, destination_type, merchants(id, business_name, business_slug, email, phone, status, requires_billing, billing_customers(status)), loyalty_cards!loyalty_card_id(${CARD_COLUMNS})`

const MERCHANT_JOIN_STATE_SELECT = `id, business_name, business_slug, email, phone, status, requires_billing, billing_customers(status), loyalty_cards(${CARD_COLUMNS})`

const cacheOptions = { revalidateSeconds: JOIN_CONTEXT_CACHE_SECONDS }

export function joinAvailabilityCacheTag(merchantId: string) {
  return `join-availability:${merchantId}`
}

/**
 * Read-your-writes for a change to whether a venue's QR can be used (QR
 * paused or resumed, venue suspended or reinstated). Call it after the write,
 * beside the usual merchant revalidation. It expires only the stage-B join
 * rows, with no stale window, so the next scan reads the new state; the
 * merchant tag keeps its "max" profile for every other cached surface. A
 * separate tag, because two profiles for one tag in one request race.
 */
export function expireJoinAvailability(merchantId: string) {
  revalidateTag(joinAvailabilityCacheTag(merchantId), { expire: 0 })
}

function joinStateTags(merchantId: string) {
  return [merchantCacheTag(merchantId), joinAvailabilityCacheTag(merchantId)]
}

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
    () => readQrJoinState(merchantId, qrCodeId),
    ["qr-join-context", JOIN_CONTEXT_SHAPE, merchantId, qrCodeId],
    joinStateTags(merchantId),
    cacheOptions
  )
}

/** Stage B read without the cache, to confirm a cached "unavailable". */
export async function readQrJoinState(
  merchantId: string,
  qrCodeId: string
): Promise<QrJoinStateRow | null> {
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
    () => readMerchantJoinState(merchantId),
    ["merchant-join-context", JOIN_CONTEXT_SHAPE, merchantId],
    joinStateTags(merchantId),
    cacheOptions
  )
}

/** Stage B′ read without the cache, to confirm a cached "unavailable". */
export async function readMerchantJoinState(
  merchantId: string
): Promise<MerchantJoinStateRow | null> {
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
}
