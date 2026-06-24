import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { formatRedeemedProofLine } from "@/lib/customer/experience/redeemed-proof"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Reward redemption friction (cluster: rewards).
 *
 * F26 — RedeemedProofPanel confirmed "Reward collected." but showed no redeemed
 * timestamp, even though the status endpoint already returns `redeemedAt`. The
 * redeemed-proof panel must carry a quiet proof line of the collection moment +
 * venue, formatted by a pure helper.
 */
describe("formatRedeemedProofLine (F26 — collected date/time + venue)", () => {
  it("renders a calm 'Collected {date, time} . {venue}' line", () => {
    const line = formatRedeemedProofLine(
      "2026-06-19T10:05:00.000Z",
      "The Old Crown"
    )
    expect(line).toContain("Collected")
    expect(line).toContain("19 Jun 2026")
    expect(line).toContain("The Old Crown")
    // No emoji, no exclamation marks (DESIGN.md voice).
    expect(line).not.toMatch(/[!]/u)
  })

  it("generalises across instants and venues, not a hardcoded string", () => {
    // Triangulation: a different instant + venue must change date, time and venue.
    const a = formatRedeemedProofLine(
      "2026-06-19T10:05:00.000Z",
      "The Old Crown"
    )
    const b = formatRedeemedProofLine("2026-12-25T18:30:00.000Z", "Bean Scene")
    expect(b).not.toBe(a)
    expect(b).toContain("25 Dec 2026")
    expect(b).toContain("Bean Scene")
  })

  it("renders nothing when the redeemed instant is missing", () => {
    // A redeemed reward should always have a timestamp, but the panel must stay
    // calm (no "Invalid Date") if it is ever absent.
    expect(formatRedeemedProofLine(null, "The Old Crown")).toBe("")
    expect(formatRedeemedProofLine(undefined, "The Old Crown")).toBe("")
  })
})

describe("redeemedAt threading through the reward experience (F26)", () => {
  it("carries redeemedAt from the loader onto the reward facts", () => {
    const loader = readProjectFile("lib/customer/experience/load-reward.ts")
    expect(loader).toContain("redeemedAt")
    expect(loader).toContain("reward.redeemed_at")
  })

  it("threads redeemedAt onto the redeemed_proof experience in derive", () => {
    const derive = readProjectFile("lib/customer/experience/derive.ts")
    expect(derive).toContain("redeemedAt")
  })

  it("status route still returns the redeemedAt it already had", () => {
    const route = readProjectFile("app/reward/[rewardId]/status/route.ts")
    expect(route).toContain("redeemedAt: reward.redeemed_at")
  })
})

describe("RedeemedProofPanel source wiring (F26)", () => {
  const src = readProjectFile("components/customer/reward-panels.tsx")

  it("keeps the e2e-pinned confirmation copy", () => {
    // tests/e2e/reward-merchant-scan-live.spec.ts pins both of these.
    expect(src).toContain("Reward collected.")
    expect(src).toContain(
      "The merchant has scanned your QR. A new stamp cycle has started."
    )
  })

  it("renders the redeemed proof line from the pure formatter", () => {
    expect(src).toContain("formatRedeemedProofLine")
    expect(src).toContain("redeemedAt")
    // Quiet mono treatment for the proof line.
    expect(src).toContain("font-mono")
  })
})
