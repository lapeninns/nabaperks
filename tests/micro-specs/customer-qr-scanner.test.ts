import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

import { normalizeScannedQrDestination } from "@/lib/customer/qr-scanner"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

describe("customer QR scanner", () => {
  it("normalizes relative venue QR routes to the existing QR resolver", () => {
    // Given: a QR payload produced by the Nabaperks app.
    const scannedValue = "/q/old-crown-girton"

    // When: the scanner parses it inside the customer app.
    const result = normalizeScannedQrDestination(
      scannedValue,
      "https://nabaperks.com"
    )

    // Then: the decoded scan delegates to the existing server QR resolver.
    expect(result).toEqual({ kind: "valid", href: "/q/old-crown-girton" })
  })

  it("normalizes same-origin absolute QR URLs and drops query/hash fragments", () => {
    // Given: a full production URL from a printed venue QR.
    const scannedValue =
      "https://nabaperks.com/q/old-crown-girton?utm_source=poster#scan"

    // When: the scanner parses it against the same app origin.
    const result = normalizeScannedQrDestination(
      scannedValue,
      "https://nabaperks.com"
    )

    // Then: only the resolver path is used for the customer flow handoff.
    expect(result).toEqual({ kind: "valid", href: "/q/old-crown-girton" })
  })

  it("rejects QR payloads that are not Nabaperks venue QR resolver paths", () => {
    // Given: payloads that must not be allowed to drive in-app navigation.
    const invalidScans = [
      "",
      "not a url",
      "https://example.com/q/old-crown-girton",
      "https://nabaperks.com/card/membership-1/stamp",
      "https://nabaperks.com/q/old-crown-girton/extra",
      "https://nabaperks.com/q/../admin",
    ]

    // When / Then: each rejected scan is reported without a navigation href.
    for (const scannedValue of invalidScans) {
      expect(
        normalizeScannedQrDestination(scannedValue, "https://nabaperks.com"),
        scannedValue
      ).toEqual({ kind: "invalid" })
    }
  })

  it("ships a focused scanner route and client lifecycle component", () => {
    // Given: the customer scanner surface is part of the app.
    const pagePath = "app/scan/page.tsx"
    const wrapperPath = "components/customer/customer-qr-scanner-loader.tsx"
    const scannerPath = "components/customer/customer-qr-scanner.tsx"

    // When: the source files are inspected.
    expect(existsSync(pagePath)).toBe(true)
    expect(existsSync(wrapperPath)).toBe(true)
    expect(existsSync(scannerPath)).toBe(true)
    const page = readProjectFile(pagePath)
    const wrapper = readProjectFile(wrapperPath)
    const scanner = readProjectFile(scannerPath)

    // Then: the route renders a lightweight client-only wrapper, and the
    // scanner component owns camera cleanup.
    expect(page).toContain("CustomerQrScannerLoader")
    expect(page).toContain(
      'from "@/components/customer/customer-qr-scanner-loader"'
    )
    expect(page).not.toContain("html5-qrcode")
    expect(page).not.toContain(
      'from "@/components/customer/customer-qr-scanner"'
    )
    expect(wrapper).toContain('"use client"')
    expect(wrapper).toContain("dynamic(")
    expect(wrapper).toContain("ssr: false")
    expect(wrapper).toContain("loading:")
    expect(wrapper).toContain("./customer-qr-scanner")
    expect(scanner).toContain('"use client"')
    expect(scanner).toContain("Html5Qrcode")
    expect(scanner).toContain("Html5QrcodeSupportedFormats.QR_CODE")
    expect(scanner).toContain('facingMode: "environment"')
    expect(scanner).toContain(".stop()")
    expect(scanner).toContain(".clear()")
    expect(scanner).toContain('kind: "idle"')
    expect(scanner).toContain('kind: "scanning"')
    expect(scanner).toContain('kind: "decoded"')
    expect(scanner).toContain('kind: "invalid"')
    expect(scanner).toContain('kind: "camera-error"')
    expect(scanner).toContain("normalizeScannedQrDestination")
    expect(scanner).toContain("router.push(result.href)")
    expect(scanner).toContain("Camera unavailable")
    expect(scanner).toContain("That is not a Nabaperks QR")
  })
})
