import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Theme 2 of the customer-flow friction audit: error / empty / offline states
 * must route a signed-in customer back to their wallet (`/home`) or a fresh scan
 * (`/scan`) instead of dead-ending on the merchant marketing root (`/`), and the
 * highest-traffic entry point (`/q/[qrId]`) must show movement while it resolves.
 */
describe("customer recovery paths (no dead-ends to merchant marketing)", () => {
  it("shows a loading skeleton while /q resolves the venue QR", () => {
    const loadingPath = "app/q/[qrId]/loading.tsx"
    expect(existsSync(loadingPath)).toBe(true)

    const loading = readProjectFile(loadingPath)
    expect(loading).toContain("export default")
    // Reuses the shared customer skeleton source-of-truth, not an ad-hoc spinner.
    expect(loading).toContain("CustomerResolveSkeleton")

    const skeletons = readProjectFile(
      "components/customer/loading-skeletons.tsx"
    )
    expect(skeletons).toContain("export function CustomerResolveSkeleton")
  })

  it("offers the not-found screen a route back to the customer's wallet", () => {
    const notFound = readProjectFile("app/not-found.tsx")
    expect(notFound).toContain('href="/home"')
    expect(notFound).toContain("Open my cards")
    // The branded marketing exit stays for the e2e not-found surface test.
    expect(notFound).toContain("Back to Nabaperks")
    // The body must not assume a first scan for an existing customer.
    expect(notFound).not.toContain("scan from a live venue QR")
  })

  it("routes the offline recovery action at the wallet, not marketing", () => {
    const offline = readProjectFile("app/offline/page.tsx")
    expect(offline).toContain('href="/home"')
    expect(offline).toContain("Open my cards")
    // The single recovery action no longer points at the merchant root.
    expect(offline).not.toContain('href="/"')
    // Pinned offline copy stays intact (see full-app-pwa.test.ts).
    expect(offline).toContain("You're offline")
  })

  it("gives the unavailable and rate-limited QR screens a way forward", () => {
    const qrPage = readProjectFile("app/q/[qrId]/page.tsx")
    // Both error screens (unavailable + rate-limited) gain an actions slot.
    expect((qrPage.match(/actions=/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(qrPage).toContain('href="/scan"')
    expect(qrPage).toContain('href="/home"')
    expect(qrPage).toContain("Scan a QR")
    expect(qrPage).toContain("Open my cards")
    // Regression guard: the audited copy + redirect contract must survive.
    expect(qrPage).toContain("This loyalty card is unavailable")
    expect(qrPage).toContain("Ask a team member for the current loyalty QR.")
    expect(qrPage).toContain("/stamp?qr=")
  })
})
