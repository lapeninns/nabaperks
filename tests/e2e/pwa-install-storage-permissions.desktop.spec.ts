import { expect, test } from "@playwright/test"

const START_PATH = "/start"
const INSTALL_DISMISS_KEY = "nabaperks:pwa-install-dismissed:v2"

test.describe("PWA install, storage, and permission behaviour", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Chromium exposes the install, notification, and PushManager surfaces used by this proof."
  )

  test("Given an installable manifest When the prompt is accepted after rotation Then the real install surface completes", async ({
    page,
  }, testInfo) => {
    // Given: the browser receives the production manifest and every declared icon.
    const manifestResponse = await page.request.get("/manifest.webmanifest")
    expect(manifestResponse.status()).toBe(200)
    const manifest: unknown = await manifestResponse.json()
    expect(isInstallableManifest(manifest)).toBe(true)
    if (!isInstallableManifest(manifest)) return

    for (const icon of manifest.icons) {
      const iconResponse = await page.request.get(icon.src)
      expect(iconResponse.status(), `${icon.src} is reachable`).toBe(200)
    }

    await page.goto(START_PATH)
    await page.evaluate(() => {
      const promptEvent = new Event("beforeinstallprompt", {
        cancelable: true,
      })
      Object.defineProperties(promptEvent, {
        platforms: { value: ["web"] },
        prompt: {
          value: async () => {
            document.documentElement.dataset.installPrompted = "true"
          },
        },
        userChoice: {
          value: Promise.resolve({ outcome: "accepted", platform: "web" }),
        },
      })
      window.dispatchEvent(promptEvent)
    })

    const installSurface = page.getByRole("complementary", {
      name: "Install Nabaperks",
    })
    await expect(installSurface).toBeVisible()

    // When: the viewport rotates before the member accepts the real app prompt.
    await page.setViewportSize({ width: 812, height: 375 })
    await expect(installSurface).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true)
    await installSurface.getByRole("button", { name: "Install" }).click()

    // Then: the component called the captured install prompt and closed itself.
    await expect
      .poll(() =>
        page.evaluate(
          () => document.documentElement.dataset.installPrompted ?? null
        )
      )
      .toBe("true")
    await expect(installSurface).toHaveCount(0)
    await testInfo.attach("rotated-install-surface", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    })
  })

  test("Given a stalled navigation When the network resumes Then the start surface settles without stale storage", async ({
    page,
  }, testInfo) => {
    // Given: the main document is held by a controllable network gate.
    let releaseNavigation: () => void = () => {}
    const navigationGate = new Promise<void>((resolve) => {
      releaseNavigation = resolve
    })
    let observeRequest: () => void = () => {}
    const requestObserved = new Promise<void>((resolve) => {
      observeRequest = resolve
    })
    await page.route(`**${START_PATH}`, async (route) => {
      observeRequest()
      await navigationGate
      await route.continue()
    })

    // When: navigation begins under the stalled connection, then resumes.
    const navigation = page.goto(START_PATH)
    await requestObserved
    releaseNavigation()
    const response = await navigation

    // Then: one successful document settles and browser storage is inventoried.
    expect(response?.status()).toBe(200)
    await expect(page.locator("body")).toContainText("Nabaperks")
    const storage = await page.evaluate(async () => ({
      cacheNames: await caches.keys(),
      indexedDbNames: (await indexedDB.databases()).map(
        ({ name }) => name ?? ""
      ),
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
    }))
    expect(storage.local.every(([key]) => key === INSTALL_DISMISS_KEY)).toBe(
      true
    )
    expect(
      storage.session.every(([key]) => key.startsWith("__next_debug_channel:"))
    ).toBe(true)
    const applicationStorage = {
      local: storage.local,
      session: storage.session.filter(
        ([key]) => !key.startsWith("__next_debug_channel:")
      ),
    }
    expect(JSON.stringify(applicationStorage)).not.toMatch(
      /(?:\+?44|07\d{3}|@example\.|@test\.)/i
    )
    await testInfo.attach("browser-storage-inventory", {
      body: Buffer.from(JSON.stringify(storage, null, 2)),
      contentType: "application/json",
    })
  })

  test("Given notification permission is granted When the PWA loads Then the browser exposes a ready push surface", async ({
    context,
    page,
  }) => {
    test.skip(
      process.env.PWA_GRANTED_PERMISSION_E2E !== "1",
      "set PWA_GRANTED_PERMISSION_E2E=1 on a Chromium host that can grant notification permission"
    )

    // Given: Chromium grants the real notification permission for this origin.
    const origin = new URL(
      process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3146"
    ).origin
    await context.grantPermissions(["notifications"])

    // When: the production PWA shell loads and registers its service worker.
    await page.goto(START_PATH)
    const pushState = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return {
        hasPushManager: "PushManager" in window,
        hasRegistrationPushManager: Boolean(registration.pushManager),
        permission: Notification.permission,
        scope: registration.scope,
      }
    })

    // Then: granted permission is reflected on the actual browser push surface.
    expect(pushState.permission).toBe("granted")
    expect(pushState.hasPushManager).toBe(true)
    expect(pushState.hasRegistrationPushManager).toBe(true)
    expect(pushState.scope).toBe(`${origin}/`)
  })
})

type InstallableManifest = Readonly<{
  display: string
  icons: readonly Readonly<{ src: string; sizes: string }>[]
  name: string
  scope: string
  start_url: string
}>

function isInstallableManifest(value: unknown): value is InstallableManifest {
  if (value === null || typeof value !== "object") return false
  if (!("icons" in value) || !Array.isArray(value.icons)) return false

  return (
    "display" in value &&
    value.display === "standalone" &&
    "name" in value &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    "scope" in value &&
    value.scope === "/" &&
    "start_url" in value &&
    value.start_url === START_PATH &&
    value.icons.length >= 2 &&
    value.icons.every(
      (icon) =>
        icon !== null &&
        typeof icon === "object" &&
        "src" in icon &&
        typeof icon.src === "string" &&
        "sizes" in icon &&
        typeof icon.sizes === "string"
    )
  )
}
