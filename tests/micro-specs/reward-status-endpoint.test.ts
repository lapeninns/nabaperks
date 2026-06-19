import { readFileSync } from "node:fs"
import { afterEach, describe, expect, it, vi } from "vitest"

/**
 * The live reward-collection confirmation reads server-confirmed redemption
 * through a no-store status endpoint. It must observe `reward_events.status`
 * only — never mutate — and must not leak a reward the caller does not own.
 */
describe("GET /reward/[rewardId]/status", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/customer/reward")
  })

  function mockRewardState(state: unknown) {
    vi.doMock("@/lib/customer/reward", () => ({
      getCustomerRewardState: vi.fn(async () => state),
    }))
  }

  async function getStatus(rewardId: string) {
    const { GET } = await import("@/app/reward/[rewardId]/status/route")
    return GET(new Request(`http://localhost/reward/${rewardId}/status`), {
      params: Promise.resolve({ rewardId }),
    })
  }

  it("reports a redeemed reward for the owning customer", async () => {
    mockRewardState({
      status: "ready",
      customerId: "customer-1",
      reward: { status: "redeemed", redeemed_at: "2026-06-19T10:00:00.000Z" },
    })

    const res = await getStatus("reward-1")

    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toContain("no-store")
    expect(res.headers.get("cache-control")).toContain("max-age=0")
    await expect(res.json()).resolves.toEqual({
      redeemed: true,
      status: "redeemed",
      redeemedAt: "2026-06-19T10:00:00.000Z",
    })
  })

  it("reports not-yet-redeemed while the reward is still ready", async () => {
    mockRewardState({
      status: "ready",
      customerId: "customer-1",
      reward: { status: "unlocked", redeemed_at: null },
    })

    const res = await getStatus("reward-1")

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      redeemed: false,
      status: "unlocked",
      redeemedAt: null,
    })
  })

  it("returns 401 with no-store when the visitor is not authenticated", async () => {
    mockRewardState({ status: "unauthenticated" })

    const res = await getStatus("reward-1")

    expect(res.status).toBe(401)
    expect(res.headers.get("cache-control")).toContain("no-store")
    const body = await res.json()
    expect(body.redeemed).not.toBe(true)
    expect(body.status).not.toBe("redeemed")
  })

  it("returns 404 without leaking another customer's reward", async () => {
    mockRewardState({ status: "unauthorized" })

    const res = await getStatus("reward-1")

    expect(res.status).toBe(404)
    expect(res.headers.get("cache-control")).toContain("no-store")
    const body = await res.json()
    expect(body.redeemed).not.toBe(true)
    expect(body.status).not.toBe("redeemed")
    expect(body.redeemedAt).toBeUndefined()
  })

  it("returns 404 for a reward that cannot be found", async () => {
    mockRewardState({ status: "not_found" })

    const res = await getStatus("reward-1")

    expect(res.status).toBe(404)
    expect(res.headers.get("cache-control")).toContain("no-store")
  })

  it("only reads reward state — the source never mutates", () => {
    const src = readFileSync("app/reward/[rewardId]/status/route.ts", "utf8")

    expect(src).toContain("getCustomerRewardState")
    expect(src).not.toContain(".rpc(")
    expect(src).not.toMatch(/\.(insert|update|upsert|delete)\(/)
  })
})
