import { expect, test, type Page } from "@playwright/test"
import { expectNoAxeViolations } from "./helpers/axe"
import { dismissPwaInstall } from "./helpers/harness"

type FixOutcome =
  | "denied"
  | "timeout"
  | "unavailable"
  | "poor"
  | "granted"
  | "pending"
  | "throw"

// Test-only browser responses; no site/system permission is changed. The real
// production capture function still owns cancellation, classification and retry.
async function captureSequence(
  page: Page,
  outcomes: FixOutcome[],
  permission: "missing" | "throw" | "denied" = "missing"
) {
  await page.addInitScript(
    ({ outcomes, permission }) => {
      let calls = 0
      Object.defineProperty(window, "locationTestCalls", { get: () => calls })
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(
            success: PositionCallback,
            failure: PositionErrorCallback,
            options: PositionOptions
          ) {
            if (!navigator.userActivation.isActive)
              throw new Error("GPS must start on a user tap")
            const outcome = outcomes[Math.min(calls++, outcomes.length - 1)]
            if (options.timeout != null)
              throw new Error("browser timeout quiet-blocks Chrome")
            if (options.maximumAge !== 0 || !options.enableHighAccuracy)
              throw new Error("expected a fresh precise fix")
            if (outcome === "throw") throw new Error("browser failure")
            if (outcome === "pending") {
              setTimeout(
                () =>
                  success({
                    coords: {
                      latitude: 52.2437,
                      longitude: 0.0836,
                      accuracy: 12,
                    },
                  } as GeolocationPosition),
                800
              )
              return
            }
            setTimeout(() => {
              if (outcome === "granted" || outcome === "poor") {
                success({
                  coords: {
                    latitude: 52.2437,
                    longitude: 0.0836,
                    accuracy: outcome === "poor" ? 101 : 12,
                  },
                } as GeolocationPosition)
              } else {
                failure({
                  code:
                    outcome === "denied" ? 1 : outcome === "timeout" ? 3 : 2,
                  PERMISSION_DENIED: 1,
                  POSITION_UNAVAILABLE: 2,
                  TIMEOUT: 3,
                  message: outcome,
                })
              }
            }, 20)
          },
        },
      })
      Object.defineProperty(window, "HTMLGeolocationElement", {
        configurable: true,
        value: undefined,
      })
      Object.defineProperty(navigator, "permissions", {
        configurable: true,
        value:
          permission === "missing"
            ? undefined
            : {
                query: () =>
                  permission === "throw"
                    ? Promise.reject(new Error("unsupported"))
                    : Promise.resolve({ state: "denied" }),
              },
      })
    },
    { outcomes, permission }
  )
}

async function open(page: Page, mode = "verify-located") {
  await dismissPwaInstall(page)
  await page.goto(`/dev/home-harness/stamp?mode=${mode}&delay=100`)
  await expect(page.locator("[data-submit-count]")).toHaveText("0")
  return page.locator("[data-stamp-phase]")
}

export function registerLocationRecoveryTests() {
  test.describe("location recovery", () => {
    test("denial, repeated retry and restored fix submit once without a reload or Permissions API", async ({
      page,
    }) => {
      const errors: string[] = []
      page.on("pageerror", (error) => errors.push(error.message))
      await captureSequence(page, ["denied", "denied", "granted"])
      const root = await open(page)
      await root.getByRole("button", { name: "Use my location" }).click()
      await expect(
        root.getByText("Location access is blocked", { exact: true })
      ).toBeVisible()
      await root.getByRole("button", { name: "Try Again", exact: true }).click()
      await expect(page.locator("[data-submit-count]")).toHaveText("0")
      await expect(root).not.toHaveAttribute("aria-busy", "true")
      await root.getByRole("button", { name: "Try Again", exact: true }).click()
      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      await expect(page.locator("[data-submit-count]")).toHaveText("1")
      await expect(page.locator("[data-last-location-status]")).toHaveText(
        "granted"
      )
      await expect(page.locator("[data-refresh-count]")).toHaveText("0")
      expect(
        await page.evaluate(() => Reflect.get(window, "locationTestCalls"))
      ).toBe(3)
      expect(errors).toEqual([])
    })

    for (const permission of ["throw", "denied"] as const) {
      test(`a granted callback wins when Permissions API is ${permission}`, async ({
        page,
      }) => {
        await captureSequence(page, ["granted"], permission)
        const root = await open(page)
        await root.getByRole("button", { name: "Use my location" }).click()
        await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
        await expect(page.locator("[data-submit-count]")).toHaveText("1")
      })
    }

    for (const [outcome, title] of [
      ["timeout", "Location took too long"],
      ["unavailable", "Location is unavailable"],
      ["poor", "Location isn't accurate enough"],
      ["throw", "Location is unavailable"],
    ] as const) {
      test(`${outcome} has separate copy, sends nothing and can retry`, async ({
        page,
      }) => {
        await captureSequence(page, [outcome, "granted"])
        const root = await open(page)
        await root.getByRole("button", { name: "Use my location" }).click()
        await expect(root.getByText(title, { exact: true })).toBeVisible()
        await expect(
          root.locator("[data-location-permission-help]")
        ).toHaveCount(0)
        await expect(
          root.locator("[data-stamp-status-band]")
        ).not.toContainText(/outside|blocked/)
        await expect(page.locator("[data-submit-count]")).toHaveText("0")
        await root
          .getByRole("button", { name: "Try Again", exact: true })
          .click()
        await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
        await expect(page.locator("[data-submit-count]")).toHaveText("1")
      })
    }

    test("a precise out-of-range server refusal keeps retry and code, never grace", async ({
      page,
    }) => {
      await captureSequence(page, ["granted"])
      const root = await open(page, "verify-out-of-range")
      await root.getByRole("button", { name: "Use my location" }).click()
      await expect(
        root.getByText("You appear to be outside the pub", { exact: true })
      ).toBeVisible()
      await expect(
        root.getByRole("button", { name: "Try Again", exact: true })
      ).toBeEnabled()
      await expect(root.locator("[data-venue-code-form]")).toBeVisible()
      await expect(
        root.getByRole("button", { name: "Add without location" })
      ).toHaveCount(0)
    })

    test("switching to the venue code abandons a pending GPS fix", async ({
      page,
    }) => {
      await captureSequence(page, ["pending"])
      const root = await open(page)
      await root.getByRole("button", { name: "Use my location" }).click()
      await root.getByRole("button", { name: "Enter venue code" }).click()
      await root.getByLabel("Today's code from a team member").fill("482913")
      await root
        .getByRole("button", { name: "Add my stamp", exact: true })
        .click()
      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      await page.waitForTimeout(900) // let the deliberately late callback arrive
      await expect(page.locator("[data-submit-count]")).toHaveText("1")
      await expect(page.locator("[data-last-location-status]")).toHaveText("")
    })

    test("rapid taps start one capture and one submission", async ({
      page,
    }) => {
      await captureSequence(page, ["pending"])
      const root = await open(page)
      await root.getByRole("button", { name: "Use my location" }).dblclick()
      await expect(root).toHaveAttribute("data-stamp-phase", "confirmed")
      await expect(page.locator("[data-submit-count]")).toHaveText("1")
      expect(
        await page.evaluate(() => Reflect.get(window, "locationTestCalls"))
      ).toBe(1)
    })

    test("blocked help is selectable, accessible and fits a small iPhone @a11y", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 568 })
      await captureSequence(page, ["denied"])
      const root = await open(page, "verify-grace-left")
      await root.getByRole("button", { name: "Use my location" }).click()
      await root.getByText("Need help?", { exact: true }).click()
      await root.getByLabel("Your browser").selectOption("ios-safari")
      await expect(
        root.locator("[data-location-permission-help]")
      ).toContainText("Website Settings → Location → Allow")
      await root.getByText("Need help?", { exact: true }).click()
      await root.getByRole("button", { name: "Try Again", exact: true }).click()
      await expect(
        root.getByText("Location access is blocked", { exact: true })
      ).toBeVisible()
      await page.screenshot({
        path: test.info().outputPath("blocked-safari-mobile.png"),
      })
      await root.getByText("Need help?", { exact: true }).click()
      await root.getByLabel("Your browser").selectOption("ios-chrome")
      await expect(
        root.locator("[data-location-permission-help]")
      ).toContainText("Location Services → Chrome → While Using the App")
      await expect(
        root.locator("[data-location-permission-help]")
      ).toContainText("Reload or reopen")
      await expect(
        root.locator("[data-location-permission-help]")
      ).toContainText("deleting Chrome and installing it again")
      await expect(
        root.locator("[data-location-permission-help]")
      ).toContainText("sign in again, reopen or rescan the venue QR code")
      await root.getByText("Need help?", { exact: true }).click()
      await root.getByRole("button", { name: "Try Again", exact: true }).click()
      await expect(
        root.getByText("Location access is blocked", { exact: true })
      ).toBeVisible()
      await page.screenshot({
        path: test.info().outputPath("blocked-chrome-ios-mobile.png"),
      })
      await root.getByText("Need help?", { exact: true }).click()
      await root.getByLabel("Your browser").selectOption("android-chrome")
      await expect(
        root.locator("[data-location-permission-help]")
      ).toContainText("Permissions → Location → Allow")
      await root.getByText("Need help?", { exact: true }).click()
      await page.screenshot({
        path: test.info().outputPath("blocked-chrome-android-mobile.png"),
      })
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth
        )
      ).toBe(true)
      await expectNoAxeViolations(
        page,
        "blocked location recovery on a small iPhone"
      )
      await root.getByRole("button", { name: "Try Again", exact: true }).click()
      await expect(
        root.getByText("Location access is blocked", { exact: true })
      ).toBeVisible()
      await expect(page.locator("[data-submit-count]")).toHaveText("0")
    })
  })
}
