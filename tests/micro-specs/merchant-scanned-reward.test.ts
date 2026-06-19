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
    expect(existsSync("app/r/[token]/page.tsx")).toBe(true)

    const rewardPanels = readProjectFile(
      "components/customer/reward-panels.tsx"
    )
    const rewardQr = readProjectFile(
      "components/customer/reward-collection-qr.tsx"
    )
    const cardExperience = readProjectFile(
      "components/customer/customer-card-experience.tsx"
    )
    const rewardQrRoute = readProjectFile(
      "app/reward/[rewardId]/qr.png/route.ts"
    )
    const publicScanHandoff = readProjectFile("app/r/[token]/page.tsx")

    expect(rewardPanels).toContain("RewardCollectionQr")
    expect(rewardQr).toContain("/reward/${rewardId}/qr.png")
    expect(rewardQr).not.toContain("/app/rewards/scan/${rewardId}")
    expect(rewardQr).toContain("Merchant scans this QR")
    expect(rewardQrRoute).toContain("createRewardScanToken")
    expect(rewardQrRoute).toContain("/r/${token.scanToken}")
    expect(rewardQrRoute).not.toContain("/app/rewards/scan/${token.scanToken}")
    expect(rewardQrRoute).not.toContain("/app/rewards/scan/${rewardId}")
    expect(publicScanHandoff).toContain(
      "redirect(`/app/rewards/scan/${encodeURIComponent(token)}`)"
    )
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
    expect(page).toContain("scanToken")
    expect(form).toContain("confirmMerchantRewardCollectionAction")
    expect(form).toContain('name="scanToken"')
    expect(actions).toContain("collectMerchantScannedReward")
    expect(actions).toContain('value(formData, "scanToken")')
  })

  it("uses counter-facing copy on the merchant reward collection screen", () => {
    const page = readProjectFile("app/app/rewards/scan/[rewardId]/page.tsx")
    const form = readProjectFile(
      "components/merchant/reward-collection-form.tsx"
    )

    for (const internalCopy of [
      "Use this screen after scanning the QR from the customer's phone.",
      "Customer reward ready",
      "from this merchant device",
      "Collect customer reward",
    ]) {
      expect(`${page}\n${form}`).not.toContain(internalCopy)
    }

    expect(page).toContain("Check and collect reward")
    expect(page).toContain("Ready to collect")
    expect(page).toContain("The customer can scan the venue QR again")
    expect(form).toContain("Mark reward collected")
  })

  it("collects through an opaque scan-token RPC scoped to the merchant", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        business_name: "Old Crown Girton",
      })),
    }))
    const supabase = createSupabaseMock({
      rpc: {
        collect_reward_scan_token: [
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
      collectMerchantScannedReward("scan-token-1")
    ).resolves.toMatchObject({
      status: "collected",
      scanToken: "scan-token-1",
      rewardId: "reward-1",
      membershipId: "membership-1",
    })
    expect(supabase.queryCalls).not.toContainEqual(
      expect.objectContaining({ table: "reward_events" })
    )
    expect(supabase.rpcCalls).toContainEqual({
      name: "collect_reward_scan_token",
      params: {
        p_scan_token: "scan-token-1",
        p_merchant_id: "merchant-1",
      },
    })
  })

  it("blocks a merchant from collecting another merchant's scan token", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        business_name: "Old Crown Girton",
      })),
    }))
    const supabase = createSupabaseMock({
      rpc: {
        collect_reward_scan_token: [
          {
            data: null,
            error: {
              message: "Reward scan token belongs to a different merchant",
            },
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
      collectMerchantScannedReward("scan-token-1")
    ).resolves.toMatchObject({
      status: "blocked",
      reason: "This reward belongs to a different merchant.",
    })
    expect(supabase.queryCalls).not.toContainEqual(
      expect.objectContaining({ table: "reward_events" })
    )
  })

  it("maps a collect-time RPC error to calm merchant copy instead of the raw string", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        business_name: "Old Crown Girton",
      })),
    }))
    const supabase = createSupabaseMock({
      rpc: {
        collect_reward_scan_token: [
          {
            data: null,
            error: { message: "Complete your profile before redeeming" },
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))

    const { collectMerchantScannedReward } =
      await import("@/lib/merchant/reward-collection")

    const result = await collectMerchantScannedReward("scan-token-1")
    expect(result.status).toBe("blocked")
    if (result.status !== "blocked") {
      throw new Error("Expected a blocked collection result")
    }
    // The merchant counter never sees the raw RPC string.
    expect(result.reason).not.toContain(
      "Complete your profile before redeeming"
    )
    expect(result.reason).toBe(
      "Ask the customer to finish their profile before this reward can be collected."
    )
  })

  it("falls back to safe copy for an unrecognised collect-time RPC error", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        business_name: "Old Crown Girton",
      })),
    }))
    const supabase = createSupabaseMock({
      rpc: {
        collect_reward_scan_token: [
          {
            data: null,
            error: { message: "connection reset by peer" },
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))

    const { collectMerchantScannedReward } =
      await import("@/lib/merchant/reward-collection")

    const result = await collectMerchantScannedReward("scan-token-1")
    expect(result).toMatchObject({
      status: "blocked",
      reason: "This reward could not be collected. Try again or refresh.",
    })
  })

  it("masks customer identity in the merchant scan context", async () => {
    vi.doMock("@/lib/auth/session", () => ({
      getCurrentMerchant: vi.fn(async () => ({
        id: "merchant-1",
        business_name: "Old Crown Girton",
      })),
    }))
    const supabase = createSupabaseMock({
      rpc: {
        get_reward_scan_context: [
          {
            data: [
              {
                scan_status: "ready",
                reward_event_id: "reward-1",
                reward_name: "Coffee upgrade",
                reward_terms: "One per visit.",
                min_spend_pence: null,
                membership_id: "membership-1",
                current_stamp_count: 3,
                customer_email: "guest@example.test",
                customer_phone: "+441234567890",
                customer_phone_last4: "7890",
                blocked_reason: null,
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

    const { loadMerchantRewardScanContext } =
      await import("@/lib/merchant/reward-collection")
    const context = await loadMerchantRewardScanContext("scan-token-1")

    expect(context.status).toBe("ready")
    if (context.status !== "ready") {
      throw new Error("Expected reward scan context to be ready")
    }
    expect(context.scanToken).toBe("scan-token-1")
    expect(context.customerLabel).toBe("g***@example.test")
    expect(context.customerLabel).not.toContain("guest@example.test")
    expect(context.customerLabel).not.toContain("1234567890")
    expect(supabase.queryCalls).not.toContainEqual(
      expect.objectContaining({ table: "reward_events" })
    )
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
        scanToken: "scan-token-1",
        rewardId: "reward-1",
        membershipId: "membership-1",
      })),
    }))

    const { confirmMerchantRewardCollectionAction } =
      await import("@/app/app/rewards/scan/[rewardId]/actions")

    await expect(
      confirmMerchantRewardCollectionAction(
        {},
        form({ scanToken: "scan-token-1" })
      )
    ).rejects.toThrow(
      "NEXT_REDIRECT:/app/rewards/scan/scan-token-1?collected=1"
    )
  })
})
