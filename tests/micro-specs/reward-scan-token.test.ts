import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

function mockSupabaseClient(client: unknown) {
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServiceRoleClient: vi.fn(() => client),
  }))
}

async function loadModule() {
  return import("@/lib/customer/reward-scan-token")
}

afterEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.doUnmock("@/lib/supabase/server")
})

describe("createRewardScanToken", () => {
  it("returns the scan token and expiry mapped from the RPC record", async () => {
    const expiresAt = "2026-06-19T12:00:00.000Z"
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          {
            data: [{ scan_token: "scan-token-abc", expires_at: expiresAt }],
            error: null,
          },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()
    const result = await createRewardScanToken({
      rewardId: "reward-1",
      customerId: "customer-1",
    })

    expect(result).toEqual({ scanToken: "scan-token-abc", expiresAt })
  })

  it("passes the reward and customer ids to the create_reward_scan_token RPC", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          {
            data: [
              {
                scan_token: "scan-token-xyz",
                expires_at: "2026-06-19T13:30:00.000Z",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()
    await createRewardScanToken({
      rewardId: "reward-42",
      customerId: "customer-99",
    })

    expect(supabase.rpcCalls).toEqual([
      {
        name: "create_reward_scan_token",
        params: {
          p_reward_event_id: "reward-42",
          p_customer_id: "customer-99",
        },
      },
    ])
  })

  it("reads the first record when the RPC returns an array of rows", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          {
            data: [
              {
                scan_token: "first-token",
                expires_at: "2026-06-19T14:00:00.000Z",
              },
              {
                scan_token: "second-token",
                expires_at: "2026-06-19T15:00:00.000Z",
              },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()
    const result = await createRewardScanToken({
      rewardId: "reward-1",
      customerId: "customer-1",
    })

    expect(result.scanToken).toBe("first-token")
    expect(result.expiresAt).toBe("2026-06-19T14:00:00.000Z")
  })

  it("accepts a single object record rather than an array", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          {
            data: {
              scan_token: "solo-token",
              expires_at: "2026-06-19T16:00:00.000Z",
            },
            error: null,
          },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()
    const result = await createRewardScanToken({
      rewardId: "reward-1",
      customerId: "customer-1",
    })

    expect(result).toEqual({
      scanToken: "solo-token",
      expiresAt: "2026-06-19T16:00:00.000Z",
    })
  })

  it("throws with the RPC error message when the RPC fails", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          { data: null, error: { message: "reward not redeemable" } },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()

    await expect(
      createRewardScanToken({ rewardId: "reward-1", customerId: "customer-1" })
    ).rejects.toThrow(
      "Unable to create reward scan token: reward not redeemable"
    )
  })

  it("throws when the RPC returns no record", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [{ data: null, error: null }],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()

    await expect(
      createRewardScanToken({ rewardId: "reward-1", customerId: "customer-1" })
    ).rejects.toThrow("Unable to create reward scan token.")
  })

  it("throws when the scan token is missing from the record", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          { data: [{ expires_at: "2026-06-19T17:00:00.000Z" }], error: null },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()

    await expect(
      createRewardScanToken({ rewardId: "reward-1", customerId: "customer-1" })
    ).rejects.toThrow("Unable to create reward scan token.")
  })

  it("throws when the expiry is missing from the record", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          { data: [{ scan_token: "token-without-expiry" }], error: null },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()

    await expect(
      createRewardScanToken({ rewardId: "reward-1", customerId: "customer-1" })
    ).rejects.toThrow("Unable to create reward scan token.")
  })

  it("rejects a blank scan token that is only whitespace", async () => {
    const supabase = createSupabaseMock({
      rpc: {
        create_reward_scan_token: [
          {
            data: [
              { scan_token: "   ", expires_at: "2026-06-19T18:00:00.000Z" },
            ],
            error: null,
          },
        ],
      },
    })
    mockSupabaseClient(supabase.client)

    const { createRewardScanToken } = await loadModule()

    await expect(
      createRewardScanToken({ rewardId: "reward-1", customerId: "customer-1" })
    ).rejects.toThrow("Unable to create reward scan token.")
  })
})
