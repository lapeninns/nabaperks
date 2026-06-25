import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { stampDiscState } from "@/lib/customer/experience/stamp-disc-state"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Friction F10 (feedback): the stamp disc used to flip to the confirmed
 * success-green leaf the instant the customer tapped — before the server agreed.
 * When the server then declined (already-stamped, rate-limited, billing) the
 * disc silently reverted, a success colour that un-happened. `stampDiscState`
 * is the pure source of the disc treatment: the optimistic slam stays a NEUTRAL
 * pending stamp and only the server's "issued" result earns the green disc.
 */
describe("stampDiscState (disc colour only goes green on server confirmation)", () => {
  it("is idle while the stamp is still available and untouched", () => {
    expect(
      stampDiscState({
        committed: false,
        inFlight: false,
        canStamp: true,
        hasError: false,
      })
    ).toBe("idle")
  })

  it("is pending — not confirmed — while the optimistic stamp is in flight", () => {
    // The tap landed the slam optimistically; the server has not agreed yet, so
    // the disc must stay the neutral stamp colour rather than the success green.
    expect(
      stampDiscState({
        committed: false,
        inFlight: true,
        canStamp: true,
        hasError: false,
      })
    ).toBe("pending")
  })

  it("is confirmed only once the server result is issued", () => {
    expect(
      stampDiscState({
        committed: true,
        inFlight: false,
        canStamp: false,
        hasError: false,
      })
    ).toBe("confirmed")
  })

  it("returns to idle (no green) when the server declines the optimistic stamp", () => {
    // On a declined stamp the collector rolls the optimistic mark back: there is
    // no commit, the stamp is still available, and an error is showing. The disc
    // must NOT be the success green it briefly threatened to become.
    expect(
      stampDiscState({
        committed: false,
        inFlight: false,
        canStamp: true,
        hasError: true,
      })
    ).toBe("idle")
  })

  it("treats a server-truth already-stamped card as confirmed, not pending", () => {
    // Opening the stamp screen when today's stamp already exists (canStamp false,
    // nothing in flight, no error) is confirmed server state — green is honest.
    expect(
      stampDiscState({
        committed: false,
        inFlight: false,
        canStamp: false,
        hasError: false,
      })
    ).toBe("confirmed")
  })
})

describe("stamp disc wiring (F10 — pending vs confirmed treatment)", () => {
  it("derives the disc state from the pure helper in the collector", () => {
    const collector = readProjectFile("components/customer/stamp-collector.tsx")
    expect(collector).toContain("stampDiscState")
    // The button is driven by a distinct confirmed signal, not the input-lock.
    expect(collector).toContain("confirmed=")
  })

  it("keeps the green disc face for confirmed only, with a neutral pending stamp", () => {
    const button = readProjectFile("components/customer/stamp-press-button.tsx")
    // Confirmed earns the green leaf disc...
    expect(button).toContain("bg-reward text-reward-foreground")
    // ...everything else stays the vermillion stamp colour (never green on a
    // mere optimistic press).
    expect(button).toContain("bg-stamp text-stamp-foreground")
    // The confirmed branch keys on the new prop, not the input-lock `secured`.
    expect(button).toContain("confirmed")
    // The accessible name + input lock stay driven by `secured` (e2e locators +
    // breathe pause), so both props must coexist.
    expect(button).toContain('aria-label={secured ? "Stamp added" : label}')
  })
})
