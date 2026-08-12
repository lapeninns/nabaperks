import "server-only"

import { loyaltyAvailability } from "@/lib/customer/availability"
import { getCurrentCustomer } from "@/lib/customer/identity"
import { ukTodayIso } from "@/lib/customer/uk-calendar"
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server"

/**
 * Customer-side reads of discount-pass entitlements: one pass by id, and the
 * live list a customer holds.
 *
 * The pass is its own record, never a `reward_events` row: it has unlimited
 * uses inside its window, while a reward is single consumption. So this loader
 * sits beside `lib/customer/reward.ts` rather than inside it, and nothing here
 * touches the reward rail, `RewardSource` or `primary-reward.ts`.
 *
 * Ownership is proved here, once, before anything downstream mints a scan
 * token: `/pass/[entitlementId]/qr.png` gates on the result of this call and
 * only then asks Postgres for a code. `create_offer_pass_scan_token` re-proves
 * ownership under a row lock, so this is defence in depth rather than the only
 * check — but it is what lets the page render a calm state instead of an error.
 *
 * A pass is presentable on its own merits: it is in date, it has not been
 * withdrawn, and the venue can still honour it. Nothing outside those three
 * facts decides whether the customer sees a code. Pausing or ending a campaign
 * is the separate, product-level control, and it deliberately does not cancel
 * passes already issued — the entitlement rows keep their window and their
 * snapshotted terms either way.
 */

/** Mirrors the `OfferPassState` the loyalty primitive renders. */
export type CustomerOfferPassState =
  "active" | "not_started" | "expired" | "revoked"

export type CustomerOfferPass = {
  readonly entitlementId: string
  readonly membershipId: string
  readonly venueName: string
  readonly venueSlug: string
  readonly discountPercent: number
  readonly requiresIdCheck: boolean
  readonly extraTerms: string | null
  /** Inclusive window, as `YYYY-MM-DD` calendar dates. */
  readonly validFrom: string
  readonly validTo: string
  readonly state: CustomerOfferPassState
  /**
   * Why the venue cannot honour the pass right now (closed programme, card
   * switched off, billing lapsed) — independent of the pass's own state.
   */
  readonly unavailableReason: string | null
  /** True only when a scan code may be minted and presented right now. */
  readonly presentable: boolean
}

export type CustomerOfferPassResult =
  | { readonly status: "unauthenticated" | "unauthorized" | "not_found" }
  | {
      readonly status: "ready"
      readonly customerId: string
      readonly pass: CustomerOfferPass
    }

type EmbeddedBilling = { status: string | null }
type EmbeddedCard = { is_active: boolean | null }

type EmbeddedMerchant = {
  business_name: string | null
  business_slug: string | null
  status: string | null
  requires_billing: boolean | null
  billing_customers: EmbeddedBilling | EmbeddedBilling[] | null
  loyalty_cards: EmbeddedCard | EmbeddedCard[] | null
}

type EntitlementRow = {
  id: string
  customer_id: string
  membership_id: string
  discount_percent: number
  requires_id_check: boolean
  extra_terms: string | null
  status: string
  valid_from: string
  valid_to: string
  merchants: EmbeddedMerchant | EmbeddedMerchant[] | null
}

const ENTITLEMENT_COLUMNS =
  "id, customer_id, membership_id, discount_percent, requires_id_check, extra_terms, status, valid_from, valid_to, merchants(business_name, business_slug, status, requires_billing, billing_customers(status), loyalty_cards(is_active))"

export async function loadCustomerOfferPass(
  entitlementId: string
): Promise<CustomerOfferPassResult> {
  const customer = await getCurrentCustomer()
  if (!customer) return { status: "unauthenticated" }

  const supabase = createSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from("offer_discount_entitlements")
    .select(ENTITLEMENT_COLUMNS)
    .eq("id", entitlementId)
    .eq("customer_id", customer.id)
    .maybeSingle()

  if (error) {
    // A malformed id is a not-found, not a crash: this route is reachable from
    // a customer's own history and a stale link must land calmly.
    console.error("offer_discount_entitlements read failed", error)
    return { status: "not_found" }
  }

  if (!data) return { status: "not_found" }

  const row = data as EntitlementRow

  return {
    status: "ready",
    customerId: customer.id,
    pass: toCustomerOfferPass(row),
  }
}

/**
 * A customer holds a handful of passes at most — one per campaign they have
 * joined — so a small cap keeps a pathological account from turning the home
 * screen into an unbounded read. Ordered soonest-to-close, the cap keeps the
 * passes that matter first.
 */
const MAX_CUSTOMER_OFFER_PASSES = 20

/**
 * Every live pass the signed-in customer holds, soonest to close first. Feeds
 * the home screen's per-card rail.
 *
 * The filter is exactly `offer_discount_entitlements_live_idx`
 * (`(customer_id, valid_to) where status = 'active'`), so this is an index-only
 * range read rather than a scan of the customer's whole claim history.
 *
 * `status = 'active'` is the row's stored standing, not its presentability: a
 * pass whose window has not opened, or whose last day passed before the nightly
 * sweep ran, is still `active` here and comes back with a `not_started` or
 * `expired` state so the surface can say so plainly. A revoked or swept pass is
 * withdrawn rather than displayed — there is nothing left for the customer to
 * act on.
 */
export async function listCustomerOfferPasses(): Promise<
  readonly CustomerOfferPass[]
> {
  return listLivePasses(null)
}

/** The same live list, narrowed to the one card the customer is looking at. */
export async function listCustomerOfferPassesForMembership(
  membershipId: string
): Promise<readonly CustomerOfferPass[]> {
  return listLivePasses(membershipId)
}

async function listLivePasses(
  membershipId: string | null
): Promise<readonly CustomerOfferPass[]> {
  const customer = await getCurrentCustomer()
  if (!customer) return []

  const supabase = createSupabaseServiceRoleClient()
  // Scoped to the signed-in customer first, so a membership id lifted from a
  // URL can only ever narrow the customer's own passes, never widen them.
  const scoped = supabase
    .from("offer_discount_entitlements")
    .select(ENTITLEMENT_COLUMNS)
    .eq("customer_id", customer.id)
    .eq("status", "active")
  const filtered = membershipId
    ? scoped.eq("membership_id", membershipId)
    : scoped

  const { data, error } = await filtered
    .order("valid_to", { ascending: true })
    .limit(MAX_CUSTOMER_OFFER_PASSES)

  if (error) {
    // The rail is an addition to the card, never the card itself: a failed read
    // must leave the stamps and rewards standing rather than break the screen.
    console.error("offer_discount_entitlements list failed", error)
    return []
  }

  return ((data ?? []) as EntitlementRow[]).map(toCustomerOfferPass)
}

function toCustomerOfferPass(row: EntitlementRow): CustomerOfferPass {
  const merchant = first(row.merchants)
  const billingStatus =
    first(merchant?.billing_customers ?? null)?.status ?? null
  const availability = loyaltyAvailability({
    merchantStatus: merchant?.status ?? "",
    // The same test `create_offer_pass_scan_token` applies: a discount pass is
    // a promise against the venue, not against one card, so any active card at
    // the venue keeps it honourable.
    cardActive: hasActiveCard(merchant?.loyalty_cards ?? null),
    billingStatus,
    requiresBilling: merchant?.requires_billing === true,
  })
  const state = offerPassState(row.status, row.valid_from, row.valid_to)

  return {
    entitlementId: row.id,
    membershipId: row.membership_id,
    venueName: merchant?.business_name ?? "your venue",
    venueSlug: merchant?.business_slug ?? "",
    discountPercent: row.discount_percent,
    requiresIdCheck: row.requires_id_check,
    extraTerms: nonEmpty(row.extra_terms),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    state,
    unavailableReason: availability.message ?? null,
    presentable: state === "active" && availability.available,
  }
}

/**
 * The stored status is authoritative for `revoked`; the window decides the rest.
 * The sweep in `expire_and_purge_offer_campaigns` flips due rows to `expired`,
 * but a pass must read correctly the moment its last day passes rather than
 * whenever the next sweep runs, so the date is checked here too.
 */
function offerPassState(
  status: string,
  validFrom: string,
  validTo: string
): CustomerOfferPassState {
  if (status === "revoked") return "revoked"

  const today = ukTodayIso()
  if (today > validTo) return "expired"
  if (status === "expired") return "expired"
  if (today < validFrom) return "not_started"

  return status === "active" ? "active" : "expired"
}

function hasActiveCard(value: EmbeddedCard | EmbeddedCard[] | null): boolean {
  if (!value) return false
  const cards = Array.isArray(value) ? value : [value]
  return cards.some((card) => card.is_active === true)
}

function nonEmpty(value: string | null): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function first<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}
