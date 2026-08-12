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

async function mockHungCamera(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: async () => [],
        getUserMedia: async () => new Promise<MediaStream>(() => {}),
      },
    })
  })
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

  test("opens the existing reward review route when a blocked-camera merchant enters a customer code", async ({
    page,
  }) => {
    await mockCameraFailure(page, "NotAllowedError")

    const response = await page.goto(HARNESS_ROUTES.scan)

    expect(response?.status()).toBe(200)
    const customerCode = page.getByLabel("Customer code")
    await expect(customerCode).toBeVisible()
    await customerCode.fill(
      "http://127.0.0.1:3146/r/00000000-0000-4000-8000-000000000000"
    )
    await customerCode.press("Enter")

    await expect(page).toHaveURL(
      "/app/rewards/scan/00000000-0000-4000-8000-000000000000"
    )
  })

  test("keeps the customer-code alternative available while camera permission is hung", async ({
    page,
  }) => {
    await mockHungCamera(page)

    const response = await page.goto(HARNESS_ROUTES.scan)

    expect(response?.status()).toBe(200)
    const customerCode = page.getByLabel("Customer code")
    const openCustomerCode = page.getByRole("button", {
      name: "Open customer code",
    })
    await expect(customerCode).toBeVisible()
    await customerCode.fill(
      "http://127.0.0.1:3146/p/00000000-0000-4000-8000-000000000000"
    )
    await openCustomerCode.click()

    await expect(page).toHaveURL(
      "/app/offers/scan/00000000-0000-4000-8000-000000000000"
    )
  })

  test("keeps a malformed customer code on the denied-camera surface", async ({
    page,
  }) => {
    await mockCameraFailure(page, "NotAllowedError")
    await page.goto(HARNESS_ROUTES.scan)

    const customerCode = page.getByLabel("Customer code")
    await customerCode.fill("https://example.invalid/not-a-customer-code")
    await customerCode.press("Enter")

    await expect(page).toHaveURL(HARNESS_ROUTES.scan)
    await expect(customerCode).toHaveAttribute("aria-invalid", "true")
    await expect(
      page.getByText("Enter a customer reward or discount pass link.")
    ).toBeVisible()
  })

  test("preserves a typed customer code across repeated denied-camera retries", async ({
    page,
  }) => {
    await mockCameraFailure(page, "NotAllowedError")
    await page.goto(HARNESS_ROUTES.scan)

    const customerCode = page.getByLabel("Customer code")
    const code = "http://127.0.0.1:3146/r/00000000-0000-4000-8000-000000000000"
    await customerCode.fill(code)

    const retry = page.getByRole("button", { name: "Try again" })
    await retry.click()
    await expect(page.getByText("Camera access blocked")).toBeVisible()
    await expect(customerCode).toHaveValue(code)

    await retry.click()
    await expect(page.getByText("Camera access blocked")).toBeVisible()
    await expect(customerCode).toHaveValue(code)
    await page.getByRole("button", { name: "Open customer code" }).click()

    await expect(page).toHaveURL(
      "/app/rewards/scan/00000000-0000-4000-8000-000000000000"
    )
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
