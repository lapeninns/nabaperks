import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"

import {
  adminLiveDbSkipReason,
  connectLocalDb,
  seedMerchantOwnerEmail,
} from "./helpers/admin-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import { installLocalEmailSession } from "./helpers/admin-auth-session"

const SEED_MERCHANT_SLUG = "old-crown-girton"

export function describeMerchantSafeRedirects(): void {
  test.describe("@admin-live-db merchant safe redirects", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)
    test.use({ serviceWorkers: "block" })

    test.beforeEach(async ({ page }) => {
      await dismissPwaInstall(page)
    })

    test("successful merchant login rejects whitespace open-redirect next payloads", async ({
      page,
    }) => {
      const sql = connectLocalDb()
      test.skip(!sql, "local Supabase DB is not configured")
      if (!sql) return

      let cleanupSession: (() => Promise<void>) | undefined
      const unsafeNext = "/\t/evil.example"

      try {
        const merchantEmail = await seedMerchantOwnerEmail(
          sql,
          SEED_MERCHANT_SLUG
        )
        test.skip(!merchantEmail, "seed merchant owner email is not available")
        if (!merchantEmail) return

        await page.setExtraHTTPHeaders({
          "x-vercel-forwarded-for": localLoopbackIp(randomUUID()),
        })
        await page.goto(`/login?next=${encodeURIComponent(unsafeNext)}`)
        const sameOrigin = new URL(page.url()).origin

        await expect(
          page.getByRole("heading", { name: "Back to the counter" })
        ).toBeVisible()

        await expect(page.getByLabel("Venue email")).toBeVisible()
        await expect(page.locator('input[type="password"]')).toHaveCount(0)
        cleanupSession = await installLocalEmailSession(
          page.context(),
          merchantEmail
        )
        await page.goto(`/login?next=${encodeURIComponent(unsafeNext)}`)

        await expect(page).toHaveURL((url) => url.pathname !== "/login")

        const redirectedUrl = new URL(page.url())
        expect(redirectedUrl.origin).toBe(sameOrigin)
        expect(redirectedUrl.hostname).not.toBe("evil.example")
        expect(redirectedUrl.pathname).toBe("/app")
      } finally {
        if (cleanupSession) await cleanupSession()
        await sql.end({ timeout: 5 })
      }
    })
  })
}

function localLoopbackIp(nonce: string): string {
  const first = Number.parseInt(nonce.slice(0, 2), 16) || 1
  const second = Number.parseInt(nonce.slice(2, 4), 16) || 1
  return `127.${first}.${second}.1`
}
