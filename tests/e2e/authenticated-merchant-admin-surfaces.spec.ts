import { expect, test, type BrowserContext, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"

/**
 * Authenticated console coverage: a real browser logs in with the seeded
 * Supabase email/password accounts, then smoke-checks + axe-scans every
 * merchant (`/app/*`) and admin (`/admin/*`) surface. The merchant block also
 * exercises the QR asset route handlers (image/preview/download) over the
 * authenticated request context, asserting status + Content-Type only since
 * those responses are binary.
 *
 * Merchant and admin run in two serial describe blocks, each owning its own
 * browser context/login, so a failure in one console never leaks session state
 * into the other.
 *
 * Every asserted heading is the `<h1>` rendered by the shared `PageTitle`
 * brand component (components/brand/typography.tsx), so role-based heading
 * queries are stable across data changes. Volatile dashboard numbers are never
 * asserted.
 */

const PASSWORD = "NabaperksDemo1!"

// Seeded qr_codes.id for Old Crown Girton (supabase/seed.sql) — the QR asset
// routes resolve ownership via `qr_codes.id`, not the public `qr_id` slug.
const OLD_CROWN_QR_CODE_ID = "14000000-0000-0000-0000-000000000001"

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/login")
  await page.locator("#email").fill(email)
  await page.locator("#password").fill(PASSWORD)
  // The server-action login form renders `action=""` and relies on JS, so a
  // submit click fired before the page hydrates is silently dropped (no POST).
  // Retry the click until it actually lands the user on the /app console.
  await expect(async () => {
    if (new URL(page.url()).pathname === "/login") {
      await page.getByRole("button", { name: "Log in" }).click()
    }
    await page.waitForURL(/\/app(?:[/?#]|$)/, { timeout: 4000 })
  }).toPass({ timeout: 30000 })
}

async function expectHeading(page: Page, name: string | RegExp): Promise<void> {
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible()
}

async function smokeSurface(
  page: Page,
  label: string,
  path: string,
  heading: string | RegExp
): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.goto(path)
  await expectHeading(page, heading)
  await expectNoAxeViolations(page, label)
}

test.describe("merchant console (authenticated)", () => {
  test.describe.configure({ mode: "serial" })

  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    // axe-core/playwright requires a page from browser.newContext(); a page from
    // browser.newPage() makes AxeBuilder.analyze() throw "Please use newContext".
    context = await browser.newContext()
    page = await context.newPage()
    await signIn(page, "mia@old-crown-girton.test")
    // signInAction redirects to `/app`, which renders the merchant dashboard
    // with the venue's business name as its <h1>.
    await page.waitForURL("**/app")
    await expectHeading(page, "Old Crown Girton")
  })

  test.afterAll(async () => {
    await context.close()
  })

  test("dashboard renders the venue heading and passes axe", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/app")
    await expectHeading(page, "Old Crown Girton")
    await expectNoAxeViolations(page, "merchant dashboard")
  })

  test("launch kit surface renders and passes axe", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/app/launch")
    // Title is launch-readiness dependent: "You're live" once the venue is
    // launch-ready, otherwise "Bring your venue to life".
    await expectHeading(page, /You're live|Bring your venue to life/)
    await expectNoAxeViolations(page, "merchant launch")
  })

  test("activity surface renders and passes axe", async () => {
    await smokeSurface(page, "merchant activity", "/app/activity", "Activity")
  })

  test("customers surface renders and passes axe", async () => {
    await smokeSurface(
      page,
      "merchant customers",
      "/app/customers",
      "Loyalty members"
    )
  })

  test("account profile surface renders and passes axe", async () => {
    await smokeSurface(page, "merchant account", "/app/account", "Profile")
  })

  test("billing legacy route forwards into the account hub", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/app/billing")
    // /app/billing redirects to /app/account?tab=billing (Account hub).
    await page.waitForURL("**/app/account?*")
    await expectHeading(page, "Billing")
    await expectNoAxeViolations(page, "merchant billing")
  })

  test("profile legacy route forwards into the account hub", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/app/profile")
    // /app/profile redirects to /app/account?tab=profile.
    await page.waitForURL("**/app/account?*")
    await expectHeading(page, "Profile")
    await expectNoAxeViolations(page, "merchant profile")
  })

  test("settings legacy route forwards into the account hub", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/app/settings")
    // /app/settings redirects to /app/account?tab=profile.
    await page.waitForURL("**/app/account?*")
    await expectHeading(page, "Profile")
    await expectNoAxeViolations(page, "merchant settings")
  })

  test("onboarding route forwards a completed merchant back to the dashboard", async () => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/app/onboarding")
    // The seeded Old Crown merchant is fully onboarded, so /app/onboarding
    // redirects to /app rather than showing the setup form.
    await page.waitForURL("**/app")
    await expectHeading(page, "Old Crown Girton")
    await expectNoAxeViolations(page, "merchant onboarding redirect")
  })

  test("QR image route returns a PNG for the owned qr code", async () => {
    const response = await page.request.get(
      `/app/qr/image/${OLD_CROWN_QR_CODE_ID}`
    )
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("image/png")
  })

  test("QR preview route returns a PNG for an owned asset", async () => {
    // assetKindFromSlug maps the `till-card` slug to till_card_png; preview
    // always renders PNG. The `qr` query param is the qr_codes.id.
    const response = await page.request.get(
      `/app/qr/preview/till-card?qr=${OLD_CROWN_QR_CODE_ID}`
    )
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("image/png")
  })

  test("QR download route returns a PNG for the sticker asset", async () => {
    // The `sticker` slug maps to sticker_png, which the download route serves
    // as image/png (only the poster asset is application/pdf).
    const response = await page.request.get(
      `/app/qr/download/sticker?qr=${OLD_CROWN_QR_CODE_ID}`
    )
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("image/png")
  })
})

test.describe("admin console (authenticated)", () => {
  test.describe.configure({ mode: "serial" })

  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    // axe-core/playwright requires a page from browser.newContext(); a page from
    // browser.newPage() makes AxeBuilder.analyze() throw "Please use newContext".
    context = await browser.newContext()
    page = await context.newPage()
    await signIn(page, "admin@nabaperks.test")
    // signInAction always redirects to /app, but the admin owns no merchant, so
    // /app forwards on to /app/onboarding (getMerchantOnboardingStatus returns
    // "needs_profile"). Wait only for sign-in to leave /login — the landing
    // path is incidental — then open the admin console directly. The admin is in
    // internal_admins and ADMIN_MFA_REQUIRED=false, so /admin is reachable.
    await page.waitForURL((url) => !url.pathname.endsWith("/login"))
    await page.emulateMedia({ reducedMotion: "reduce" })
    await page.goto("/admin")
    await expectHeading(page, "Admin console")
  })

  test.afterAll(async () => {
    await context.close()
  })

  test("admin home renders and passes axe", async () => {
    await smokeSurface(page, "admin home", "/admin", "Admin console")
  })

  test("merchants surface renders and passes axe", async () => {
    await smokeSurface(page, "admin merchants", "/admin/merchants", "Merchants")
  })

  test("customers surface renders and passes axe", async () => {
    await smokeSurface(page, "admin customers", "/admin/customers", "Customers")
  })

  test("billing surface renders and passes axe", async () => {
    await smokeSurface(page, "admin billing", "/admin/billing", "Billing")
  })

  test("privacy surface renders and passes axe", async () => {
    await smokeSurface(
      page,
      "admin privacy",
      "/admin/privacy",
      "Privacy support"
    )
  })

  test("fraud surface renders and passes axe", async () => {
    await smokeSurface(page, "admin fraud", "/admin/fraud", "Fraud")
  })

  test("audit surface renders and passes axe", async () => {
    await smokeSurface(page, "admin audit", "/admin/audit", "Audit logs")
  })

  test("pilot surface renders and passes axe", async () => {
    await smokeSurface(page, "admin pilot", "/admin/pilot", "Pilot readiness")
  })
})
