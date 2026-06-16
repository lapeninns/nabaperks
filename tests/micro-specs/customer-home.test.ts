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
      phone: "Phone ending 3456",
      phoneLast4: "3456",
      phoneCountry: "GB",
      createdAt: "2026-06-13T12:00:00.000Z",
    })),
  }))
}

describe("customer home dashboard", () => {
  afterEach(() => {
    vi.resetModules()
    vi.doUnmock("@/lib/customer/identity")
    vi.doUnmock("@/lib/customer/uk-date")
    vi.doUnmock("@/lib/supabase/server")
  })

  it("sorts redeemable cards above cards collecting today", async () => {
    const { sortHomeCards } = await import("@/lib/customer/home-dashboard")

    const sorted = sortHomeCards([
      {
        membershipId: "collecting",
        businessName: "Collecting Cafe",
        businessSlug: "collecting-cafe",
        cardName: "Visits",
        rewardName: "Coffee",
        currentStamps: 2,
        stampsRequired: 3,
        stampDates: ["12 Jun", "13 Jun"],
        stampedToday: false,
        lastVisitAt: "2026-06-13T10:00:00.000Z",
        stampsRemaining: 1,
        unlockedRewards: 0,
        redeemableRewards: 0,
        available: true,
      },
      {
        membershipId: "ready",
        businessName: "Ready Cafe",
        businessSlug: "ready-cafe",
        cardName: "Visits",
        rewardName: "Coffee",
        currentStamps: 3,
        stampsRequired: 3,
        stampDates: ["11 Jun", "12 Jun", "13 Jun"],
        stampedToday: true,
        lastVisitAt: "2026-06-12T10:00:00.000Z",
        stampsRemaining: 0,
        unlockedRewards: 1,
        redeemableRewards: 1,
        primaryRewardId: "reward-1",
        available: true,
      },
    ])

    expect(sorted.map((card) => card.membershipId)).toEqual([
      "ready",
      "collecting",
    ])
  })

  it("builds summary counts from redeemable and stamp-available cards", async () => {
    const { buildHomeSummary } = await import("@/lib/customer/home-dashboard")

    const summary = buildHomeSummary([
      {
        membershipId: "ready",
        businessName: "Ready Cafe",
        businessSlug: "ready-cafe",
        cardName: null,
        rewardName: "Coffee",
        currentStamps: 3,
        stampsRequired: 3,
        stampDates: ["11 Jun", "12 Jun", "13 Jun"],
        stampedToday: true,
        lastVisitAt: "2026-06-13T10:00:00.000Z",
        stampsRemaining: 0,
        unlockedRewards: 1,
        redeemableRewards: 1,
        primaryRewardId: "reward-1",
        available: true,
      },
      {
        membershipId: "available",
        businessName: "Available Cafe",
        businessSlug: "available-cafe",
        cardName: null,
        rewardName: "Coffee",
        currentStamps: 1,
        stampsRequired: 3,
        stampDates: ["12 Jun"],
        stampedToday: false,
        lastVisitAt: "2026-06-12T10:00:00.000Z",
        stampsRemaining: 2,
        unlockedRewards: 0,
        redeemableRewards: 0,
        available: true,
      },
    ])

    expect(summary).toEqual({
      cardCount: 2,
      redeemableCount: 1,
      stampAvailableCount: 1,
    })
  })

  it("returns status copy for redeemable, stamped, collecting, and unavailable cards", async () => {
    const { homeCardStatusCopy } = await import("@/lib/customer/home-dashboard")
    const baseCard = {
      membershipId: "card-1",
      businessName: "Bean & Batch",
      businessSlug: "bean-and-batch",
      cardName: "Visits",
      rewardName: "Coffee",
      currentStamps: 1,
      stampsRequired: 3,
      stampDates: ["12 Jun"],
      stampedToday: false,
      lastVisitAt: null,
      stampsRemaining: 2,
      unlockedRewards: 0,
      redeemableRewards: 0,
      available: true,
    }

    expect(
      homeCardStatusCopy({
        ...baseCard,
        primaryRewardId: "reward-1",
        redeemableRewards: 1,
      })
    ).toBe("Reward ready - show QR at the counter")
    expect(homeCardStatusCopy({ ...baseCard, stampedToday: true })).toBe(
      "Stamp secured for today"
    )
    expect(homeCardStatusCopy(baseCard)).toBe(
      "1 of 3 stamps - 2 more to unlock"
    )
    expect(
      homeCardStatusCopy({
        ...baseCard,
        available: false,
        unavailableReason: "This loyalty card is not currently active.",
      })
    ).toBe("This loyalty card is not currently active.")
  })

  it("surfaces a waiting reward distinctly from stamped-today and progress copy", async () => {
    const { homeCardStatusCopy } = await import("@/lib/customer/home-dashboard")
    const waitingCard = {
      membershipId: "card-1",
      businessName: "Bean & Batch",
      businessSlug: "bean-and-batch",
      cardName: "Visits",
      rewardName: "Coffee",
      currentStamps: 3,
      stampsRequired: 3,
      stampDates: ["11 Jun", "12 Jun", "13 Jun"],
      stampedToday: true,
      lastVisitAt: null,
      stampsRemaining: 0,
      unlockedRewards: 1,
      redeemableRewards: 0,
      available: true,
    }

    // A waiting reward must not be hidden behind "Stamp secured for today".
    const stampedToday = homeCardStatusCopy(waitingCard)
    expect(stampedToday).not.toBe("Stamp secured for today")
    expect(stampedToday.toLowerCase()).toContain("reward")
    expect(stampedToday).not.toMatch(/tomorrow/i)

    // And not behind plain stamp-progress copy when not stamped today.
    const notStamped = homeCardStatusCopy({
      ...waitingCard,
      stampedToday: false,
      currentStamps: 3,
    })
    expect(notStamped.toLowerCase()).toContain("reward")
  })

  it("reconciles home card progress from stamp events when membership count lags", async () => {
    vi.resetModules()
    mockCurrentCustomer()
    vi.doMock("@/lib/customer/uk-date", () => ({
      isRedeemableFrom: (redeemableFrom: string | null) =>
        !redeemableFrom || redeemableFrom <= "2026-06-14",
      ukTodayIso: () => "2026-06-14",
    }))
    const supabase = createSupabaseMock({
      from: {
        customer_memberships: [
          {
            data: [
              {
                id: "membership-1",
                merchant_id: "merchant-1",
                current_stamp_count: 0,
                last_visit_at: "2026-06-14T09:00:00.000Z",
                merchants: {
                  business_name: "Bean & Batch",
                  business_slug: "bean-and-batch",
                  status: "active",
                },
              },
            ],
            error: null,
          },
        ],
        loyalty_cards: [
          {
            data: [
              {
                merchant_id: "merchant-1",
                card_name: "Morning visits",
                stamps_required: 3,
                reward_name: "Free coffee",
                is_active: true,
              },
            ],
            error: null,
          },
        ],
        reward_events: [
          {
            data: [
              {
                id: "reward-1",
                membership_id: "membership-1",
                reward_name: "Free coffee",
                redeemable_from: "2026-06-14",
              },
            ],
            error: null,
          },
        ],
        billing_customers: [
          {
            data: [{ merchant_id: "merchant-1", status: "active" }],
            error: null,
          },
        ],
        stamp_events: [
          {
            data: [
              {
                membership_id: "membership-1",
                earned_business_date: "2026-06-14",
              },
            ],
            error: null,
          },
        ],
        product_events: [{ data: [], error: null }],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
    }))

    const { getCustomerHomeDashboard } = await import("@/lib/customer/home")

    const dashboard = await getCustomerHomeDashboard()

    expect(dashboard.cards[0]).toEqual(
      expect.objectContaining({
        currentStamps: 1,
        stampDates: ["14 JUN"],
        stampedToday: true,
        stampsRemaining: 2,
        primaryRewardId: "reward-1",
      })
    )
    expect(dashboard.summary).toEqual({
      cardCount: 1,
      redeemableCount: 1,
      stampAvailableCount: 0,
    })
    expect(dashboard.topRedeemable).toEqual({
      rewardId: "reward-1",
      rewardName: "Free coffee",
      businessName: "Bean & Batch",
      membershipId: "membership-1",
    })
  })
})
