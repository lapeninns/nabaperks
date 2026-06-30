import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

type MockCameraFailure = "NotAllowedError" | "NotFoundError"

async function mockCameraFailure(
  page: Page,
  errorName: MockCameraFailure
): Promise<void> {
  await page.addInitScript((name: MockCameraFailure) => {
    const error = () => new DOMException("Camera unavailable", name)
    const emptyStream = async () => {
      throw error()
    }

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: async () =>
          name === "NotFoundError"
            ? []
            : [
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
        getUserMedia: emptyStream,
      },
    })
  }, errorName)
}

test.describe("merchant reward scanner camera states", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("shows blocked-camera copy when browser permission is denied", async ({
    page,
  }) => {
    await mockCameraFailure(page, "NotAllowedError")

    const response = await page.goto(HARNESS_ROUTES.scan)

    expect(response?.status()).toBe(200)
    await expect(page.getByText("Camera access blocked")).toBeVisible()
    await expect(
      page.getByText(
        "Allow camera access in your browser, make sure you are on HTTPS or localhost, then try again."
      )
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  })

  test("shows no-camera copy when no video input is available", async ({
    page,
  }) => {
    await mockCameraFailure(page, "NotFoundError")

    const response = await page.goto(HARNESS_ROUTES.scan)

    expect(response?.status()).toBe(200)
    await expect(page.getByText("No camera found")).toBeVisible()
    await expect(
      page.getByText(
        "We could not find a camera on this device. Connect a camera, then try again."
      )
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
  })
})
