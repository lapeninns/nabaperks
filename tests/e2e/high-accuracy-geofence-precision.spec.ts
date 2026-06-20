import { expect, test } from "@playwright/test"

/**
 * Agent browser proof for the merchant venue pin map. Drives the dev preview
 * harness (no Supabase session) and asserts that dragging the Leaflet marker
 * flips the hidden coordinate source to `merchant_pin` and rewrites the hidden
 * latitude/longitude, while the geofence-off scenario renders the form without
 * initialising a map.
 */
test.describe("high-accuracy geofence precision — venue pin map", () => {
  test("drags the venue pin and records a merchant_pin override", async ({
    page,
  }) => {
    await page.goto("/dev/launch-preview?tab=venue&scenario=geofence-on")

    const map = page.locator('[data-testid="venue-pin-map"]')
    await expect(map).toBeVisible()
    // The map sits below the fold in a long form; bring it into the viewport so
    // pointer coordinates land on it.
    await map.scrollIntoViewIfNeeded()

    const box = await map.boundingBox()
    expect(box).not.toBeNull()
    expect(box?.width ?? 0).toBeGreaterThan(0)
    expect(box?.height ?? 0).toBeGreaterThan(0)

    // Leaflet controls + a marker prove the map initialised client-side.
    await expect(page.locator(".leaflet-control-zoom")).toBeVisible()
    const marker = page.locator(".leaflet-marker-icon").first()
    await expect(marker).toBeVisible()

    const sourceField = page.locator('input[name="geofencePinSource"]')
    const latField = page.locator('input[name="venueLatitude"]')
    const lngField = page.locator('input[name="venueLongitude"]')

    await expect(sourceField).toHaveValue("geocoded")
    const initialLat = await latField.inputValue()
    const initialLng = await lngField.inputValue()
    expect(initialLat).not.toBe("")
    expect(initialLng).not.toBe("")

    // Leaflet drag needs a real mousedown on the marker plus intermediate moves.
    await marker.scrollIntoViewIfNeeded()
    const markerBox = await marker.boundingBox()
    expect(markerBox).not.toBeNull()
    const startX = (markerBox?.x ?? 0) + (markerBox?.width ?? 0) / 2
    const startY = (markerBox?.y ?? 0) + (markerBox?.height ?? 0) / 2

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 25, startY + 18, { steps: 8 })
    await page.mouse.move(startX + 50, startY + 35, { steps: 12 })
    await page.mouse.up()

    // The dragged pin is recorded as a manual override with fresh coordinates.
    await expect(sourceField).toHaveValue("merchant_pin")
    await expect(latField).not.toHaveValue(initialLat)
    await expect(lngField).not.toHaveValue(initialLng)
  })

  test("renders the venue form without a map when geofence checks are off", async ({
    page,
  }) => {
    await page.goto("/dev/launch-preview?tab=venue&scenario=geofence-off")

    await expect(
      page.locator('[data-launch-preview-scenario="geofence-off"]')
    ).toBeVisible()
    // The form still renders so the merchant can configure the venue...
    await expect(page.locator('input[name="venueName"]')).toBeVisible()
    // ...but no map is initialised while GPS checks are disabled.
    await expect(page.locator('[data-testid="venue-pin-map"]')).toHaveCount(0)
  })
})
