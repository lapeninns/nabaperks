import { existsSync, readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function form(values: Record<string, string>) {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

describe("merchant-scanned reward collection", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/auth/session")
    vi.doUnmock("@/lib/supabase/server")
    vi.doUnmock("next/cache")
    vi.doUnmock("next/navigation")
  })

  it("shows a customer-held reward QR instead of a customer self-redeem form", () => {
    expect(existsSync("components/customer/reward-panels.tsx")).toBe(true)
    expect(existsSync("app/reward/[rewardId]/qr.png/route.ts")).toBe(true)

    const rewardPanels = readProjectFile(
      "components/customer/reward-panels.tsx"
    )
    const rewardQr = readProjectFile(
      "components/customer/reward-collection-qr.tsx"
    )
    const cardExperience = readProjectFile(
      "components/customer/customer-card-experience.tsx"
    )

    expect(rewardPanels).toContain("RewardCollectionQr")
    expect(rewardQr).toContain("/reward/${rewardId}/qr.png")
    expect(rewardQr).toContain("/app/rewards/scan/")
    expect(rewardQr).toContain("Merchant scans this QR")
    expect(cardExperience).not.toContain("SelfServiceRedeemForm")
  })

  it("keeps the merchant scan route inside the logged-in merchant app", () => {
    expect(existsSync("app/app/rewards/scan/[rewardId]/page.tsx")).toBe(true)
    expect(existsSync("app/app/rewards/scan/[rewardId]/actions.ts")).toBe(true)

    const page = readProjectFile("app/app/rewards/scan/[rewardId]/page.tsx")
    const actions = readProjectFile(
      "app/app/rewards/scan/[rewardId]/actions.ts"
    )
    const form = readProjectFile(
      "components/merchant/reward-collection-form.tsx"
    )

    expect(page).toContain("loadMerchantRewardScanContext")
    expect(form).toContain("confirmMerchantRewardCollectionAction")
    expect(actions).toContain("collectMerchantScannedReward")
  })

  it("redeems through the RPC only after the scanned reward belongs to the merchant", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        business_name: "Bean & Batch",
      })),
    }))
    const supabase = createSupabaseMock({
      from: {
        reward_events: [
          {
            data: {
              id: "reward-1",
              merchant_id: "merchant-1",
              customer_id: "customer-1",
            },
            error: null,
          },
        ],
      },
      rpc: {
        redeem_self_service_reward: [
          {
            data: [
              {
                reward_event_id: "reward-1",
                reward_name: "Coffee upgrade",
                membership_id: "membership-1",
                new_stamp_count: 0,
              },
            ],
            error: null,
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))

    const { collectMerchantScannedReward } =
      await import("@/lib/merchant/reward-collection")

    await expect(
      collectMerchantScannedReward("reward-1")
    ).resolves.toMatchObject({
      status: "collected",
      rewardId: "reward-1",
      membershipId: "membership-1",
    })
    expect(supabase.rpcCalls).toContainEqual({
      name: "redeem_self_service_reward",
      params: {
        p_reward_event_id: "reward-1",
        p_customer_id: "customer-1",
        p_latitude: null,
        p_longitude: null,
      },
    })
  })

  it("blocks a merchant from collecting another merchant's scanned reward", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        business_name: "Bean & Batch",
      })),
    }))
    const supabase = createSupabaseMock({
      from: {
        reward_events: [
          {
            data: {
              id: "reward-1",
              merchant_id: "merchant-2",
              customer_id: "customer-1",
            },
            error: null,
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))

    const { collectMerchantScannedReward } =
      await import("@/lib/merchant/reward-collection")

    await expect(
      collectMerchantScannedReward("reward-1")
    ).resolves.toMatchObject({
      status: "blocked",
      reason: "This reward belongs to a different merchant.",
    })
    expect(supabase.rpcCalls).toHaveLength(0)
  })

  it("masks customer identity in the merchant scan context", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        business_name: "Bean & Batch",
      })),
    }))
    const supabase = createSupabaseMock({
      from: {
        reward_events: [
          {
            data: {
              id: "reward-1",
              status: "unlocked",
              merchant_id: "merchant-1",
              customer_id: "customer-1",
              membership_id: "membership-1",
              reward_name: "Coffee upgrade",
              reward_terms: "One per visit.",
              min_spend_pence: null,
              customer_memberships: { current_stamp_count: 3 },
              customers: {
                email: "guest@example.test",
                phone: "+441234567890",
                phone_last4: "7890",
              },
              loyalty_cards: { stamps_required: 3, is_active: true },
            },
            error: null,
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))

    const { loadMerchantRewardScanContext } =
      await import("@/lib/merchant/reward-collection")
    const context = await loadMerchantRewardScanContext("reward-1")

    expect(context.status).toBe("ready")
    if (context.status !== "ready") {
      throw new Error("Expected reward scan context to be ready")
    }
    expect(context.customerLabel).toBe("g***@example.test")
    expect(context.customerLabel).not.toContain("guest@example.test")
    expect(context.customerLabel).not.toContain("1234567890")
  })

  it("redirects a successful merchant confirmation to the collected proof", async () => {
    const redirect = vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`)
    })
    vi.doMock("next/navigation", () => ({ redirect }))
    vi.doMock("next/cache", () => ({ revalidatePath: vi.fn() }))
    vi.doMock("@/lib/merchant/reward-collection", () => ({
      collectMerchantScannedReward: vi.fn(async () => ({
        status: "collected",
        rewardId: "reward-1",
        membershipId: "membership-1",
      })),
    }))

    const { confirmMerchantRewardCollectionAction } =
      await import("@/app/app/rewards/scan/[rewardId]/actions")

    await expect(
      confirmMerchantRewardCollectionAction({}, form({ rewardId: "reward-1" }))
    ).rejects.toThrow("NEXT_REDIRECT:/app/rewards/scan/reward-1?collected=1")
  })
})
