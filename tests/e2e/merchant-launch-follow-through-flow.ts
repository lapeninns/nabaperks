import { expect, test } from "@playwright/test"

import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

const PROMO_PERK =
  "Go live by 31 July 2026 and we print and post your first counter-poster run — free."
const PROMO_CLAIM =
  "Go live before the date, then email info@lapeninns.com and we sort your print run."

export function defineMerchantLaunchFollowThroughTests() {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("incomplete dashboard exposes only its true next job @a11y @visual", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.dashboard}?setup=incomplete`)

    await expect(page.getByText("2 of 5 complete")).toBeVisible()
    const finishSetup = page.getByRole("link", { name: "Finish setup" })
    await expect(finishSetup).toBeVisible()
    await expect(finishSetup).toHaveAttribute("href", "/app/launch?tab=rewards")
    const main = page.getByRole("main")
    await expect(main.getByRole("link", { name: "Scan reward" })).toHaveCount(0)
    await expect(main.getByRole("link", { name: "Announce" })).toHaveCount(0)
    await expectNoAxeViolations(page, "incomplete merchant dashboard")
    await expectNoHorizontalOverflow(page)
    await expect(page.getByRole("img", { name: /^QR code for / })).toHaveCount(
      0
    )
    await expect(page).toHaveScreenshot(
      "dashboard-incomplete-follow-through.png",
      {
        fullPage: true,
        maxDiffPixelRatio: 0.001,
      }
    )
  })

  test("zero-member dashboard replaces KPI zeros with an encouraging QR next action @MS-merchant-ux-audit-closure @a11y", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.dashboard}?members=empty`)

    await expect(
      page.getByRole("heading", {
        name: "No members yet — that's expected",
      })
    ).toBeVisible()
    await expect(
      page.getByRole("heading", { name: "How the week is going" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: "Show full screen", exact: true })
    ).toBeVisible()
    await expect(page.getByRole("heading", { name: "Do next" })).toHaveCount(0)
    await expect(
      page.getByRole("heading", { name: "No activity yet" })
    ).toBeVisible()
    await expect(page.getByText(/Phone ending/)).toHaveCount(0)
    await expectNoAxeViolations(page, "zero-member merchant dashboard")
    await expectNoHorizontalOverflow(page)
  })

  test("billing-gated dashboard sends the merchant to billing", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.dashboard}?qr=gated`)

    const finishSetup = page.getByRole("link", { name: "Finish setup" })
    await expect(finishSetup).toHaveAttribute("href", "/app/launch?tab=billing")
    await expect(
      page.getByRole("main").getByRole("link", { name: "Scan reward" })
    ).toHaveCount(0)
  })

  test("live and paused launched dashboards retain counter actions", async ({
    page,
  }) => {
    for (const suffix of ["", "?qr=paused"]) {
      await page.goto(`${HARNESS_ROUTES.dashboard}${suffix}`)
      const main = page.getByRole("main")
      await expect(
        main.getByRole("link", { name: "Scan reward" })
      ).toBeVisible()
      await expect(main.getByRole("link", { name: "Announce" })).toBeVisible()
      await expect(
        page.getByRole("link", { name: "Finish setup" })
      ).toHaveCount(0)
    }
  })

  test("readiness rail is obvious, focusable, and keeps ready QR in the hub", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=billing&tab=qr`)

    const rail = page.getByRole("navigation", {
      name: "Merchant setup steps",
    })
    await expect(rail).toBeVisible()
    await expect(rail.getByText("Choose a setup step")).toBeVisible()

    const qrStep = rail.getByRole("link", { name: "Venue QR, to do" })
    await expect(qrStep).toHaveAttribute("href", "/app/launch?tab=qr")
    await expect(
      rail.getByRole("link", { name: "Billing, next up" })
    ).toBeVisible()

    await qrStep.focus()
    await expect(qrStep).toBeFocused()
    const focus = await qrStep.evaluate((element) => {
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return {
        height: rect.height,
        outlineStyle: style.outlineStyle,
        outlineWidth: style.outlineWidth,
      }
    })
    expect(focus.height).toBeGreaterThanOrEqual(44)
    expect(focus.outlineStyle).not.toBe("none")
    expect(focus.outlineWidth).not.toBe("0px")
    await expectNoHorizontalOverflow(page)
  })

  test("billing-locked QR has no image or poster controls", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=billing&tab=qr`)

    await expect(
      page.getByRole("heading", {
        name: "Activate billing to unlock your venue QR",
      })
    ).toBeVisible()
    await expect(page.getByRole("img", { name: /^QR code for / })).toHaveCount(
      0
    )
    await expect(
      page.getByRole("button", { name: "Email poster PDFs" })
    ).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Go to billing" })
    ).toHaveAttribute("href", "/app/launch?tab=billing")
    await expectNoHorizontalOverflow(page)
  })

  test("lapsed billing keeps the QR visible while scans are paused", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=lapsed&tab=qr`)

    await expect(page.getByText("Enabled · scans paused")).toBeVisible()
    await expect(page.getByText("Scans paused — fix billing")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Email poster PDFs" })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Disable QR" })).toBeVisible()
    await expectVenueQrLoaded(page)
    await expectNoHorizontalOverflow(page)
  })

  test("lapsed billing stays paused when rewards are also incomplete", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=lapsed&pool=two&tab=qr`)

    await expect(page.getByText("Enabled · scans paused")).toBeVisible()
    await expect(page.getByText("Scans paused — fix billing")).toBeVisible()
    await expect(page.getByText("Live · accepting scans")).toHaveCount(0)
    await expect(
      page.getByRole("link", { name: "Fix billing" })
    ).toHaveAttribute("href", "/app/launch?tab=billing")
    await expectNoHorizontalOverflow(page)
  })

  test("post-billing QR moment is truthful, phone-native, and visually approved @a11y @visual", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=live&tab=qr`)

    await expect(page.getByText(PROMO_PERK)).toBeVisible()
    await expect(page.getByText(PROMO_CLAIM)).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Email poster PDFs" })
    ).toBeVisible()
    await expect(page.getByText(/On a phone/i)).toBeVisible()
    await expect(page.getByText(/all five poster PDFs/i)).toBeVisible()
    await expect(page.getByText(/email yourself the poster link/i)).toHaveCount(
      0
    )
    await expect(page.getByText(/on its way/i)).toHaveCount(0)
    await expect(page.getByText("Step 01")).toBeVisible()
    await expect(page.getByText("Step 02")).toBeVisible()
    await expect(page.getByText("Set up at the till")).toBeVisible()
    await expect(page.getByText("Brief the team")).toBeVisible()
    await expectNoAxeViolations(page, "merchant poster follow-through")
    await expectNoHorizontalOverflow(page)
    await expectVenueQrLoaded(page)
    await expect(page).toHaveScreenshot("launch-qr-follow-through.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.001,
    })
  })

  test("live launch harness does not contradict its QR state", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?state=live&tab=qr`)

    await expect(page.getByText("Live · accepting scans")).toBeVisible()
    await expect(page.getByText("Scans paused — fix billing")).toHaveCount(0)
  })

  test("panel content does not restart the global setup numbering", async ({
    page,
  }) => {
    await page.goto(`${HARNESS_ROUTES.launch}?tab=card`)
    await expect(page.getByText("Step 2", { exact: true })).toHaveCount(0)

    await page.goto(`${HARNESS_ROUTES.launch}?tab=billing`)
    await expect(page.getByText(/Step 5 of 5/)).toHaveCount(0)
  })
}

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page
) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  )
  expect(overflow).toBeLessThanOrEqual(1)
}

async function expectVenueQrLoaded(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  const qr = page.getByRole("img", { name: /^QR code for / })
  await expect(qr).toBeVisible()
  await expect
    .poll(() =>
      qr.evaluate(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth > 0
      )
    )
    .toBe(true)
}
