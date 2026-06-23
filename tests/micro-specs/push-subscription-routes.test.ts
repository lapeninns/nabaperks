import { existsSync, readFileSync } from "node:fs"

import { afterEach, describe, expect, it } from "vitest"

import {
  getWebPushPublicKey,
  normalizePermissionState,
  validatePushSubscriptionInput,
} from "@/lib/notifications/push-subscriptions"

const routePaths = [
  "app/api/notifications/push/public-key/route.ts",
  "app/api/notifications/push/subscribe/route.ts",
  "app/api/notifications/push/unsubscribe/route.ts",
  "app/api/notifications/push/disable/route.ts",
  "app/api/notifications/push/refresh/route.ts",
  "app/api/notifications/push/preferences/route.ts",
  "app/api/notifications/push/prompt-viewed/route.ts",
]

describe("browser push subscription routes", () => {
  afterEach(() => {
    delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY
  })

  it("adds server-only optional VAPID env keys and public-key lookup", () => {
    const contract = readFileSync("config/env-contract.json", "utf8")
    const envExample = readFileSync(".env.example", "utf8")
    const docs = readFileSync("docs/ENV_KEYS.md", "utf8")

    for (const key of [
      "WEB_PUSH_VAPID_PUBLIC_KEY",
      "WEB_PUSH_VAPID_PRIVATE_KEY",
      "WEB_PUSH_VAPID_SUBJECT",
    ]) {
      expect(contract).toContain(`"name": "${key}"`)
      expect(contract).toContain('"visibility": "server"')
      expect(contract).toContain('"optional": true')
      expect(envExample).toContain(key)
      expect(docs).toContain(key)
    }

    expect(getWebPushPublicKey()).toBe(null)
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = "  BOgUsPublicKey  "
    expect(getWebPushPublicKey()).toBe("BOgUsPublicKey")
  })

  it("validates subscription payloads without accepting malformed endpoint or keys", () => {
    expect(normalizePermissionState("granted")).toBe("granted")
    expect(normalizePermissionState("surprise")).toBe("unknown")

    expect(
      validatePushSubscriptionInput({
        endpoint: "https://push.example.test/customer/browser-subscription",
        keys: {
          p256dh: "browser-push-test-p256dh-key-customer-a",
          auth: "browser-push-test-auth-key-a",
        },
      })
    ).toMatchObject({
      ok: true,
      subscription: {
        endpoint: "https://push.example.test/customer/browser-subscription",
      },
    })

    expect(validatePushSubscriptionInput({ endpoint: "ftp://bad" })).toEqual({
      ok: false,
      error: "invalid_subscription",
    })
    expect(
      validatePushSubscriptionInput({
        endpoint: "https://push.example.test/customer/browser-subscription",
        keys: { p256dh: "short", auth: "short" },
      })
    ).toEqual({ ok: false, error: "invalid_subscription" })
  })

  it("implements authenticated Node route handlers with rate limits and service-role scoped RPCs", () => {
    for (const path of routePaths) {
      expect(existsSync(path), path).toBe(true)
      const source = readFileSync(path, "utf8")
      expect(source).toContain('runtime = "nodejs"')
      expect(source).toContain('dynamic = "force-dynamic"')
    }

    const subscribeRoute = readFileSync(
      "app/api/notifications/push/subscribe/route.ts",
      "utf8"
    )
    expect(subscribeRoute).toContain("getCurrentCustomer")
    expect(subscribeRoute).toContain("enforceRateLimit")
    expect(subscribeRoute).toContain("registerCustomerPushSubscription")
    expect(subscribeRoute).not.toContain("WEB_PUSH_VAPID_PRIVATE_KEY")

    const unsubscribeRoute = readFileSync(
      "app/api/notifications/push/unsubscribe/route.ts",
      "utf8"
    )
    expect(unsubscribeRoute).toContain("disableCustomerPushSubscription")

    const refreshRoute = readFileSync(
      "app/api/notifications/push/refresh/route.ts",
      "utf8"
    )
    expect(refreshRoute).toContain("registerCustomerPushSubscription")
    expect(refreshRoute).toContain("disableCustomerPushSubscription")

    const subscriptionHelpers = readFileSync(
      "lib/notifications/push-subscriptions.ts",
      "utf8"
    )
    expect(subscriptionHelpers).toContain("push_permission_granted")
    expect(subscriptionHelpers.indexOf("push_permission_granted")).toBeLessThan(
      subscriptionHelpers.indexOf("push_subscription_created")
    )

    const preferencesRoute = readFileSync(
      "app/api/notifications/push/preferences/route.ts",
      "utf8"
    )
    expect(preferencesRoute).toContain("getCustomerNotificationPreferences")
    expect(preferencesRoute).toContain("updateCustomerNotificationPreferences")

    const promptRoute = readFileSync(
      "app/api/notifications/push/prompt-viewed/route.ts",
      "utf8"
    )
    expect(promptRoute).toContain("recordPushPermissionPromptViewed")
  })
})
