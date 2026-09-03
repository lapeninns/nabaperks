import { expect, test, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import {
  AUTH_PASSWORD_POLICY_USER_AGENT,
  assertPublicLocalPasswordlessAuth,
  authPasswordPolicyLiveDbSkipReason,
} from "./helpers/auth-password-policy-live-db"
import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

export function defineAuthPasswordPolicyTests() {
  test.use({ serviceWorkers: "block" })
  test.use({ userAgent: AUTH_PASSWORD_POLICY_USER_AGENT })

  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("signup collects identity without creating a reusable password", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/signup")

    await expect(page.getByLabel("Your name")).toBeVisible()
    await expect(page.getByLabel("Email", { exact: true })).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expectFocusedHomeContract(page)
    await expectNoHorizontalOverflow(page)
    await expectNoAxeViolations(page, "passwordless signup")
  })

  test("login requests an email code and exposes no password field", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/login")

    await expect(page.getByLabel("Venue email")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Email me a sign-in code" })
    ).toBeVisible()
    await expect(page.locator('input[type="password"]')).toHaveCount(0)
    await expectFocusedHomeContract(page)
    await expectNoHorizontalOverflow(page)
    await expectNoAxeViolations(page, "passwordless login")
  })

  test.describe("public local Supabase passwordless boundary", () => {
    const skipReason = authPasswordPolicyLiveDbSkipReason()
    test.skip(Boolean(skipReason), skipReason)

    test("password grant is denied while email OTP remains valid", async ({}, testInfo) => {
      test.skip(
        testInfo.project.name !== "chromium",
        "provider-mutating proof runs once in Chromium"
      )
      if (testInfo.config.workers !== 1) {
        throw new Error("Local Auth proof requires one Playwright worker.")
      }
      await assertPublicLocalPasswordlessAuth()
    })
  })
}

async function expectFocusedHomeContract(page: Page) {
  await expect(
    page.getByRole("link", { name: "Nabaperks home", exact: true })
  ).toHaveCount(1)
  await expect(
    page.getByRole("link", { name: "Terms", exact: true })
  ).toBeVisible()
  await expect(
    page.getByRole("link", { name: "Privacy", exact: true })
  ).toBeVisible()
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(1)
}
