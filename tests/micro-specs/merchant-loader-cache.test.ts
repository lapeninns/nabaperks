import { describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

const MERCHANT = { id: "merchant-1" } as const

function mockReactRequestCache() {
  vi.doMock("react", () => ({
    cache: (fn: () => Promise<unknown>) => {
      let cached: Promise<unknown> | undefined

      return () => {
        cached ??= fn()
        return cached
      }
    },
  }))
}

describe("merchant setup loader caching", () => {
  it("deduplicates QR setup loading within the React request cache seam", async () => {
    vi.resetModules()
    mockReactRequestCache()
    const getCurrentMerchant = vi.fn(async () => MERCHANT)
    const supabase = createSupabaseMock({
      from: {
        merchant_locations: [
          {
            data: {
              id: "location-1",
              name: "Main bar",
              address: "1 High Street",
              latitude: 51.5,
              longitude: -0.12,
              geofence_radius_meters: 150,
              require_geofence: true,
              geocoded_at: "2026-06-15T10:00:00.000Z",
            },
            error: null,
          },
        ],
        loyalty_cards: [
          {
            data: {
              id: "card-1",
              card_name: "Mystery Visit Card",
              reward_name: "Surprise reward",
              stamps_required: 3,
            },
            error: null,
          },
        ],
        reward_pool_items: [{ data: null, error: null, count: 2 }],
        qr_codes: [
          {
            data: {
              id: "qr-row-1",
              qr_id: "qr-public",
              destination_type: "join",
              is_active: true,
            },
            error: null,
          },
        ],
      },
    })
    const createSupabaseServerClient = vi.fn(async () => supabase.client)
    vi.doMock("@/lib/auth/session", () => ({ getCurrentMerchant }))
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }))
    const { getQrSetup } = await import("@/lib/merchant/qr-code")

    const [first, second] = await Promise.all([getQrSetup(), getQrSetup()])

    expect(second).toEqual(first)
    expect(first).toMatchObject({
      merchant: MERCHANT,
      location: { id: "location-1", name: "Main bar" },
      activeCard: { id: "card-1", card_name: "Mystery Visit Card" },
      activeRewardPoolItemCount: 2,
      qrCode: { id: "qr-row-1", qr_id: "qr-public" },
    })
    expect(getCurrentMerchant).toHaveBeenCalledTimes(1)
    expect(createSupabaseServerClient).toHaveBeenCalledTimes(1)
  })

  it("deduplicates loyalty card setup loading within the React request cache seam", async () => {
    vi.resetModules()
    mockReactRequestCache()
    const getCurrentMerchant = vi.fn(async () => MERCHANT)
    const supabase = createSupabaseMock({
      from: {
        merchant_locations: [
          {
            data: { id: "location-1", name: "Main bar" },
            error: null,
          },
        ],
        loyalty_cards: [
          {
            data: {
              id: "card-1",
              card_name: "Mystery Visit Card",
              stamps_required: 3,
              reward_name: "Surprise reward",
              reward_terms: "Complete 3 visits to reveal a surprise reward.",
              min_spend_pence: null,
              is_active: true,
            },
            error: null,
          },
        ],
        reward_pool_items: [
          {
            data: [
              {
                id: "pool-1",
                reward_name: "Coffee upgrade",
                reward_terms: "Valid on one hot drink.",
                min_spend_pence: 250,
                weight: 3,
                is_active: true,
                display_order: 1,
              },
            ],
            error: null,
          },
        ],
      },
    })
    const createSupabaseServerClient = vi.fn(async () => supabase.client)
    vi.doMock("@/lib/auth/session", () => ({ getCurrentMerchant }))
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }))
    const { getLoyaltyCardSetup } = await import(
      "@/lib/merchant/loyalty-card"
    )

    const [first, second] = await Promise.all([
      getLoyaltyCardSetup(),
      getLoyaltyCardSetup(),
    ])

    expect(second).toEqual(first)
    expect(first).toMatchObject({
      merchant: MERCHANT,
      location: { id: "location-1", name: "Main bar" },
      card: { id: "card-1", card_name: "Mystery Visit Card" },
      rewardPoolItems: [{ id: "pool-1", reward_name: "Coffee upgrade" }],
    })
    expect(getCurrentMerchant).toHaveBeenCalledTimes(1)
    expect(createSupabaseServerClient).toHaveBeenCalledTimes(1)
  })

  it("preserves null merchant setup without opening Supabase table queries", async () => {
    vi.resetModules()
    mockReactRequestCache()
    const getCurrentMerchant = vi.fn(async () => null)
    const createSupabaseServerClient = vi.fn()
    vi.doMock("@/lib/auth/session", () => ({ getCurrentMerchant }))
    vi.doMock("@/lib/supabase/server", () => ({ createSupabaseServerClient }))
    const { getQrSetup } = await import("@/lib/merchant/qr-code")
    const { getLoyaltyCardSetup } = await import(
      "@/lib/merchant/loyalty-card"
    )

    await expect(getQrSetup()).resolves.toEqual({
      merchant: null,
      location: null,
      activeCard: null,
      activeRewardPoolItemCount: 0,
      qrCode: null,
    })
    await expect(getLoyaltyCardSetup()).resolves.toEqual({
      merchant: null,
      location: null,
      card: null,
      rewardPoolItems: [],
    })
    expect(createSupabaseServerClient).not.toHaveBeenCalled()
  })

  it("keeps QR loader error messages specific when the location query fails", async () => {
    vi.resetModules()
    mockReactRequestCache()
    const getCurrentMerchant = vi.fn(async () => MERCHANT)
    const supabase = createSupabaseMock({
      from: {
        merchant_locations: [
          { data: null, error: { message: "location RLS blocked" } },
        ],
      },
    })
    vi.doMock("@/lib/auth/session", () => ({ getCurrentMerchant }))
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: vi.fn(async () => supabase.client),
    }))
    const { getQrSetup } = await import("@/lib/merchant/qr-code")

    await expect(getQrSetup()).rejects.toThrow(
      "Unable to load merchant location: location RLS blocked"
    )
  })
})
