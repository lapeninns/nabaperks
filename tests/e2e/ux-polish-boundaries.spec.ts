import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

/**
 * UX production-polish boundary specs (@polish) — DB-free tier.
 *
 * Covers the Phase C customer rows:
 * - CUS-P1-01: the `/q` entry degrades to branded recovery (pinned existing
 *   behaviour) and, when the segment itself throws, the NEW `error.tsx`
 *   boundary renders `CustomerErrorState` with a working `reset()` retry
 *   instead of the framework default error page. The throw is forced via the
 *   dev-only `dev-boundary-probe` QR id (NODE_ENV-gated in
 *   app/q/[qrId]/page.tsx), so no database is needed.
 * - VCU-P1-01: the `/scan` camera-unavailable state keeps exactly ONE primary
 *   action (retry); the standing exit links demote so the stuck moment has a
 *   clear next step.
 *
 * Runs on the mobile-safari project only (not a `.desktop.spec.ts`); needs no
 * Supabase, no auth, no camera hardware.
 */

/**
 * Same camera-denial recipe as customer-scanner-camera.desktop.spec.ts: stub
 * mediaDevices so html5-qrcode fails with NotAllowedError and the scanner
 * lands in its camera-error state deterministically.
 */
async function denyCamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: async () => [
          {
            deviceId: "test-camera",
            groupId: "test-group",
            kind: "videoinput",
            label: "Test camera",
            toJSON() {
              return this
            },
          },
        ],
        getUserMedia: async () => {
          throw new DOMException("Camera blocked", "NotAllowedError")
        },
      },
    })
  })
}

test.describe("customer entry error boundaries", { tag: "@polish" }, () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("unknown QR ids keep the branded unavailable recovery", async ({
    page,
  }) => {
    const response = await page.goto("/q/polish-not-a-real-qr")

    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole("heading", { name: "This loyalty card is unavailable" })
    ).toBeVisible()
    await expect(page.getByRole("link", { name: "Scan a QR" })).toHaveAttribute(
      "href",
      "/scan"
    )
    await expect(
      page.getByRole("link", { name: "Open my cards" })
    ).toHaveAttribute("href", "/home")
  })

  test("a thrown entry segment renders the branded boundary with a working retry", async ({
    page,
  }) => {
    await page.goto("/q/dev-boundary-probe")

    // app/q/[qrId]/error.tsx → CustomerErrorState: branded, calm, recoverable.
    await expect(
      page.getByText("QR unavailable", { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText(
        "This QR could not be opened safely. Try again, or ask a team member for the current loyalty QR."
      )
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Open my cards" })
    ).toHaveAttribute("href", "/home")

    const retry = page.getByRole("button", { name: "Try again" })
    await expect(retry).toBeVisible()

    // reset() re-renders the segment; the probe throws again, so the branded
    // boundary must come back rather than the framework default error text.
    await retry.click()
    await expect(
      page.getByText("QR unavailable", { exact: true })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  })
})

test.describe("root not-found boundary", { tag: "@polish" }, () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("unknown public paths render the branded 404 without CSP failures", async ({
    page,
  }) => {
    const cspViolations: string[] = []
    const pageErrors: string[] = []

    page.on("console", (message) => {
      const text = message.text()
      if (
        message.type() === "error" &&
        text.toLowerCase().includes("content security policy")
      ) {
        cspViolations.push(text)
      }
    })
    page.on("pageerror", (error) => pageErrors.push(error.message))

    const response = await page.goto("/not-a-real-page")

    expect(response?.status()).toBe(404)
    await expect(
      page.getByRole("heading", { name: "Page not found" })
    ).toBeVisible()
    await expect(
      page.getByRole("link", { name: "Start your launch" })
    ).toHaveAttribute("href", "/signup")
    await expect(
      page.getByRole("link", { name: "Open my cards" })
    ).toHaveAttribute("href", "/home")
    expect(cspViolations).toEqual([])
    expect(pageErrors).toEqual([])
  })
})

test.describe("scan camera-unavailable hierarchy", { tag: "@polish" }, () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("camera-error state keeps exactly one primary action", async ({
    page,
  }) => {
    await denyCamera(page)

    const response = await page.goto("/scan")

    expect(response?.status()).toBe(200)
    await expect(page.getByText("Camera unavailable")).toBeVisible()

    const retry = page.getByRole("button", { name: "Try the camera again" })
    await expect(retry).toBeVisible()

    // Wet Ink primary = Button default variant, which renders WITHOUT a
    // data-variant attribute (components/ui/button.tsx). Exactly one primary
    // may exist in the stuck state, and it must be the retry.
    const primaries = page.locator(
      'main [data-slot="button"]:not([data-variant])'
    )
    await expect(primaries).toHaveCount(1)
    await expect(primaries.first()).toHaveText("Try the camera again")

    // The standing exits demote: cards → secondary, start → ghost.
    await expect(
      page.getByRole("link", { name: "Open my cards" })
    ).toHaveAttribute("data-variant", "secondary")
    await expect(
      page.getByRole("link", { name: "Back to start" })
    ).toHaveAttribute("data-variant", "ghost")
  })
})
