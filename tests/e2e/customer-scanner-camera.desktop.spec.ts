import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

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

test.describe("customer QR scanner camera states", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("shows camera retry copy when browser permission is denied", async ({
    page,
  }) => {
    await denyCamera(page)

    const response = await page.goto("/scan")

    expect(response?.status()).toBe(200)
    await expect(
      page.getByRole("heading", { level: 1, name: "Scan venue QR" })
    ).toBeVisible()
    await expect(page.getByText("Camera unavailable")).toBeVisible()
    await expect(
      page.getByText(
        "We could not open your camera. Allow camera access, then try again."
      )
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Try the camera again" })
    ).toBeVisible()
  })
})
