import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import {
  REWARD_SCAN_TOKEN_TTL_MS,
  rewardQrCacheBustedSrc,
  rewardQrRefreshIntervalMs,
} from "@/lib/customer/reward-qr"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Reward redemption friction (cluster: rewards).
 *
 * F11 — the merchant-scan token has a 10-minute TTL enforced on scan, but the
 * customer-facing QR was a one-shot <img> fetched once on mount, so a queued
 * customer could present a stale QR. The QR must refresh on an interval shorter
 * than the TTL.
 *
 * F17 — the QR was a raw <img> with no onError/onLoad/skeleton; a transient
 * failure showed a broken-image glyph. It must handle onError with a calm
 * StatusBanner + retry and show a skeleton until onLoad.
 *
 * F18b — the "merchant scans this from their device" instruction was restated
 * three to four times. There must be ONE short instruction near the QR.
 */
describe("rewardQrRefreshIntervalMs (F11 — refresh inside the scan-token TTL)", () => {
  it("refreshes strictly faster than the 10-minute scan-token TTL", () => {
    expect(rewardQrRefreshIntervalMs()).toBeLessThan(REWARD_SCAN_TOKEN_TTL_MS)
  })

  it("leaves a margin so a queued QR is re-minted before it can expire", () => {
    // Comfortably under the TTL (at most half of it) so at least one refresh
    // lands before the presented token could go stale at the counter.
    expect(rewardQrRefreshIntervalMs()).toBeLessThanOrEqual(
      REWARD_SCAN_TOKEN_TTL_MS / 2
    )
    // …but not so eager that it hammers the mint route every render tick.
    expect(rewardQrRefreshIntervalMs()).toBeGreaterThanOrEqual(60_000)
  })
})

describe("rewardQrCacheBustedSrc (F11 — a fresh fetch per refresh)", () => {
  it("targets the reward's protected qr.png route", () => {
    expect(rewardQrCacheBustedSrc("reward-1", 0)).toContain(
      "/reward/reward-1/qr.png"
    )
  })

  it("varies the URL per tick so the browser re-fetches a fresh token", () => {
    const first = rewardQrCacheBustedSrc("reward-1", 1)
    const second = rewardQrCacheBustedSrc("reward-1", 2)
    expect(first).not.toBe(second)
  })

  it("keys the cache-bust to the reward id, not a shared global", () => {
    // Triangulation: a different reward id produces a different base path even at
    // the same tick, so the helper is not hardcoded to one reward.
    const a = rewardQrCacheBustedSrc("reward-a", 3)
    const b = rewardQrCacheBustedSrc("reward-b", 3)
    expect(a).toContain("/reward/reward-a/qr.png")
    expect(b).toContain("/reward/reward-b/qr.png")
    expect(a).not.toBe(b)
  })
})

describe("RewardCollectionQr source wiring (F11 + F17 + F18b)", () => {
  const src = readProjectFile("components/customer/reward-collection-qr.tsx")

  it("is a client component so it can refresh and handle load/error", () => {
    expect(src).toContain('"use client"')
  })

  it("drives the QR src from the cache-busting helper on a refresh interval (F11)", () => {
    expect(src).toContain("rewardQrCacheBustedSrc")
    expect(src).toContain("rewardQrRefreshIntervalMs")
    expect(src).toContain("setInterval")
  })

  it("preserves the e2e-pinned accessible image name", () => {
    // tests/e2e/reward-merchant-scan-live.spec.ts pins getByRole("img",
    // { name: /QR code for collecting/ }) — the alt must survive the rewrite.
    expect(src).toContain("QR code for collecting")
  })

  it("shows a skeleton until the QR loads and clears it onLoad (F17)", () => {
    expect(src).toContain("onLoad")
    expect(src).toMatch(/animate-pulse|aria-hidden/)
  })

  it("swaps to a calm StatusBanner with a retry on error (F17)", () => {
    expect(src).toContain("onError")
    expect(src).toContain("StatusBanner")
    expect(src).toContain("We could not show your reward QR")
    expect(src).toContain("Show a fresh QR")
  })

  it("keeps exactly one merchant-scan instruction near the QR (F18b)", () => {
    // The e2e live spec still pins the "Merchant scans this QR" caption headline.
    expect(src).toContain("Merchant scans this QR")
    // The verbose second caption line that duplicated the StatusBanner body is gone.
    expect(src).not.toContain("marks the\n          reward as collected")
    expect(src).not.toContain("marks the reward as collected")
  })
})

describe("RewardReadyPanel source wiring (F18b — one instruction per screen)", () => {
  const src = readProjectFile("components/customer/reward-panels.tsx")

  it("keeps the e2e-pinned StatusBanner title", () => {
    // tests/e2e/reward-merchant-scan-live.spec.ts + customer-flow-screenshots.spec.ts
    // both pin getByText("Ready for merchant scan.").
    expect(src).toContain("Ready for merchant scan.")
  })

  it("drops the duplicated 'scans it from their device' StatusBanner body", () => {
    expect(src).not.toContain("The merchant scans it from their device")
    expect(src).not.toContain("and collects the reward")
  })
})
