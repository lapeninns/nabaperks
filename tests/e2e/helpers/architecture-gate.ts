import { expect, type Page } from "@playwright/test"

import { HARNESS_ROUTES } from "./harness"

type HarnessSurfaceCheck = {
  readonly name: string
  readonly path: string
  readonly visibleText: string | RegExp
  readonly loadedImageName?: string
  readonly absentText?: readonly RegExp[]
}

export const ARCHITECTURE_HARNESS_SURFACES = [
  {
    name: "launch setup",
    path: HARNESS_ROUTES.launch,
    visibleText: /setup checks/i,
  },
  {
    name: "members readback",
    path: HARNESS_ROUTES.customers,
    visibleText: "Phone ending 421",
    absentText: [/\+?\d{7,}/],
  },
  {
    name: "activity readback",
    path: HARNESS_ROUTES.activity,
    visibleText: "Phone ending 421 collected stamp 3",
  },
  {
    name: "account profile",
    path: HARNESS_ROUTES.account,
    visibleText: "What customers see",
  },
  {
    name: "account billing",
    path: `${HARNESS_ROUTES.account}?tab=billing`,
    visibleText: "Your venue access and payment status",
  },
  {
    name: "venue QR",
    path: HARNESS_ROUTES.qr,
    visibleText: "Your permanent scan code",
    loadedImageName: "QR code for Mystery Visit Card",
  },
  {
    name: "merchant scanner",
    path: HARNESS_ROUTES.scan,
    visibleText: /Starting camera|Scan customer code|Scan a customer code/i,
  },
] as const satisfies readonly HarnessSurfaceCheck[]

export async function expectArchitectureHarnessSurface(
  page: Page,
  surface: HarnessSurfaceCheck
): Promise<void> {
  const response = await page.goto(surface.path, {
    waitUntil: "domcontentloaded",
  })

  expect(response?.status(), `${surface.name} returned HTTP 200`).toBe(200)
  await expect(page.locator("body")).toContainText(surface.visibleText)

  for (const pattern of surface.absentText ?? []) {
    await expect(page.locator("body")).not.toContainText(pattern)
  }

  if (surface.loadedImageName) {
    const image = page.getByRole("img", { name: surface.loadedImageName })

    await expect(image).toBeVisible()
    await expect
      .poll(
        async () => {
          return image.evaluate((node) => {
            if (!(node instanceof HTMLImageElement)) {
              return false
            }

            return node.complete && node.naturalWidth > 100
          })
        },
        { message: `${surface.name} image decoded`, timeout: 30_000 }
      )
      .toBe(true)
  }

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth + 1
  })

  expect(
    hasHorizontalOverflow,
    `${surface.name} has no horizontal overflow`
  ).toBe(false)
}
