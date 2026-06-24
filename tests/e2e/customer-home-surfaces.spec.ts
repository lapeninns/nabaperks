import { expect, test, type BrowserContext, type Page } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"

/**
 * Authenticated customer "home" shell smoke + accessibility, plus session reset.
 *
 * Seeded customers have no phone, so `/home/login` alone cannot sign one in. We
 * first mint a phone-bearing customer through the real join flow against the
 * permanent Old Crown Girton venue QR (`/q/old-crown-girton-qr`), reusing the
 * exact selectors proven by `customer-flow-screenshots.spec.ts`, with the dev
 * OTP bypass (`424242`). That sets the signed customer session cookie. We then
 * smoke + axe each home surface, exercise `/home/login` re-entry for the same
 * phone, and finally hit `/home/session/reset` and confirm the session clears.
 *
 * One shared, serial context. The join is run ONCE in `beforeAll`, not per test:
 * the customer + Old Crown membership persist server-side, so a second join from
 * the same phone takes the returning-member branch in `verifyCustomerOtpAction`
 * (`destinationForReturningQrVisit`, issueStamp) and never reaches the terms
 * step — re-running the full wizard each test would hang on "Loyalty terms".
 * The destructive `/home/session/reset` and re-login tests run last so they do
 * not strip the session out from under the surface smoke tests.
 *
 * A distinct, libphonenumber-valid GB mobile (07911123456) is used so this spec
 * never collides with the demo phone the screenshots/reward specs drive. The
 * Ofcom drama-reserved 07700 900xxx range is deliberately NOT used — strict
 * libphonenumber validation rejects it on the join form.
 */

const phone = "07911123456"
const otpCode = process.env.CUSTOMER_DEV_OTP_CODE ?? "424242"

const surfaces = [
  { name: "home", path: "/home", heading: "Your cards" },
  { name: "activity", path: "/home/activity", heading: "Activity" },
  { name: "profile", path: "/home/profile", heading: "Your details" },
  { name: "rewards", path: "/home/rewards", heading: "Rewards" },
] as const

test.describe.configure({ mode: "serial" })

test.describe("customer home surfaces (real session)", () => {
  let context: BrowserContext
  let page: Page

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext()
    page = await context.newPage()
    // Dismiss the PWA install prompt up front — its fixed banner otherwise
    // intercepts pointer events over the join wizard's controls.
    await page.addInitScript(() => {
      window.localStorage.setItem("nabaperks:pwa-install-dismissed:v2", "1")
    })
    await page.emulateMedia({ reducedMotion: "reduce" })
    await joinViaVenueQr(page)
  })

  test.afterAll(async () => {
    await context.close()
  })

  test("join lands the customer on an authed card surface", async () => {
    // The join (or returning-member) flow leaves us inside the card surface for
    // this membership — the proof a signed customer session was minted.
    await expect(page).toHaveURL(/\/card\/[^/]+/)
  })

  for (const surface of surfaces) {
    test(`${surface.name} renders its heading with no axe violations`, async () => {
      await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto(surface.path)

      await expect(
        page.getByRole("heading", { name: surface.heading, exact: true })
      ).toBeVisible()
      // The customer app shell's bottom tab bar is present on every authed
      // surface — a stable structural signal independent of per-page copy.
      await expect(
        page.getByRole("navigation", { name: "Home navigation" })
      ).toBeVisible()

      await expectNoAxeViolations(page, `customer ${surface.name}`)
    })
  }

  test("signed-in customer can re-enter via /home/login with the same phone", async () => {
    // Drop the session, then prove the phone-OTP login path restores it. The
    // request form sends a code first ("Send code"); the verify form opens the
    // cards ("Open my cards"). The existing-customer branch shows this message.
    await page.goto("/home/session/reset")
    await expect(page).toHaveURL(/\/home\/login/)

    await page.goto("/home/login")
    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible()

    await page.getByLabel("Phone number").fill(phone)
    await page.getByRole("button", { name: "Send code" }).click()
    await expect(
      page.getByText(
        "If that number has Nabaperks cards, enter the code we sent. Otherwise scan a venue QR to join first."
      )
    ).toBeVisible()

    await page.getByLabel("Phone code").fill(otpCode)
    await page.getByRole("button", { name: "Open my cards" }).click()

    // Verification redirects to the safe `next` target (defaulting to /home).
    await expect(page).toHaveURL(/\/home(\/|$|\?)/)
    await expect(
      page.getByRole("heading", { name: "Your cards" })
    ).toBeVisible()
  })

  test("session reset clears the session and re-gates /home behind login", async () => {
    // The authed surface is reachable while the session holds.
    await page.goto("/home")
    await expect(
      page.getByRole("heading", { name: "Your cards" })
    ).toBeVisible()

    // The reset route is a GET that clears the cookie and redirects to login.
    await page.goto("/home/session/reset")
    await expect(page).toHaveURL(/\/home\/login/)

    // With the session gone, the authed layout bounces /home to login.
    await page.goto("/home")
    await expect(page).toHaveURL(/\/home\/login/)
    await expect(
      page.getByRole("heading", { name: "Welcome back" })
    ).toBeVisible()
  })
})

/**
 * Drives the shipped join wizard from the permanent venue QR to an authed card
 * surface, leaving a signed customer session cookie on the context. Selectors
 * mirror `customer-flow-screenshots.spec.ts`, which proves them against the live
 * stack.
 *
 * The terms step only renders for a brand-new membership; a returning member
 * (same phone re-joining a venue they already belong to) is redirected straight
 * to their card after OTP. The helper tolerates both: it walks the terms step
 * when it appears, then waits for the `/card/<id>` landing either way.
 */
async function joinViaVenueQr(page: Page): Promise<void> {
  await page.goto("/q/old-crown-girton-qr")
  await expect(
    page.getByRole("heading", { name: "Keep your card on your phone" })
  ).toBeVisible()
  await page.getByRole("link", { name: "Get today's stamp" }).click()

  await page.getByLabel("Phone number").fill(phone)
  await page.getByRole("button", { name: "Text me the code" }).click()
  await expect(
    page.getByText("Enter the verification code sent to your phone.")
  ).toBeVisible()

  await page.getByLabel("Text code").fill(otpCode)
  await page.getByRole("button", { name: "Save my card" }).click()

  // New membership: the terms gate appears before the first stamp. Returning
  // member: OTP redirects straight to the card and there is no terms step.
  const termsHeading = page.getByText("Loyalty terms", { exact: true })
  const onCard = page.waitForURL(/\/card\/[^/]+/)
  await Promise.race([
    termsHeading.waitFor({ state: "visible" }),
    onCard.then(() => undefined),
  ])

  if (await termsHeading.isVisible()) {
    await page.locator('input[name="loyaltyTerms"]').check()
    await page.getByRole("button", { name: "Get my first stamp" }).click()
  }

  await page.waitForURL(/\/card\/[^/]+/)
}
