import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

const sizes = [
  [320, 568],
  [360, 640],
  [375, 667],
  [390, 844],
  [414, 896],
  [430, 932],
  [480, 960],
  [375, 360],
  [844, 390],
] as const

async function expectControlsInsideScreen(page: Page) {
  const clipped = await page
    .locator("button, input:not([type=hidden]), a[href], summary")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const box = element.getBoundingClientRect()
          return (
            box.width > 1 &&
            box.height > 1 &&
            !element.closest('[aria-hidden="true"]') &&
            (box.left < -1 || box.right > innerWidth + 1)
          )
        })
        .map(
          (element) =>
            element.textContent?.trim() || element.getAttribute("name")
        )
    )
  expect(clipped).toEqual([])
}

async function requestCode(page: Page) {
  await page.getByLabel("Phone number", { exact: true }).fill("07700900123")
  await page.getByRole("button", { name: "Send code", exact: true }).click()
  await expect(
    page.getByRole("heading", { name: "Enter your code" })
  ).toBeVisible()
}

export function describeCustomerMobileLayout() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  for (const [width, height] of sizes) {
    test(`wallet and verification fit ${width}x${height}`, async ({ page }) => {
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await page.setViewportSize({ width, height })
      for (const long of ["0", "1"]) {
        await gotoHydratedPage(
          page,
          `/dev/home-harness/home?dob=set&reward=ready&long=${long}`
        )
        await page.evaluate(() => document.fonts.ready)
        const banner = page.getByRole("link", { name: /^Open reward QR for/ })
        await expect(banner).toBeVisible()
        await expectControlsInsideScreen(page)
        const bounds = await banner.boundingBox()
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width - 15)
        await banner.click({ trial: true })
      }
      await gotoHydratedPage(page, "/dev/customer-login")
      await requestCode(page)
      await page.evaluate(() => window.scrollTo(0, 0))
      const primary = page.getByRole("button", { name: "Open my cards" })
      const resend = page.getByRole("button", { name: "Resend code" })
      expect((await primary.boundingBox())!.y).toBeLessThan(
        (await resend.boundingBox())!.y
      )
      if (height >= 568) await expect(primary).toBeInViewport({ ratio: 1 })
      await page.getByLabel("Phone code").fill("424242")
      await primary.click({ trial: true })
      await expectControlsInsideScreen(page)
      expect(errors).toEqual([])
    })
  }

  test("stamp actions stay above navigation on small and landscape phones", async ({
    page,
  }) => {
    for (const [width, height] of [
      [320, 568],
      [844, 390],
    ]) {
      await page.setViewportSize({ width, height })
      for (const state of ["ready", "verify"]) {
        await gotoHydratedPage(
          page,
          `/dev/welcome-offer?surface=stamp&state=${state}`
        )
        await page.evaluate(() => {
          window.scrollTo(0, 0)
          return document.fonts.ready
        })
        const action = page.getByRole("button", {
          name: state === "ready" ? "Add today's stamp" : "Use my location",
          exact: true,
        })
        const box = (await action.boundingBox())!
        const nav = (await page
          .getByRole("navigation", { name: "Home navigation" })
          .boundingBox())!
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.y + box.height).toBeLessThanOrEqual(nav.y)
        const datedStamp = page.getByRole("img", {
          name: "Stamp 3 earned, 12 Sep",
          exact: true,
        })
        await expect(datedStamp).toBeVisible()
        const clippedStampText = await datedStamp.evaluate((element) => {
          const disc = element.getBoundingClientRect()
          return [...element.querySelectorAll("span")]
            .filter((span) => {
              if (span.children.length || !span.textContent?.trim())
                return false
              const text = span.getBoundingClientRect()
              return (
                text.width > 0 &&
                text.height > 0 &&
                (text.left < disc.left ||
                  text.right > disc.right ||
                  text.top < disc.top ||
                  text.bottom > disc.bottom)
              )
            })
            .map((span) => span.textContent)
        })
        expect(clippedStampText).toEqual([])
        await action.click({ trial: true })
        await expectControlsInsideScreen(page)
      }
    }
  })

  test("wallet cards and blocked-location code stay in reach on small phones", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "HTMLGeolocationElement", {
        value: undefined,
        configurable: true,
      })
      Object.defineProperty(navigator.geolocation, "getCurrentPosition", {
        configurable: true,
        value: (_success: PositionCallback, failure: PositionErrorCallback) =>
          failure({
            code: 1,
            message: "Fixture permission denied",
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          }),
      })
    })

    for (const [width, height] of sizes.filter(
      ([width, height]) => width <= 480 && height >= 568
    )) {
      await page.setViewportSize({ width, height })
      await gotoHydratedPage(page, "/dev/home-harness/home?dob=set")
      await page.evaluate(() => document.fonts.ready)
      const card = page.getByRole("link", {
        name: "Open your Old Crown Girton card",
      })
      // The first useful card should start in the top half even on a 568px
      // phone, instead of a large introductory summary taking that space.
      expect((await card.boundingBox())!.y).toBeLessThan(284)
      await expect(
        page.getByText("Scan the QR at the venue to collect.")
      ).toBeVisible()

      await gotoHydratedPage(
        page,
        "/dev/welcome-offer?surface=stamp&state=verify"
      )
      await page.evaluate(() => document.fonts.ready)
      await page
        .getByRole("button", { name: "Use my location", exact: true })
        .click()
      const root = page.locator("[data-stamp-phase]")
      await expect(root).toHaveAttribute("data-stamp-phase", "blocked")
      await page.evaluate(() => window.scrollTo(0, 0))
      const input = root.getByLabel("Today's code from a team member")
      const submit = root.getByRole("button", {
        name: "Add my stamp",
        exact: true,
      })
      const nav = (await page
        .getByRole("navigation", { name: "Home navigation" })
        .boundingBox())!
      for (const control of [input, submit]) {
        const box = (await control.boundingBox())!
        expect(box.y).toBeGreaterThanOrEqual(0)
        expect(box.y + box.height).toBeLessThanOrEqual(nav.y)
      }
      expect((await submit.boundingBox())!.y).toBeLessThan(
        (await root
          .getByRole("button", { name: "Try Again", exact: true })
          .boundingBox())!.y
      )
      await expectControlsInsideScreen(page)
    }
  })

  test("verification, resend and number correction replace stale feedback", async ({
    page,
  }) => {
    await gotoHydratedPage(page, "/dev/customer-login")
    await requestCode(page)
    await page.getByLabel("Phone code").fill("000000")
    await page.getByRole("button", { name: "Open my cards" }).click()
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "That code was not accepted."
    )
    await page.getByRole("button", { name: "Resend code" }).click()
    await expect(
      page.getByRole("status").filter({ hasText: /If a code arrives/ })
    ).toBeVisible()
    await expect(page.locator("main").getByRole("alert")).toHaveCount(0)
    await page
      .getByRole("button", { name: "Wrong number? Use a different one" })
      .click()
    const phone = page.getByLabel("Phone number", { exact: true })
    await expect(phone).toBeFocused()
    await expect(page.getByLabel("Phone code")).toHaveCount(0)
    await phone.fill("123")
    await page.getByRole("button", { name: "Send code", exact: true }).click()
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "Enter a valid phone number."
    )
    await phone.fill("07700900456")
    await page.getByRole("button", { name: "Send code", exact: true }).click()
    await expect(page.getByText("Phone ending 0456")).toBeVisible()
    await page.getByLabel("Phone code").fill("424242")
    await page.getByRole("button", { name: "Open my cards" }).click()
    await expect(page.getByRole("status")).toContainText(
      "Display verification complete"
    )
    expect(await page.context().cookies()).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "nabaperks_customer_session" }),
      ])
    )
  })

  test("expired, unavailable and unknown-number outcomes retain a way forward", async ({
    page,
  }) => {
    for (const scenario of [
      "expired",
      "verify-error",
      "unknown",
      "resend-error",
    ]) {
      await gotoHydratedPage(page, `/dev/customer-login?scenario=${scenario}`)
      await requestCode(page)
      if (scenario === "resend-error") {
        await page.getByRole("button", { name: "Resend code" }).click()
        await expect(page.locator("main").getByRole("alert")).toContainText(
          "couldn't send a code"
        )
      } else {
        await page.getByLabel("Phone code").fill("424242")
        await page.getByRole("button", { name: "Open my cards" }).click()
        if (scenario === "verify-error") {
          await expect(page.locator("main").getByRole("alert")).toContainText(
            "couldn't check that code"
          )
          await expect(
            page.getByRole("button", { name: "Resend code" })
          ).toBeVisible()
          continue
        }
        await expect(
          page.getByText(
            scenario === "expired"
              ? "Request a new phone code."
              : /No cards found/
          )
        ).toBeVisible()
        if (scenario === "unknown") {
          await expect(
            page.getByRole("link", { name: "Scan a venue QR" })
          ).toHaveAttribute("href", "/scan")
          await expect(
            page.getByRole("button", { name: "Send code", exact: true })
          ).toHaveCount(0)
          continue
        }
      }
      await expect(
        page.getByRole("button", { name: "Send code", exact: true })
      ).toBeVisible()
    }
  })

  test("welcome and card disclosures have usable touch areas without hydration errors", async ({
    page,
  }) => {
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.setViewportSize({ width: 320, height: 568 })
    await gotoHydratedPage(
      page,
      "/dev/welcome-offer?surface=welcome&offer=none"
    )
    const how = page.locator("summary").filter({ hasText: /How it works/i })
    expect((await how.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await how.click()
    await expect(page.locator("details[open] ol")).toBeVisible()
    const terms = page.getByRole("button", { name: "View full venue terms" })
    expect((await terms.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await terms.click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.getByRole("button", { name: "Close", exact: true }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await gotoHydratedPage(page, "/dev/welcome-offer?surface=card&offer=none")
    const details = page.locator("summary").filter({ hasText: "Card details" })
    expect((await details.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await details.click()
    await expect(page.locator("details[open]")).toContainText(
      "One stamp per venue trading day"
    )
    expect(errors).toEqual([])
  })
}
