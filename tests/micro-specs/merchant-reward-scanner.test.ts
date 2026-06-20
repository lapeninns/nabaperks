import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { normalizeScannedRewardDestination } from "@/lib/merchant/reward-scanner"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("merchant reward scanner", () => {
  it("normalizes same-origin reward handoff URLs to the merchant scan route", () => {
    const token = "14000000-0000-0000-0000-000000000099"

    expect(
      normalizeScannedRewardDestination(`/r/${token}`, "https://nabaperks.test")
    ).toEqual({
      kind: "valid",
      href: `/app/rewards/scan/${encodeURIComponent(token)}`,
    })

    expect(
      normalizeScannedRewardDestination(
        `https://nabaperks.test/r/${token}?from=phone`,
        "https://nabaperks.test"
      )
    ).toEqual({
      kind: "valid",
      href: `/app/rewards/scan/${encodeURIComponent(token)}`,
    })
  })

  it("rejects payloads that are not reward scan handoff URLs", () => {
    const invalidScans = [
      "",
      "not a url",
      "https://example.com/r/14000000-0000-0000-0000-000000000099",
      "https://nabaperks.test/q/old-crown-girton-qr",
      "https://nabaperks.test/r/not-a-uuid",
      "https://nabaperks.test/r/14000000-0000-0000-0000-000000000099/extra",
    ]

    for (const scannedValue of invalidScans) {
      expect(
        normalizeScannedRewardDestination(
          scannedValue,
          "https://nabaperks.test"
        ),
        scannedValue
      ).toEqual({ kind: "invalid" })
    }
  })

  it("ships a merchant scan route and client scanner wired to reward handoff URLs", () => {
    const pagePath = "app/app/scan/page.tsx"
    const wrapperPath = "components/merchant/merchant-reward-scanner-loader.tsx"
    const scannerPath = "components/merchant/merchant-reward-scanner.tsx"
    const homePath = "app/app/page.tsx"

    expect(existsSync(pagePath)).toBe(true)
    expect(existsSync(wrapperPath)).toBe(true)
    expect(existsSync(scannerPath)).toBe(true)

    const page = readProjectFile(pagePath)
    const wrapper = readProjectFile(wrapperPath)
    const scanner = readProjectFile(scannerPath)
    const home = readProjectFile(homePath)

    expect(page).toContain("MerchantRewardScannerLoader")
    expect(wrapper).toContain("dynamic(")
    expect(wrapper).toContain("ssr: false")
    expect(scanner).toContain("normalizeScannedRewardDestination")
    expect(scanner).toContain("router.push(result.href)")
    expect(home).toContain('href="/app/scan"')
    expect(home).toContain("Scan reward")
    expect(home).not.toContain("Launch QR")
  })
})
