import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

/**
 * Shell, entry & shared-state friction fixes (cluster: shell-entry).
 *  - F14: the marketing root must offer a customer a low-key way into their own
 *    cards / a fresh scan, not only a merchant trial.
 *  - F22: StatusBanner must signal state with an icon as well as colour + copy.
 *  - F18a: the QR-error screens must run one headline, not three stacked copies.
 */
describe("F14 — customer entry affordance on the marketing root", () => {
  const home = readProjectFile("app/page.tsx")

  it("offers a customer route into their own cards", () => {
    expect(home).toContain('href="/home"')
    expect(home).toContain("Open my cards")
  })

  it("offers a customer route into a fresh venue scan", () => {
    expect(home).toContain('href="/scan"')
    expect(home).toContain("Scan a venue QR")
  })

  it("keeps the customer affordance understated, not a primary merchant CTA", () => {
    // The new customer links use a low-key variant (ghost/secondary), so the
    // merchant trial stays the page's primary action.
    expect(home).toMatch(/variant="(ghost|secondary)"/)
    // The merchant CTA the marketing pins depend on must survive.
    expect(home).toContain("Start a merchant trial")
  })
})

describe("F22 — StatusBanner pairs an icon with colour + copy", () => {
  const banner = readProjectFile("components/loyalty/status-banner.tsx")

  it("renders the matching STATUS_ICON glyph through the brand Icon wrapper", () => {
    expect(banner).toContain("STATUS_ICON")
    expect(banner).toContain("Icon")
  })

  it("maps each visual tone to a status icon kind", () => {
    expect(banner).toContain("success")
    expect(banner).toContain("warning")
    expect(banner).toContain("error")
  })

  it("keeps the alert semantics and title text additive-only", () => {
    // role="alert" lives on the Alert primitive — the banner must still use it.
    expect(banner).toContain("Alert")
    expect(banner).toContain("AlertTitle")
    // The title/children API is unchanged.
    expect(banner).toContain("{title}")
  })
})

describe("F18a — one headline per QR-error screen", () => {
  const qrPage = readProjectFile("app/q/[qrId]/page.tsx")

  it("drops the duplicate CustomerReceipt title on the error screens", () => {
    // The receipt headline (an <h2>) repeated the shell + EmptyState <h1>.
    // The "unavailable" copy must now appear exactly once as a title= (the
    // EmptyState <h1>); the duplicate receipt title= is gone.
    const unavailableTitles = qrPage.match(
      /title="This loyalty card is unavailable"/g
    )
    expect(unavailableTitles).toHaveLength(1)
    // The rate-limited receipt likewise no longer repeats its EmptyState <h1>.
    const tooManyTitles = qrPage.match(/title="Too many scans just now"/g)
    expect(tooManyTitles).toHaveLength(1)
    // The receipts now open with just the venue + eyebrow, never a headline.
    expect(qrPage).toContain(
      'CustomerReceipt venueName="Nabaperks" eyebrow="QR unavailable"'
    )
    expect(qrPage).toContain(
      'CustomerReceipt venueName="Nabaperks" eyebrow="Try again shortly"'
    )
  })

  it("preserves the audited recovery copy and links", () => {
    // The shell headline stays the single h1.
    expect(qrPage).toContain('title="Card unavailable"')
    // EmptyState keeps the audited copy (pinned by customer.test.ts + e2e).
    expect(qrPage).toContain("This loyalty card is unavailable")
    expect(qrPage).toContain("Ask a team member for the current loyalty QR.")
    expect(qrPage).toContain("/stamp?qr=")
    expect(qrPage).toContain('href="/scan"')
    expect(qrPage).toContain('href="/home"')
    expect(qrPage).toContain("Scan a QR")
    expect(qrPage).toContain("Open my cards")
  })
})
