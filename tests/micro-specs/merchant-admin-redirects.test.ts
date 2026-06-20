import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

/**
 * Redirect-only regression for the legacy merchant console routes that were
 * folded into the Account hub. Proven by source-grep so it needs no auth or DB:
 * each page is a server component whose sole job is to `redirect(...)` onto the
 * correct Account-hub target (and, for billing, forward Stripe outcome params).
 */
describe("merchant console legacy redirects", () => {
  it("forwards /app/billing to the Account billing tab and preserves Stripe params", () => {
    const source = readFileSync("app/app/billing/page.tsx", "utf8")

    expect(source).toContain("redirect(")
    expect(source).toContain("/app/account")
    expect(source).toContain("tab")
    expect(source).toContain("billing")
    // Stripe checkout/portal outcomes still return to /app/billing?... and must
    // be forwarded onto the Billing tab.
    expect(source).toContain("checkout")
    expect(source).toContain("portal")
  })

  it("forwards /app/settings to the Account hub", () => {
    const source = readFileSync("app/app/settings/page.tsx", "utf8")

    expect(source).toContain('redirect("/app/account?tab=profile")')
  })

  it("forwards /app/profile to the Account profile tab", () => {
    const source = readFileSync("app/app/profile/page.tsx", "utf8")

    expect(source).toContain("redirect(")
    expect(source).toContain("/app/account")
    expect(source).toContain("tab")
    expect(source).toContain("profile")
  })
})
