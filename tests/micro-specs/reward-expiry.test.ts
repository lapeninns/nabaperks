import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const migration = read("supabase/migrations/20260622140000_notification_ledger_reward_expiry.sql")
const rewardsReadModel = read("lib/customer/rewards.ts")
const rewardDetailReadModel = read("lib/customer/reward.ts")
const cardReadModel = read("lib/customer/card.ts")
const sqlTest = read("supabase/tests/notification_ledger_reward_expiry.sql")

describe("assigned reward expiry", () => {
  it("stores configured expiry separately from reward scan-token expiry", () => {
    expect(migration).toContain("alter table public.loyalty_cards")
    expect(migration).toContain("reward_expires_after_days")
    expect(migration).toContain("alter table public.reward_pool_items")
    expect(migration).toContain("alter table public.reward_events")
    expect(migration).toContain("expires_at timestamptz")
    expect(migration).toContain("function public.set_reward_event_expiry_snapshot")
    expect(migration).toContain("reward_events.expires_at")

    const expirySnapshot = functionBody("set_reward_event_expiry_snapshot")
    expect(expirySnapshot).not.toContain("reward_scan_tokens")
  })

  it("blocks collection only from assigned reward expiry state", () => {
    expect(migration).toContain("function public.prevent_expired_reward_redemption")
    expect(migration).toContain("Reward has expired")
    expect(migration).toContain("function public.expire_due_reward_events")

    const redemptionGuard = functionBody("prevent_expired_reward_redemption")
    expect(redemptionGuard).toContain("new.status = 'redeemed'")
    expect(redemptionGuard).toContain("coalesce(new.expires_at, old.expires_at) <= now()")
    expect(redemptionGuard).not.toContain("reward_scan_tokens.expires_at")
  })

  it("surfaces active and expired reward expiry in customer read models", () => {
    expect(rewardsReadModel).toContain("expiresAt")
    expect(rewardsReadModel).toContain("expired")
    expect(rewardsReadModel).toContain("isRewardExpired")
    expect(rewardDetailReadModel).toContain("expires_at")
    expect(cardReadModel).toContain("expires_at")
  })

  it("has local SQL cases for no expiry, future expiry, expired block, and immutable snapshots", () => {
    for (const marker of [
      "reward without configured expiry stays null",
      "future assigned expiry remains redeemable",
      "expired assigned reward cannot be redeemed",
      "reward pool edits do not move assigned expiry",
      "scan-token expiry is not reward expiry",
    ]) {
      expect(sqlTest).toContain(marker)
    }
  })
})

function functionBody(name: string) {
  const start = migration.indexOf(`function public.${name}`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = migration.indexOf("$$;", start)
  expect(end).toBeGreaterThan(start)
  return migration.slice(start, end)
}

function read(path: string) {
  return readFileSync(path, "utf8")
}
