import { expect, test } from "@playwright/test"

import { dismissPwaInstall, HARNESS_ROUTES } from "./helpers/harness"

test.describe("Merchant QR image route", () => {
  test("dev QR harness page loads the fixture image in the frame", async ({
    page,
  }) => {
    await dismissPwaInstall(page)

    const response = await page.goto(HARNESS_ROUTES.qr)
    const image = page.getByRole("img", {
      name: "QR code for Mystery Visit Card",
    })

    expect(response?.status()).toBe(200)
    await expect(image).toBeVisible()
    await expect
      .poll(async () => {
        return image.evaluate((node) => {
          if (!(node instanceof HTMLImageElement)) {
            return false
          }

          return node.complete && node.naturalWidth > 100
        })
      })
      .toBe(true)
  })

  test("dev harness QR image renders fixture bytes without auth", async ({
    request,
  }) => {
    const response = await request.get("/app/qr/image/qr_harness")

    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"] ?? "").toContain("image/png")
    expect((await response.body()).byteLength).toBeGreaterThan(100)
  })

  test("unauthenticated internal QR image requests do not render image bytes", async ({
    request,
  }) => {
    const response = await request.get("/app/qr/image/not-owned")

    expect(response.status()).toBe(404)
    expect(response.headers()["content-type"] ?? "").not.toContain("image/png")
    await expect(response.text()).resolves.toContain("QR code not found")
  })
})
