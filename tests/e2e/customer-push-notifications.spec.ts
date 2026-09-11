import { expect, test, type Page } from "@playwright/test"

import { dismissPwaInstall } from "./helpers/harness"

const HARNESS = "/dev/home-harness/push"
const SUBSCRIBE = "/api/notifications/push/subscribe"

async function installFakePushStack(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const subscription = {
      endpoint: "https://fcm.googleapis.com/fcm/send/nabaperks-e2e",
      expirationTime: null,
      options: { userVisibleOnly: true },
      getKey() {
        return new ArrayBuffer(8)
      },
      toJSON() {
        return {
          endpoint: "https://fcm.googleapis.com/fcm/send/nabaperks-e2e",
          keys: { p256dh: "p256dh-fixture-value-20+", auth: "auth-key" },
        }
      },
      unsubscribe: async () => true,
    }

    const registration = {
      pushManager: {
        getSubscription: async () => null,
        subscribe: async () => subscription as unknown as PushSubscription,
      },
    }

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve(registration),
        register: async () => registration,
        addEventListener() {},
        removeEventListener() {},
      },
    })

    class FakePushManager {}
    Object.defineProperty(window, "PushManager", {
      configurable: true,
      value: FakePushManager,
    })

    const NotificationCtor = window.Notification as
      typeof Notification | undefined
    if (NotificationCtor) {
      try {
        Object.defineProperty(NotificationCtor, "permission", {
          configurable: true,
          get: () => "granted",
        })
        NotificationCtor.requestPermission = async () => "granted"
      } catch {
        // Some engines freeze Notification.permission; Enable then stays a
        // documented unsupported/blocked/install branch instead of skipping.
      }
    }
  })
}

test.describe("customer push notifications", () => {
  test.beforeEach(async ({ page }) => {
    await dismissPwaInstall(page)
  })

  test("subscribe fails closed without a customer session", async ({
    request,
  }) => {
    const response = await request.post(SUBSCRIBE, {
      data: {
        subscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/nabaperks-e2e",
          keys: { p256dh: "p256dh-fixture-value-20+", auth: "auth-key" },
        },
        permissionState: "granted",
      },
      maxRedirects: 0,
    })

    expect(response.status()).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: "unauthenticated" })
  })

  test("public-key readback reports whether push is configured", async ({
    request,
  }) => {
    const response = await request.get("/api/notifications/push/public-key", {
      maxRedirects: 0,
    })

    expect(response.status()).toBe(200)
    const body = (await response.json()) as {
      enabled?: boolean
      publicKey?: string | null
    }
    expect(typeof body.enabled).toBe("boolean")
    if (body.enabled) {
      expect(typeof body.publicKey).toBe("string")
    } else {
      expect(body.publicKey == null || body.publicKey === "").toBe(true)
    }
  })

  test("harness Enable push posts a subscription when the browser can fake one", async ({
    context,
    page,
  }) => {
    await context.grantPermissions(["notifications"]).catch(() => undefined)
    await installFakePushStack(page)

    let subscribePosts = 0
    await page.route("**/api/notifications/push/public-key", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          enabled: true,
          publicKey: "B".repeat(87),
        }),
      })
    })
    await page.route(
      "**/api/notifications/push/prompt-viewed",
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "{}",
        })
      }
    )
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
            activeSubscriptionCount: 0,
          },
        }),
      })
    })
    await page.route("**/api/notifications/push/subscribe", async (route) => {
      // Inspect the request before fulfilling it: a regression to the wrong
      // method or an empty/malformed body would otherwise still reach the
      // success message and pass.
      const request = route.request()
      expect(request.method()).toBe("POST")
      const payload = request.postDataJSON() as {
        subscription?: {
          endpoint?: unknown
          keys?: { p256dh?: string; auth?: string }
        }
        permissionState?: unknown
      } | null
      expect(payload, "subscribe must carry a JSON body").toBeTruthy()
      expect(typeof payload?.subscription?.endpoint).toBe("string")
      expect(payload?.subscription?.endpoint).toBeTruthy()
      // Production also requires both keys; without these a regression that
      // drops them still shows "Push is on" while the real endpoint 400s.
      expect(typeof payload?.subscription?.keys?.p256dh).toBe("string")
      expect(payload?.subscription?.keys?.p256dh?.length ?? 0).toBeGreaterThan(19)
      expect(typeof payload?.subscription?.keys?.auth).toBe("string")
      expect(payload?.subscription?.keys?.auth?.length ?? 0).toBeGreaterThan(7)
      expect(typeof payload?.permissionState).toBe("string")
      subscribePosts += 1
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, subscriptionId: "e2e-sub" }),
      })
    })

    await page.goto(HARNESS)
    await expect(
      page.getByRole("heading", { name: "Push harness" })
    ).toBeVisible()

    const panel = page.locator("[data-notification-state]")
    await expect(panel).toBeVisible()
    await expect(panel).not.toHaveAttribute(
      "data-notification-state",
      "checking",
      { timeout: 15_000 }
    )

    const enable = page.getByRole("button", { name: "Enable push" })
    if (!(await enable.isEnabled())) {
      // "Push needs attention" means initialisation threw despite the installed
      // serviceWorker and PushManager fakes. That is a regression in the happy
      // path, not an unsupported environment, so it must fail rather than be
      // accepted as a valid skip.
      await expect(page.getByText("Push needs attention")).toHaveCount(0)
      await expect(
        page.getByText(/Push is not available|Install needed|Push is blocked/)
      ).toBeVisible()
      expect(subscribePosts).toBe(0)
      return
    }

    await enable.click()
    await expect(page.getByText("Push is on for this browser.")).toBeVisible()
    expect(subscribePosts).toBeGreaterThan(0)
  })
})
