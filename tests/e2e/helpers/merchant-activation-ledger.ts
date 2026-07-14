import { expect, test } from "@playwright/test"

import { dismissPwaInstall } from "./harness"
import { installSeededAdminAal2Session } from "./admin-mfa-session"

const ACTIVATION_STAGE_LABELS = [
  "Account created",
  "Email verified",
  "Onboarding complete",
  "Launch setup entered",
  "Venue ready",
  "Card ready",
  "Three rewards live",
  "Venue QR ready",
  "Poster ready",
  "Billing reached",
  "Billing activated",
  "First customer stamped",
] as const

export function defineMerchantActivationLedgerTests() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("gated admin renders the authoritative 30-day activation cohort", async ({
    context,
    page,
  }) => {
    const skipReason = merchantActivationBrowserSkipReason()
    test.skip(Boolean(skipReason), skipReason)

    let cleanup: (() => Promise<void>) | undefined
    try {
      cleanup = await installSeededAdminAal2Session(context)
      await page.goto("/admin", { waitUntil: "domcontentloaded" })

      expect(new URL(page.url()).pathname).toBe("/admin")
      await expect(
        page.getByRole("heading", { name: "Merchant activation funnel" })
      ).toBeVisible()
      await expect(
        page.getByText(/accounts created in the last 30 days/i)
      ).toBeVisible()
      await expect(
        page.getByText(/authoritative merchant, setup, billing, and stamp ledgers/i)
      ).toBeVisible()

      const funnel = page.getByRole("list", {
        name: "Merchant activation funnel",
      })
      for (const label of ACTIVATION_STAGE_LABELS) {
        await expect(funnel.getByText(label, { exact: true })).toBeVisible()
      }

      await expect(page.getByText(/Median account to poster:/i)).toBeVisible()
      await expect(page.getByText(/First stamp within 7 days:/i)).toBeVisible()
    } finally {
      await cleanup?.()
    }
  })
}

function merchantActivationBrowserSkipReason(): string | undefined {
  if (!isLocalUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, ["http:", "https:"])) {
    return "NEXT_PUBLIC_SUPABASE_URL must point at local Supabase"
  }
  if (!isLocalUrl(process.env.SUPABASE_DB_URL, ["postgres:", "postgresql:"])) {
    return "SUPABASE_DB_URL must point at local Supabase Postgres"
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()) {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY is required for admin cohort proof"
  }
  return undefined
}

function isLocalUrl(
  value: string | undefined,
  protocols: readonly string[]
): boolean {
  if (!value) return false
  try {
    const url = new URL(value)
    return (
      protocols.includes(url.protocol) &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    )
  } catch {
    return false
  }
}
