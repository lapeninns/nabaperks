import { expect, type APIRequestContext, type Page } from "@playwright/test"

import { HARNESS_ROUTES } from "./harness"

type HarnessSurfaceCheck = {
  readonly name: string
  readonly path: string
  readonly visibleText: string | RegExp
  readonly loadedImageName?: string
  readonly absentText?: readonly RegExp[]
}

const SURFACE_CHECKS = [
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
    visibleText: /Starting camera|Scan reward QR|Scan a reward QR/i,
  },
] as const satisfies readonly HarnessSurfaceCheck[]

export async function warmArchitectureHarnessRoutes(
  request: APIRequestContext
): Promise<void> {
  const paths = new Set(SURFACE_CHECKS.map((surface) => surface.path))

  for (const path of paths) {
    const response = await request.get(path, { failOnStatusCode: false })

    if (!response.ok()) {
      const body = (await response.text()).slice(0, 500)
      throw new Error(
        `Architecture harness warm-up failed for ${path}: HTTP ${response.status()}\n${body}`
      )
    }
  }
}

export async function expectArchitectureHarnessSurfaces(
  page: Page
): Promise<void> {
  for (const surface of SURFACE_CHECKS) {
    const surfacePage = await page.context().newPage()

    try {
      await testHarnessSurface(surfacePage, surface)
    } finally {
      await surfacePage.close()
    }
  }
}

async function testHarnessSurface(
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
      .poll(async () => {
        return image.evaluate((node) => {
          if (!(node instanceof HTMLImageElement)) {
            return false
          }

          return node.complete && node.naturalWidth > 100
        })
      })
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
