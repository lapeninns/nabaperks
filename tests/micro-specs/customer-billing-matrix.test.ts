import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function mockCurrentCustomer(id = "customer-1") {
  vi.doMock("@/lib/customer/identity", () => ({
    firstOf: <T>(value: T | T[] | null) =>
      Array.isArray(value) ? value[0] : value,
    getCurrentCustomer: vi.fn(async () => ({
      id,
      authUserId: null,
      email: null,
      fullName: "Sam Taylor",
      dateOfBirth: "1990-01-01",
      phone: "Phone ending 3456",
      phoneLast4: "3456",
      phoneCountry: "GB",
      createdAt: "2026-06-13T12:00:00.000Z",
    })),
  }))
}

/**
 * Locks the customer billing policy as an explicit matrix so trialing / active /
 * past_due stay allowed while cancelled / suspended are blocked everywhere the
 * customer can see or act — matching the RPC (`issue_self_service_stamp` /
 * `redeem_self_service_reward` block `cancelled` and `suspended`).
 */
describe("customer billing policy matrix", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/customer/identity")
    vi.doUnmock("@/lib/supabase/server")
    vi.doUnmock("@/lib/analytics/events")
    vi.doUnmock("@/lib/security/rate-limit")
  })

  it("allows trialing, active and past_due but blocks cancelled and suspended", async () => {
    const { unavailableMessage } = await import("@/lib/customer/card")

    for (const status of ["trialing", "active", "past_due", null]) {
      expect(unavailableMessage("active", true, status)).toBeUndefined()
    }

    for (const status of ["cancelled", "suspended"]) {
      expect(unavailableMessage("active", true, status)).toBe(
        "This loyalty programme is unavailable at the moment."
      )
    }
  })

  it("keeps merchant status handling separate from billing status", async () => {
    const { unavailableMessage } = await import("@/lib/customer/card")

    // Merchant status problems win first and read differently from billing.
    expect(unavailableMessage("paused", true, "active")).toBe(
      "This merchant loyalty programme is not currently active."
    )
    expect(unavailableMessage("cancelled", true, "active")).toBe(
      "This merchant loyalty programme is not currently active."
    )
    // An inactive card is its own reason, independent of billing.
    expect(unavailableMessage("active", false, "active")).toBe(
      "This loyalty card is not currently active."
    )
  })

  it("marks a cancelled-billing card view unavailable in the card loader", async () => {
    vi.resetModules()
    mockCurrentCustomer()
    const supabase = createSupabaseMock({
      from: {
        customer_memberships: [
          {
            data: {
              id: "membership-1",
              merchant_id: "merchant-1",
              customer_id: "customer-1",
              current_stamp_count: 2,
              total_rewards_redeemed: 0,
              active_cycle_number: 1,
              merchants: {
                business_name: "The Bell",
                business_slug: "the-bell",
                status: "active",
              },
            },
            error: null,
          },
        ],
        loyalty_cards: [
          {
            data: {
              card_name: "Mystery Visit Card",
              stamps_required: 3,
              reward_name: "Surprise reward",
              reward_terms: "Reveals after three visits.",
              min_spend_pence: null,
              is_active: true,
            },
            error: null,
          },
        ],
        reward_events: [{ data: null, error: null }],
        billing_customers: [{ data: { status: "cancelled" }, error: null }],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getCustomerCardState } = await import("@/lib/customer/card")

    await expect(getCustomerCardState("membership-1")).resolves.toMatchObject({
      status: "ready",
      unavailableReason: "This loyalty programme is unavailable at the moment.",
      billingStatus: "cancelled",
    })
  })

  it("marks a cancelled-billing reward view unavailable in the reward loader", async () => {
    vi.resetModules()
    mockCurrentCustomer()
    const supabase = createSupabaseMock({
      from: {
        reward_events: [
          {
            data: {
              id: "reward-1",
              status: "unlocked",
              membership_id: "membership-1",
              merchant_id: "merchant-1",
              customer_id: "customer-1",
              created_at: "2026-06-06T12:00:00.000Z",
              redeemed_at: null,
              reward_name: "Cake slice",
              reward_terms: "Valid on one slice.",
              min_spend_pence: 500,
              redeemable_from: "2026-06-08",
              customer_memberships: {
                current_stamp_count: 3,
                total_rewards_redeemed: 0,
              },
              merchants: {
                business_name: "The Bell",
                business_slug: "the-bell",
                status: "active",
              },
              loyalty_cards: {
                card_name: "Mystery Visit Card",
                stamps_required: 3,
                reward_name: "Surprise reward",
                reward_terms: "Reveals after three visits.",
                min_spend_pence: null,
                is_active: true,
              },
            },
            error: null,
          },
        ],
        billing_customers: [{ data: { status: "cancelled" }, error: null }],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getCustomerRewardState } = await import("@/lib/customer/reward")

    await expect(getCustomerRewardState("reward-1")).resolves.toMatchObject({
      status: "ready",
      unavailableReason: "This loyalty programme is unavailable at the moment.",
      billingStatus: "cancelled",
    })
  })

  it("resolves a QR join context as unavailable when billing is cancelled", async () => {
    vi.resetModules()
    const recordProductEvent = vi.fn()
    const supabase = createSupabaseMock({
      from: {
        qr_codes: [
          {
            data: {
              id: "qr-row-1",
              qr_id: "qr-public",
              is_active: true,
              destination_type: "join",
              merchants: {
                id: "merchant-1",
                business_name: "The Bell",
                business_slug: "the-bell",
                email: "owner@example.test",
                phone: null,
                status: "active",
              },
              loyalty_cards: {
                id: "card-1",
                card_name: "Mystery Visit Card",
                reward_name: "Surprise reward",
                stamps_required: 3,
                reward_terms: "Reward reveals after three visits.",
                min_spend_pence: null,
                is_active: true,
              },
            },
            error: null,
          },
        ],
        billing_customers: [{ data: { status: "cancelled" }, error: null }],
      },
    })
    vi.doMock("@/lib/security/rate-limit", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/security/rate-limit")
      >("@/lib/security/rate-limit")
      return actual
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const { resolveQrForJoin } = await import("@/lib/customer/join")

    await expect(resolveQrForJoin("qr-public")).resolves.toMatchObject({
      available: false,
      merchant: { business_slug: "the-bell" },
    })
  })

  it("resolves a QR join context as unavailable when the merchant programme is paused", async () => {
    vi.resetModules()
    const recordProductEvent = vi.fn()
    const supabase = createSupabaseMock({
      from: {
        qr_codes: [
          {
            data: {
              id: "qr-row-1",
              qr_id: "qr-public",
              is_active: true,
              destination_type: "join",
              merchants: {
                id: "merchant-1",
                business_name: "The Bell",
                business_slug: "the-bell",
                email: "owner@example.test",
                phone: null,
                // Billing is healthy; only the merchant programme is paused.
                status: "paused",
              },
              loyalty_cards: {
                id: "card-1",
                card_name: "Mystery Visit Card",
                reward_name: "Surprise reward",
                stamps_required: 3,
                reward_terms: "Reward reveals after three visits.",
                min_spend_pence: null,
                is_active: true,
              },
            },
            error: null,
          },
        ],
        billing_customers: [{ data: { status: "active" }, error: null }],
      },
    })
    vi.doMock("@/lib/security/rate-limit", async () => {
      const actual = await vi.importActual<
        typeof import("@/lib/security/rate-limit")
      >("@/lib/security/rate-limit")
      return actual
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    vi.doMock("@/lib/analytics/events", () => ({ recordProductEvent }))
    const { resolveQrForJoin } = await import("@/lib/customer/join")

    await expect(resolveQrForJoin("qr-public")).resolves.toMatchObject({
      available: false,
      merchant: { business_slug: "the-bell" },
    })
  })

  it("treats a non-active merchant slug join as unavailable", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        merchants: [
          {
            data: {
              id: "merchant-1",
              business_name: "The Bell",
              business_slug: "the-bell",
              email: "owner@example.test",
              phone: null,
              status: "cancelled",
              loyalty_cards: {
                id: "card-1",
                card_name: "Mystery Visit Card",
                reward_name: "Surprise reward",
                stamps_required: 3,
                reward_terms: "Reward reveals after three visits.",
                min_spend_pence: null,
                is_active: true,
              },
            },
            error: null,
          },
        ],
        billing_customers: [{ data: { status: "active" }, error: null }],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))
    const { getMerchantJoinContext } = await import("@/lib/customer/join")

    await expect(getMerchantJoinContext("the-bell")).resolves.toMatchObject({
      available: false,
      merchant: { business_slug: "the-bell" },
    })
  })
})
