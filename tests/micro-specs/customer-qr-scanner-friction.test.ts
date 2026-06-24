import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { scannerGuidance } from "@/lib/customer/scanner-guidance"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

const SCANNER_PATH = "components/customer/customer-qr-scanner.tsx"
const LOADER_PATH = "components/customer/customer-qr-scanner-loader.tsx"

/**
 * Customer-flow friction audit — in-app QR scanner cluster.
 *
 * F9  camera denial gains a retry control + customer-readable copy (no jargon).
 * F21 an invalid decode gives instructive guidance, not a flat dead message.
 * `scannerGuidance` is the pure source of the secondary copy and retry decision
 * per scanner status, so the branching is unit-tested rather than asserted only
 * as rendered strings.
 */
describe("scannerGuidance (secondary copy + retry per scanner status)", () => {
  it("offers retry and customer-readable detail when the camera will not open", () => {
    const guidance = scannerGuidance("camera-error")

    expect(guidance.showRetry).toBe(true)
    expect(guidance.detail).toBe(
      "We could not open your camera. Allow camera access, then try again."
    )
    // No developer jargon leaks to the customer.
    expect(guidance.detail).not.toMatch(/https|localhost|reload this page/i)
  })

  it("guides a customer who pointed at the wrong code without offering retry", () => {
    const guidance = scannerGuidance("invalid")

    expect(guidance.showRetry).toBe(false)
    expect(guidance.detail).toBe(
      "Point your camera at the venue QR on the table or counter."
    )
  })

  it("stays quiet with no retry while the camera is healthy", () => {
    // Triangulate across the calm states so the helper is not hardcoded to one.
    for (const kind of ["idle", "scanning", "decoded"] as const) {
      const guidance = scannerGuidance(kind)
      expect(guidance, kind).toEqual({ detail: null, showRetry: false })
    }
  })
})

describe("customer QR scanner surface (friction fixes)", () => {
  it("uses only defined Wet Ink tokens — no silently no-op utilities (F13)", () => {
    const scanner = readProjectFile(SCANNER_PATH)

    for (const undefinedToken of [
      "cream-50",
      "stamp-100",
      "stamp-200",
      "stamp-300",
      "stamp-700",
      "ink-600",
      "ink-800",
      "ink-900",
      "font-serif",
    ]) {
      expect(scanner, undefinedToken).not.toContain(undefinedToken)
    }
  })

  it("renders the live scanner through the brand Icon wrapper, matching the loader (F13)", () => {
    const scanner = readProjectFile(SCANNER_PATH)

    // Brand Icon wrapper, not the raw Hugeicons primitive.
    expect(scanner).toContain("Icon")
    expect(scanner).not.toContain("HugeiconsIcon")
    expect(scanner).not.toContain('from "@hugeicons/react"')
    // Same skeleton chrome: receipt edge + the shared card surface tokens.
    expect(scanner).toContain("edge")
    expect(scanner).toContain("border-2 border-ink")
    expect(scanner).toContain("bg-card")
    expect(scanner).toContain("border-border")
  })

  it("gives camera failure a retry control and a customer message (F9)", () => {
    const scanner = readProjectFile(SCANNER_PATH)

    // The component sources its detail copy from the unit-tested helper and
    // renders the retry control, instead of inlining static copy.
    expect(scanner).toContain("scannerGuidance")
    expect(scanner).toContain("guidance.detail")
    expect(scanner).toContain("guidance.showRetry")
    expect(scanner).toContain("Try the camera again")
    // The retry control re-runs the scanner start path.
    expect(scanner).toContain("onClick")
    // Regression: the jargon-leaking sentence is gone.
    expect(scanner).not.toContain("use HTTPS or localhost")
    expect(scanner).not.toContain("reload this page")
  })

  it("keeps the invalid message instructive while preserving the pin (F21)", () => {
    const scanner = readProjectFile(SCANNER_PATH)

    // Pinned prefix is preserved (customer-qr-scanner.test.ts), extended with help.
    expect(scanner).toContain("That is not a Nabaperks QR")
    expect(scanner).toContain(
      "That is not a Nabaperks QR. Point your camera at the venue QR to collect a stamp."
    )
  })

  it("reserves an identical fixed video box in scanner and loader (F25)", () => {
    const scanner = readProjectFile(SCANNER_PATH)
    const loader = readProjectFile(LOADER_PATH)

    // No taller frame / thinner border that nudges layout on the swap.
    expect(scanner).not.toContain("min-h-72")
    expect(scanner).not.toContain("border border-dashed")
    // Both reserve the same pre-sized container so the video fills it w/o reflow.
    expect(scanner).toContain("aspect-square")
    expect(loader).toContain("aspect-square")
    expect(scanner).toContain("border-2 border-dashed")
    expect(loader).toContain("border-2 border-dashed")
  })
})
