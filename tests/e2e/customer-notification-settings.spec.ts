import { expect, type Page, test } from "@playwright/test"

const fakePublicKey =
  "BEl6k5JHPC3H7E3l5f_3CiY1rqaKaNH8A_rnRE1h8kzZoYv7zZv-vy4HzzCAU_Fjv8bGeu2xbhPAFKW5p8I1gHg"

test.describe("customer browser push settings", () => {
  test("shows unsupported browsers without prompting", async ({ page }) => {
    await mockPreferenceRoutes(page)
    await mockPushBrowser(page, "unsupported")

    await page.goto("/dev/customer-notifications")

    await expect(state(page, "unsupported")).toBeVisible()
    await expect(page.getByRole("button", { name: "Enable push" })).toBeDisabled()
  })

  test("shows denied permission without creating a subscription", async ({
    page,
  }) => {
    await mockPreferenceRoutes(page)
    await mockPushBrowser(page, "denied")

    await page.goto("/dev/customer-notifications")

    await expect(state(page, "denied")).toBeVisible()
    await expect(page.getByRole("button", { name: "Enable push" })).toBeDisabled()
  })

  test("creates a subscription after granted browser permission", async ({
    page,
  }) => {
    const requests = await mockPreferenceRoutes(page)
    await mockPushBrowser(page, "granted")

    await page.goto("/dev/customer-notifications")
    await expect(state(page, "granted")).toBeVisible()
    await page.getByRole("button", { name: "Enable push" }).click()

    await expect(state(page, "subscribed")).toBeVisible()
    expect(requests.subscribe).toBe(1)
  })

  test("shows and disables an existing subscription", async ({ page }) => {
    const requests = await mockPreferenceRoutes(page)
    await mockPushBrowser(page, "subscribed")

    await page.goto("/dev/customer-notifications")
    await expect(state(page, "subscribed")).toBeVisible()
    await page.getByRole("button", { name: "Turn off push" }).click()

    await expect(state(page, "granted")).toBeVisible()
    expect(requests.unsubscribe).toBe(1)
  })
})

function state(page: Page, name: string) {
  return page.locator(`[data-notification-state="${name}"]`)
}

async function mockPreferenceRoutes(page: Page) {
  const requests = { subscribe: 0, unsubscribe: 0 }

  await page.route("**/api/notifications/push/public-key", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ enabled: true, publicKey: fakePublicKey }),
    })
  })

  await page.route("**/api/notifications/push/preferences", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        preferences: {
          transactionalEnabled: true,
          reminderEnabled: true,
          marketingEnabled: false,
          quietHoursStart: "21:00",
          quietHoursEnd: "09:00",
        },
      }),
    })
  })

  await page.route("**/api/notifications/push/subscribe", async (route) => {
    requests.subscribe += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  })

  await page.route("**/api/notifications/push/unsubscribe", async (route) => {
    requests.unsubscribe += 1
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    })
  })

  return requests
}

async function mockPushBrowser(
  page: Page,
  browserState: "unsupported" | "denied" | "granted" | "subscribed"
) {
  await page.addInitScript(
    ({ browserState: injectedState }) => {
      if (injectedState === "unsupported") {
        Object.defineProperty(navigator, "userAgent", {
          configurable: true,
          value:
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
        })
        Reflect.deleteProperty(window, "Notification")
        Reflect.deleteProperty(window, "PushManager")
        Reflect.deleteProperty(navigator, "serviceWorker")
        return
      }

      const subscription = {
        endpoint: "https://push.example.test/subscription",
        expirationTime: null,
        keys: {
          p256dh: "p256dh-key",
          auth: "auth-key",
        },
        toJSON() {
          return {
            endpoint: this.endpoint,
            expirationTime: this.expirationTime,
            keys: this.keys,
          }
        },
        async unsubscribe() {
          return true
        },
      }
      let currentSubscription =
        injectedState === "subscribed" ? subscription : null

      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: {
          permission: injectedState === "denied" ? "denied" : "granted",
          async requestPermission() {
            return injectedState === "denied" ? "denied" : "granted"
          },
        },
      })
      Object.defineProperty(window, "PushManager", {
        configurable: true,
        value: function PushManager() {},
      })
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: {
          async register() {
            return this.ready
          },
          ready: Promise.resolve({
            pushManager: {
              async getSubscription() {
                return currentSubscription
              },
              async subscribe() {
                currentSubscription = subscription
                return subscription
              },
            },
          }),
        },
      })
    },
    { browserState }
  )
}
