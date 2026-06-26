import { describe, expect, it, vi } from "vitest"

import { DEFAULT_REWARD_POOL_ITEMS } from "@/lib/merchant/default-reward-pool"

describe("default reward pool", () => {
  it("ships three active pub-friendly starter rewards in display order", () => {
    expect(DEFAULT_REWARD_POOL_ITEMS).toHaveLength(3)
    expect(DEFAULT_REWARD_POOL_ITEMS.map((item) => item.rewardName)).toEqual([
      "Free pint of your choice",
      "10% off next visit",
      "Free dessert of your choice",
    ])
    expect(
      DEFAULT_REWARD_POOL_ITEMS.every(
        (item) =>
          item.isActive &&
          item.weight === 1 &&
          item.rewardTerms.length >= 12 &&
          item.rewardTerms.length <= 500
      )
    ).toBe(true)
    expect(
      DEFAULT_REWARD_POOL_ITEMS.map((item) => item.displayOrder)
    ).toEqual([1, 2, 3])
  })

  it("seeds the starter pool only when no items exist yet", async () => {
    vi.resetModules()
    const rpc = vi.fn(async () => ({ data: [{ saved_action: "created" }], error: null }))
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ count: 0, error: null })),
          })),
        })),
      })),
      rpc,
    }

    const { seedDefaultRewardPoolIfEmpty } = await import(
      "@/lib/merchant/seed-default-reward-pool"
    )

    const seeded = await seedDefaultRewardPoolIfEmpty(
      supabase as never,
      "merchant-1",
      "card-1"
    )

    expect(seeded).toBe(true)
    expect(rpc).toHaveBeenCalledTimes(3)
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "upsert_reward_pool_item",
      expect.objectContaining({
        p_merchant_id: "merchant-1",
        p_loyalty_card_id: "card-1",
        p_reward_name: "Free pint of your choice",
        p_is_active: true,
        p_display_order: 1,
      })
    )
  })

  it("skips seeding when the pool already has rewards", async () => {
    vi.resetModules()
    const rpc = vi.fn()
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(async () => ({ count: 2, error: null })),
          })),
        })),
      })),
      rpc,
    }

    const { seedDefaultRewardPoolIfEmpty } = await import(
      "@/lib/merchant/seed-default-reward-pool"
    )

    const seeded = await seedDefaultRewardPoolIfEmpty(
      supabase as never,
      "merchant-1",
      "card-1"
    )

    expect(seeded).toBe(false)
    expect(rpc).not.toHaveBeenCalled()
  })
})
