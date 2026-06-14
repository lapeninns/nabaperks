import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(path, "utf8")
}

describe("customer legal sheets", () => {
  it("keeps join consent links in scrollable sheets instead of route hops", () => {
    const legalSheet = read("components/customer/legal-sheet.tsx")
    const joinForms = read("components/customer/join-forms.tsx")
    const joinWizard = read("components/customer/join-wizard.tsx")
    const landingPage = read("app/m/[merchantSlug]/page.tsx")

    expect(legalSheet).toContain('"use client"')
    expect(legalSheet).toContain("CustomerLegalConsentLinks")
    expect(legalSheet).toContain('side="bottom"')
    expect(legalSheet).toContain("overflow-y-auto")

    expect(joinForms).toContain("CustomerLegalConsentLinks")
    expect(joinForms).not.toContain('href="/terms"')
    expect(joinForms).not.toContain('href="/privacy"')

    expect(joinWizard).toContain("CustomerVenueTermsSheet")
    expect(joinWizard).not.toContain("exp.merchant.termsUrl")

    expect(landingPage).toContain("CustomerVenueTermsSheet")
    expect(landingPage).not.toContain("`/merchant/${merchantSlug}/terms`")
  })
})
