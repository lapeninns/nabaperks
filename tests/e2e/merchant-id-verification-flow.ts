import { mkdir } from "node:fs/promises"
import path from "node:path"

import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"
import jsQR from "jsqr"
import { PNG } from "pngjs"

import { adminLiveDbSkipReason, connectLocalDb } from "./helpers/admin-live-db"
import { dismissPwaInstall } from "./helpers/harness"
import {
  cleanupRewardCollectionFixture,
  createRewardCollectionFixture,
  readRewardCollectionState,
} from "./helpers/reward-collection-live-db"
import {
  installRewardCustomerSession,
  installRewardOwnerSession,
} from "./helpers/reward-id-check-sessions"

export function registerMerchantIdVerificationTests() {
  test.describe("merchant in-person ID verification", () => {
    const reason = adminLiveDbSkipReason()
    test.skip(Boolean(reason), reason)
    test.use({
      serviceWorkers: "block",
      ignoreHTTPSErrors: process.env.REWARD_ID_LOOPBACK_HTTPS === "1",
    })
    test.beforeEach(async ({ baseURL }) => {
      if (
        !baseURL ||
        !["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
      ) {
        throw new Error(
          "ID-check fixtures require a loopback application origin"
        )
      }
    })

    test("@a11y @visual customer QR → owner sign-in → ID check → collected on both screens", async ({
      page,
      context,
      browser,
      baseURL,
    }, testInfo) => {
      const sql = connectLocalDb()
      if (!sql || !baseURL)
        throw new Error("Local browser database and base URL are required")
      const fixture = await createRewardCollectionFixture(sql, {
        unverified: true,
      })
      if (!fixture) throw new Error("Seed reward fixture is required")
      const merchantContext = await browser.newContext({
        baseURL,
        viewport: page.viewportSize() ?? undefined,
        isMobile: testInfo.project.use.isMobile,
        hasTouch: testInfo.project.use.hasTouch,
        deviceScaleFactor: testInfo.project.use.deviceScaleFactor,
        userAgent: testInfo.project.use.userAgent,
        reducedMotion: "reduce",
        ignoreHTTPSErrors: process.env.REWARD_ID_LOOPBACK_HTTPS === "1",
      })
      const merchant = await merchantContext.newPage()
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      merchant.on("pageerror", (error) => errors.push(error.message))
      try {
        await dismissPwaInstall(page)
        await dismissPwaInstall(merchant)
        await installRewardCustomerSession(
          sql,
          context,
          fixture.customerId,
          baseURL
        )
        const qrResponse = page.waitForResponse(
          (response) =>
            response
              .url()
              .includes(`/reward/${fixture.rewardEventId}/qr.png`) &&
            response.status() === 200
        )
        await page.goto(`/reward/${fixture.rewardEventId}`)
        await expect(
          page.getByText("Show this code and your photo ID to the venue owner.")
        ).toBeVisible()
        await expect(
          page.getByRole("img", {
            name: `QR code for collecting ${fixture.rewardName}`,
          })
        ).toBeVisible()
        const qr = await qrResponse
        expect(qr.headers()["cache-control"]).toBe("private, no-store")
        const png = PNG.sync.read(await qr.body())
        const decoded = jsQR(
          new Uint8ClampedArray(png.data),
          png.width,
          png.height
        )
        expect(decoded).not.toBeNull()
        if (!decoded) throw new Error("Reward QR could not be decoded")
        const scan = new URL(decoded.data)
        expect(scan.origin).toBe(new URL(baseURL).origin)
        await expect(
          page
            .getByRole("figure", {
              name: `Merchant-scan QR for ${fixture.rewardName}`,
            })
            .locator("[aria-busy]")
        ).toHaveAttribute("aria-busy", "false")
        const qrImage = page.getByRole("img", {
          name: `QR code for collecting ${fixture.rewardName}`,
        })
        // Centre the code above the fixed bottom navigation before scanning
        // the pixels, just as the customer can position it at the counter.
        await qrImage.evaluate((image) =>
          image.scrollIntoView({ block: "center" })
        )
        const renderedQr = PNG.sync.read(await qrImage.screenshot())
        expect(
          jsQR(
            new Uint8ClampedArray(renderedQr.data),
            renderedQr.width,
            renderedQr.height
          )?.data
        ).toBe(decoded.data)
        await assertRenderedQuality(page)
        await screenshotEvidence(
          page,
          `${testInfo.project.name}-customer-id-qr`
        )

        await merchant.goto(scan.pathname)
        await expect(merchant).toHaveURL(/\/login\?next=/)
        await installRewardOwnerSession(sql, merchantContext, baseURL)
        await merchant.goto(scan.pathname)
        await expect(merchant).toHaveURL(/\/app\/rewards\/scan\//)
        await expect(
          merchant.getByRole("heading", { name: "Check and collect reward" })
        ).toBeVisible()
        await expect(
          merchant.getByText("Reward Scan Browser", { exact: true })
        ).toBeVisible()
        await expect(
          merchant.getByText("1 January 1990", { exact: true })
        ).toBeVisible()
        const confirmed = merchant.getByRole("checkbox", {
          name: /I checked the customer/,
        })
        const collect = merchant.getByRole("button", {
          name: "Verify ID and collect reward",
        })
        await expect(confirmed).not.toBeChecked()
        await expect(collect).toBeDisabled()
        await assertRenderedQuality(merchant)
        await screenshotEvidence(
          merchant,
          `${testInfo.project.name}-merchant-id-check`
        )
        await confirmed.focus()
        await merchant.keyboard.press("Space")
        await expect(confirmed).toBeChecked()
        await expect(collect).toBeEnabled()
        const submitted = merchant.waitForResponse(
          (response) =>
            response.request().method() === "POST" &&
            response.url().includes("/app/rewards/scan/")
        )
        let releaseSubmission: () => void = () => {}
        const submissionGate = new Promise<void>((resolve) => {
          releaseSubmission = resolve
        })
        await merchant.route("**/app/rewards/scan/**", async (route) => {
          if (route.request().method() === "POST") await submissionGate
          await route.fallback()
        })
        await collect.click()
        try {
          await expect(
            merchant.getByRole("button", { name: "Marking collected…" })
          ).toBeDisabled()
          await expect(confirmed).toBeDisabled()
        } finally {
          releaseSubmission()
        }
        await submitted
        await expect(
          merchant.getByRole("alert").filter({ hasText: "Reward collected" })
        ).toBeVisible()
        await expect(
          page.getByRole("alert").filter({ hasText: "Reward collected." })
        ).toBeVisible()
        await expect(
          page.getByRole("img", {
            name: `QR code for collecting ${fixture.rewardName}`,
          })
        ).toHaveCount(0)
        const state = await readRewardCollectionState(
          sql,
          fixture.rewardEventId
        )
        expect(state?.reward_status).toBe("redeemed")
        expect(state?.consumed).toBe(true)
        expect(state?.next_cycle_count).toBe(0)
        const [verified] =
          await sql`select date_of_birth_verification_source from public.customers where id = ${fixture.customerId}::uuid`
        expect(verified.date_of_birth_verification_source).toBe(
          "merchant_owner"
        )
        await merchant.goto(scan.pathname)
        await expect(
          merchant.getByRole("alert").filter({ hasText: "Reward collected" })
        ).toBeVisible()
        await expect(merchant.getByRole("checkbox")).toHaveCount(0)
        expect(errors).toEqual([])
      } finally {
        await merchantContext.close()
        await cleanupRewardCollectionFixture(sql, fixture)
        await sql.end()
      }
    })

    test("missing or mismatched ID leaves the reward untouched; a DOB edit invalidates the open form", async ({
      page,
      context,
      baseURL,
    }) => {
      const sql = connectLocalDb()
      if (!sql || !baseURL)
        throw new Error("Local browser database and base URL are required")
      const fixture = await createRewardCollectionFixture(sql, {
        unverified: true,
      })
      if (!fixture) throw new Error("Seed reward fixture is required")
      try {
        await dismissPwaInstall(page)
        await installRewardOwnerSession(sql, context, baseURL)
        await page.goto(`/r/${fixture.scanToken}`)
        await expect(page.getByText(/No ID or a mismatch\?/)).toBeVisible()
        const collect = page.getByRole("button", {
          name: "Verify ID and collect reward",
        })
        await expect(collect).toBeDisabled()
        expect(
          (await readRewardCollectionState(sql, fixture.rewardEventId))
            ?.reward_status
        ).toBe("unlocked")
        await page.getByRole("checkbox").check()
        await sql`update public.customers set date_of_birth = date '1991-02-03' where id = ${fixture.customerId}::uuid`
        await collect.click()
        await expect(
          page.getByRole("alert").filter({ hasText: "Reward not collected" })
        ).toBeVisible()
        expect(
          (await readRewardCollectionState(sql, fixture.rewardEventId))
            ?.consumed
        ).toBe(false)
        await page.reload()
        await expect(page.getByRole("checkbox")).toHaveCount(0)
        await expect(
          page.getByText("Reward Scan Browser", { exact: true })
        ).toHaveCount(0)
      } finally {
        await cleanupRewardCollectionFixture(sql, fixture)
        await sql.end()
      }
    })

    test("already-verified customers retain ordinary collection without another ID confirmation", async ({
      page,
      context,
      baseURL,
    }) => {
      const sql = connectLocalDb()
      if (!sql || !baseURL)
        throw new Error("Local browser database and base URL are required")
      const fixture = await createRewardCollectionFixture(sql)
      if (!fixture) throw new Error("Seed reward fixture is required")
      try {
        await dismissPwaInstall(page)
        await installRewardOwnerSession(sql, context, baseURL)
        await page.goto(`/r/${fixture.scanToken}`)
        await expect(page.getByRole("checkbox")).toHaveCount(0)
        await page
          .getByRole("button", { name: "Mark reward collected" })
          .click()
        await expect(
          page.getByRole("alert").filter({ hasText: "Reward collected" })
        ).toBeVisible()
        expect(
          (await readRewardCollectionState(sql, fixture.rewardEventId))
            ?.consumed
        ).toBe(true)
      } finally {
        await cleanupRewardCollectionFixture(sql, fixture)
        await sql.end()
      }
    })
  })
}

async function assertRenderedQuality(page: Page) {
  const results = await new AxeBuilder({ page }).include("main").analyze()
  expect(results.violations).toEqual([])
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    )
  ).toBe(false)
  await expect(page.locator("nextjs-error-overlay")).toHaveCount(0)
}

async function screenshotEvidence(page: Page, name: string) {
  const directory = process.env.REWARD_ID_SCREENSHOT_DIR
  if (!directory) return
  await mkdir(directory, { recursive: true })
  await page.screenshot({
    path: path.join(directory, `${name}.png`),
    fullPage: true,
  })
}
