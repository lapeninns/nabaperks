import { expect, test } from "@playwright/test"

import { dismissPwaInstall, gotoHydratedPage } from "./helpers/harness"

test("the optional venue map preserves GPS controls and updates the native form after a pin drag", async ({
  page,
}, testInfo) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  // Exercise the published Leaflet map and its geometry without contacting a
  // tile provider. Tile pixels do not participate in marker coordinates.
  await page.route("https://*.tile.openstreetmap.org/**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jG3cAAAAASUVORK5CYII=",
        "base64"
      ),
    })
  )
  await page.route("https://maps.googleapis.com/**", (route) => route.abort())
  await dismissPwaInstall(page)
  await gotoHydratedPage(page, "/dev/app-harness/launch?tab=venue")
  await page.getByText("Advanced GPS checks", { exact: true }).click()
  const latitude = page.locator('input[name="venueLatitude"]')
  const longitude = page.locator('input[name="venueLongitude"]')
  const originalLatitude = await latitude.inputValue()
  const originalLongitude = await longitude.inputValue()
  const radius = page.getByLabel("Radius metres")
  const visits = page.getByLabel("Verify from visit number")
  const gps = page.getByRole("checkbox", { name: "Use GPS anomaly checks" })
  await expect(radius).toHaveValue("150")
  await expect(gps).not.toBeChecked()
  await radius.fill("200")
  await visits.fill("7")
  await expect(page.getByTestId("venue-pin-map")).toHaveCount(0)
  await expect(
    page.getByRole("button", { name: "Show venue map" })
  ).toHaveCount(0)
  await gps.check()
  await page.getByRole("button", { name: "Show venue map" }).click()
  const map = page.getByTestId("venue-pin-map")
  await expect(map).toBeVisible()
  const marker = map.locator(".venue-pin-marker")
  await expect(marker).toBeVisible()
  await expect(latitude).toHaveValue(originalLatitude)
  await expect(longitude).toHaveValue(originalLongitude)
  await marker.scrollIntoViewIfNeeded()
  const box = await marker.boundingBox()
  if (!box) throw new Error("Native Leaflet marker has no visible geometry")
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    box.x + box.width / 2 + 30,
    box.y + box.height / 2 - 20,
    {
      steps: 12,
    }
  )
  await page.mouse.up()
  await expect(longitude).not.toHaveValue(originalLongitude)
  await expect(latitude).not.toHaveValue(originalLatitude)
  await expect(page.locator('input[name="geofencePinSource"]')).toHaveValue(
    "merchant_pin"
  )
  await expect(radius).toHaveValue("200")
  await expect(visits).toHaveValue("7")
  await expect(gps).toBeChecked()
  expect(errors).toEqual([])
  await testInfo.attach("native-map-entry-and-drag", {
    body: JSON.stringify({
      mode: "REAL_COMPONENT_NATIVE_LEAFLET_DB_FREE_HARNESS_LOCAL_TILE_PIXELS",
      before: { latitude: originalLatitude, longitude: originalLongitude },
      after: {
        latitude: await latitude.inputValue(),
        longitude: await longitude.inputValue(),
      },
      radius: await radius.inputValue(),
      visits: await visits.inputValue(),
      browserErrors: errors,
    }),
    contentType: "application/json",
  })
})
