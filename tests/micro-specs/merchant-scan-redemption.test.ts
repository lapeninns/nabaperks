import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function mockSupabase(mock: ReturnType<typeof createSupabaseMock>) {
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: async () => mock.client,
    createSupabaseServiceRoleClient: () => mock.client,
  }))
}

function mockCurrentCustomer() {
  vi.doMock("@/lib/customer/identity", () => ({
    getCurrentCustomer: vi.fn(async () => ({
      id: "customer-1",
      authUserId: "customer-auth-1",
      email: null,
      phone: "Phone ending 2453",
      phoneLast4: "2453",
      phoneCountry: "GB",
      createdAt: "2026-06-15T08:00:00.000Z",
    })),
  }))
}

function mockCurrentMerchant() {
  vi.doMock("@/lib/auth/session", () => ({
    getCurrentMerchant: vi.fn(async () => ({
      id: "merchant-1",
      business_name: "Bean & Batch",
      business_slug: "bean-and-batch",
      email: "merchant@example.test",
      status: "active",
    })),
    getCurrentUser: vi.fn(async () => ({ id: "merchant-auth-1" })),
  }))
}

describe("04 merchant-scan reward redemption", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/supabase/server")
    vi.doUnmock("@/lib/customer/identity")
    vi.doUnmock("@/lib/auth/session")
    vi.doUnmock("next/navigation")
  })

  it("issues one customer-owned redemption token for a redeemable reward", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        create_redemption_token: [
          {
            data: [
              {
                token_id: "token-row-1",
                public_token: "RDM38E5DB51",
                expires_at: "2026-06-15T08:10:00.000Z",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)
    mockCurrentCustomer()

    const { createRedemptionToken } =
      await import("@/lib/customer/redemption-token")
    const token = await createRedemptionToken("reward-1")

    expect(token).toEqual({
      tokenId: "token-row-1",
      publicToken: "RDM38E5DB51",
      expiresAt: "2026-06-15T08:10:00.000Z",
    })
    expect(mock.rpcCalls[0]).toEqual({
      name: "create_redemption_token",
      params: {
        p_reward_event_id: "reward-1",
        p_customer_id: "customer-1",
      },
    })
  })

  it("polls reward token status without a realtime dependency", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        get_redemption_token_status: [
          {
            data: [
              {
                status: "consumed",
                consumed_at: "2026-06-15T08:02:00.000Z",
                reward_name: "Coffee and cake",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)
    mockCurrentCustomer()

    const { getRedemptionTokenStatus } =
      await import("@/lib/customer/redemption-token")
    const status = await getRedemptionTokenStatus("reward-1")

    expect(status).toEqual({
      status: "consumed",
      consumedAt: "2026-06-15T08:02:00.000Z",
      rewardName: "Coffee and cake",
    })
    expect(mock.rpcCalls[0]).toEqual({
      name: "get_redemption_token_status",
      params: {
        p_reward_event_id: "reward-1",
        p_customer_id: "customer-1",
      },
    })
  })

  it("lets the current merchant preview and consume a scanned token", async () => {
    vi.resetModules()
    const mock = createSupabaseMock({
      rpc: {
        lookup_redemption_token_for_merchant: [
          {
            data: [
              {
                status: "ready",
                reward_event_id: "reward-1",
                reward_name: "Coffee and cake",
                reward_terms: "One per card.",
                customer_label: "Phone ending 2453",
                expires_at: "2026-06-15T08:10:00.000Z",
              },
            ],
            error: null,
          },
        ],
        consume_redemption_token: [
          {
            data: [
              {
                status: "redeemed",
                reward_event_id: "reward-1",
                reward_name: "Coffee and cake",
                membership_id: "membership-1",
                new_stamp_count: 0,
                consumed_at: "2026-06-15T08:03:00.000Z",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabase(mock)
    mockCurrentMerchant()

    const { consumeRedemptionToken, lookupRedemptionToken } =
      await import("@/lib/merchant/redeem")

    await expect(
      lookupRedemptionToken("https://app.test/r/RDM38E5DB51")
    ).resolves.toMatchObject({
      status: "ready",
      publicToken: "RDM38E5DB51",
      rewardName: "Coffee and cake",
      customerLabel: "Phone ending 2453",
    })
    await expect(consumeRedemptionToken("RDM38E5DB51")).resolves.toMatchObject({
      status: "redeemed",
      rewardId: "reward-1",
      membershipId: "membership-1",
      consumedAt: "2026-06-15T08:03:00.000Z",
    })

    expect(mock.rpcCalls).toEqual([
      {
        name: "lookup_redemption_token_for_merchant",
        params: {
          p_public_token: "RDM38E5DB51",
          p_merchant_id: "merchant-1",
        },
      },
      {
        name: "consume_redemption_token",
        params: {
          p_public_token: "RDM38E5DB51",
          p_merchant_id: "merchant-1",
        },
      },
    ])
  })

  it("routes public redeem QR URLs into the merchant console scanner", async () => {
    vi.resetModules()
    const redirect = vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    mockCurrentMerchant()

    const { default: RedeemTokenPage } = await import("@/app/r/[token]/page")

    await expect(
      RedeemTokenPage({ params: Promise.resolve({ token: "RDM38E5DB51" }) })
    ).rejects.toThrow("NEXT_REDIRECT:/app/redeem?token=RDM38E5DB51")
  })

  it("keeps customer reward UI display-only and exposes merchant scanner entry points", () => {
    const shell = readProjectFile("components/layout/merchant-app-shell.tsx")
    const customerExperience = readProjectFile(
      "components/customer/customer-card-experience.tsx"
    )
    const rewardActions = readProjectFile("app/reward/[rewardId]/actions.ts")
    const migration = readProjectFile(
      "supabase/migrations/20260615090000_redemption_tokens.sql"
    )

    expect(shell).toContain('href: "/app/redeem"')
    expect(customerExperience).toContain("RewardQrPanel")
    expect(customerExperience).toContain("Show QR at counter")
    expect(customerExperience).not.toContain("SelfServiceRedeemForm")
    expect(rewardActions).not.toContain("selfRedeemAction")
    expect(migration).toContain(
      "create table if not exists public.redemption_tokens"
    )
    expect(migration).toContain("create_redemption_token")
    expect(migration).toContain("consume_redemption_token")
  })
})
