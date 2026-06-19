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

function mockServiceRole(supabase: ReturnType<typeof createSupabaseMock>) {
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServiceRoleClient: vi.fn(() => supabase.client),
  }))
}

describe("reward redemption cycles — active-cycle read models", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/customer/identity")
    vi.doUnmock("@/lib/customer/uk-date")
    vi.doUnmock("@/lib/supabase/server")
  })

  it("limits a single card's stamp dates to the active cycle", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        stamp_events: [
          { data: [{ earned_business_date: "2026-06-14" }], error: null },
        ],
      },
    })
    mockServiceRole(supabase)

    const { getMembershipStampDisplayDates } =
      await import("@/lib/customer/card")

    const dates = await getMembershipStampDisplayDates("membership-1", 3, 2)

    expect(dates).toEqual(["14 JUN"])
    expect(supabase.queryCalls).toContainEqual({
      table: "stamp_events",
      method: "eq",
      args: ["cycle_number", 2],
    })
  })

  it("counts only active-cycle stamps per membership for the dashboard", async () => {
    vi.resetModules()
    const supabase = createSupabaseMock({
      from: {
        stamp_events: [
          {
            data: [
              {
                membership_id: "membership-1",
                earned_business_date: "2026-06-10",
                cycle_number: 1,
              },
              {
                membership_id: "membership-1",
                earned_business_date: "2026-06-11",
                cycle_number: 1,
              },
              {
                membership_id: "membership-1",
                earned_business_date: "2026-06-12",
                cycle_number: 1,
              },
              {
                membership_id: "membership-1",
                earned_business_date: "2026-06-14",
                cycle_number: 2,
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockServiceRole(supabase)

    const { getMembershipStampDisplayDatesByMembership } =
      await import("@/lib/customer/card")

    const result = await getMembershipStampDisplayDatesByMembership(
      ["membership-1"],
      12,
      new Map([["membership-1", 2]])
    )

    expect(result.get("membership-1")).toEqual({
      stampDates: ["14 JUN"],
      latestBusinessDate: "2026-06-14",
    })
  })

  it("resets home card progress to the new cycle after a redemption", async () => {
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
                active_cycle_number: 2,
                last_visit_at: "2026-06-14T09:00:00.000Z",
                merchants: {
                  business_name: "Old Crown Girton",
                  business_slug: "old-crown-girton",
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
        // No unlocked reward after redemption.
        reward_events: [{ data: [], error: null }],
        billing_customers: [
          {
            data: [{ merchant_id: "merchant-1", status: "active" }],
            error: null,
          },
        ],
        // Three stamps remain on record, but they all belong to cycle 1.
        stamp_events: [
          {
            data: [
              {
                membership_id: "membership-1",
                earned_business_date: "2026-06-11",
                cycle_number: 1,
              },
              {
                membership_id: "membership-1",
                earned_business_date: "2026-06-12",
                cycle_number: 1,
              },
              {
                membership_id: "membership-1",
                earned_business_date: "2026-06-13",
                cycle_number: 1,
              },
            ],
            error: null,
          },
        ],
        product_events: [{ data: [], error: null }],
      },
    })
    mockServiceRole(supabase)

    const { getCustomerHomeDashboard } = await import("@/lib/customer/home")

    const dashboard = await getCustomerHomeDashboard()

    expect(dashboard.cards[0]).toEqual(
      expect.objectContaining({
        currentStamps: 0,
        stampsRemaining: 3,
        stampDates: [],
      })
    )
    expect(dashboard.cards[0].primaryRewardId).toBeUndefined()
    expect(dashboard.summary).toEqual({
      cardCount: 1,
      redeemableCount: 0,
      stampAvailableCount: 1,
    })
    expect(dashboard.topRedeemable).toBeUndefined()
  })

  it("renders the active card as empty after a redemption, filtered by cycle", async () => {
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
              current_stamp_count: 0,
              total_rewards_redeemed: 1,
              active_cycle_number: 2,
              merchants: {
                business_name: "Old Crown Girton",
                business_slug: "old-crown-girton",
                status: "active",
              },
            },
            error: null,
          },
        ],
        loyalty_cards: [
          {
            data: {
              card_name: "Morning Ritual",
              stamps_required: 3,
              reward_name: "Surprise reward",
              reward_terms: "Reveals after the final stamp.",
              min_spend_pence: null,
              is_active: true,
            },
            error: null,
          },
        ],
        reward_events: [{ data: null, error: null }],
        billing_customers: [{ data: { status: "active" }, error: null }],
        // The active cycle (2) has no stamps yet.
        stamp_events: [{ data: [], error: null }],
      },
    })
    mockServiceRole(supabase)

    const { loadCardExperienceContext } =
      await import("@/lib/customer/experience/load-card")

    const context = await loadCardExperienceContext("membership-1", {})

    expect(context).toMatchObject({
      current: 0,
      total: 3,
      stampDates: [],
      reward: null,
    })
    expect(supabase.queryCalls).toContainEqual({
      table: "stamp_events",
      method: "eq",
      args: ["cycle_number", 2],
    })
  })

  it("still stages a ready reward at full progress within the active cycle", async () => {
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
            data: {
              id: "membership-1",
              merchant_id: "merchant-1",
              customer_id: "customer-1",
              current_stamp_count: 3,
              total_rewards_redeemed: 0,
              active_cycle_number: 1,
              merchants: {
                business_name: "Old Crown Girton",
                business_slug: "old-crown-girton",
                status: "active",
              },
            },
            error: null,
          },
        ],
        loyalty_cards: [
          {
            data: {
              card_name: "Morning Ritual",
              stamps_required: 3,
              reward_name: "Surprise reward",
              reward_terms: "Reveals after the final stamp.",
              min_spend_pence: null,
              is_active: true,
            },
            error: null,
          },
        ],
        reward_events: [
          {
            data: {
              id: "reward-1",
              status: "unlocked",
              reward_name: "Free coffee",
              reward_terms: "On the house.",
              min_spend_pence: null,
              redeemable_from: "2026-06-13",
            },
            error: null,
          },
        ],
        billing_customers: [{ data: { status: "active" }, error: null }],
        stamp_events: [
          {
            data: [
              { earned_business_date: "2026-06-11" },
              { earned_business_date: "2026-06-12" },
              { earned_business_date: "2026-06-13" },
            ],
            error: null,
          },
        ],
      },
    })
    mockServiceRole(supabase)

    const { loadCardExperienceContext } =
      await import("@/lib/customer/experience/load-card")

    const context = await loadCardExperienceContext("membership-1", {})

    expect(context).toMatchObject({
      current: 3,
      total: 3,
      reward: { id: "reward-1", redeemable: true },
    })
  })

  it("keeps redeemed rewards in history without any cycle filter", async () => {
    vi.resetModules()
    mockCurrentCustomer()
    vi.doMock("@/lib/customer/uk-date", () => ({
      isRedeemableFrom: (redeemableFrom: string | null) =>
        !redeemableFrom || redeemableFrom <= "2026-06-14",
    }))
    const supabase = createSupabaseMock({
      from: {
        reward_events: [
          {
            data: [
              {
                id: "reward-old",
                membership_id: "membership-1",
                status: "redeemed",
                reward_name: "Free pint",
                reward_terms: "On the house.",
                min_spend_pence: null,
                redeemable_from: "2026-06-10",
                redeemed_at: "2026-06-11T10:00:00.000Z",
                created_at: "2026-06-10T10:00:00.000Z",
                merchants: { business_name: "Old Crown Girton" },
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockServiceRole(supabase)

    const { getCustomerRewards } = await import("@/lib/customer/rewards")

    const rewards = await getCustomerRewards()

    expect(rewards.redeemed.map((reward) => reward.rewardId)).toEqual([
      "reward-old",
    ])
    expect(
      supabase.queryCalls.some(
        (call) =>
          call.table === "reward_events" &&
          call.method === "eq" &&
          call.args[0] === "cycle_number"
      )
    ).toBe(false)
  })
})

describe("reward redemption cycle SQL contract", () => {
  it("defines durable cycle fields and updates the redemption RPC", async () => {
    const { readFileSync } = await import("node:fs")
    const migration = readFileSync(
      "supabase/migrations/20260615130000_reward_redemption_cycles.sql",
      "utf8"
    )

    expect(migration).toContain(
      "add column if not exists active_cycle_number integer not null default 1"
    )
    expect(migration).toMatch(/stamp_events[\s\S]*cycle_number integer/)
    expect(migration).toMatch(/reward_events[\s\S]*cycle_number integer/)
    expect(migration).toContain("active_cycle_number = active_cycle_number + 1")
    expect(migration).toContain("function public.issue_self_service_stamp")
    expect(migration).toContain("function public.redeem_self_service_reward")
    // The merged redemption RPC must keep the profile-completion gate.
    expect(migration).toContain("Complete your profile before redeeming")
  })

  it("pins first-cycle unlocks to the default advertised reward", async () => {
    const { readFileSync } = await import("node:fs")
    const migration = readFileSync(
      "supabase/migrations/20260616101500_first_cycle_default_reward.sql",
      "utf8"
    )

    expect(migration).toContain("function public.issue_self_service_stamp")
    expect(migration).toContain("membership_record.active_cycle_number = 1")
    expect(migration).toContain("order by reward_pool_items.display_order asc")
    expect(migration).toContain(
      "v_weight_threshold := floor(random() * v_total_weight)"
    )
  })

  it("requires at least 3 active rewards before an unlock can happen", async () => {
    const { readFileSync } = await import("node:fs")
    const migration = readFileSync(
      "supabase/migrations/20260616103000_minimum_three_rewards.sql",
      "utf8"
    )

    expect(migration).toContain("function public.issue_self_service_stamp")
    expect(migration).toContain("v_active_reward_count integer := 0")
    expect(migration).toContain("v_active_reward_count < 3")
    expect(migration).toContain(
      "At least 3 active reward pool items are required before unlocking a reward"
    )
  })
})
