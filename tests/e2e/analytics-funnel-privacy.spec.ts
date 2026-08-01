import {
  type BrowserContext,
  expect,
  test,
  type Page,
  type Request as PlaywrightRequest,
} from "@playwright/test"

const FUNNEL_ENDPOINT = "/api/analytics/funnel"
const FUNNEL_TOKEN = "test-signed-merchant-funnel-token"
const ANALYTICS_MARKER = /analytics|funnel|posthog|^ph_/i

type FunnelRequest = {
  body: Record<string, unknown>
  method: string
  url: string
}

test.describe("privacy-safe merchant funnel", () => {
  test.use({ serviceWorkers: "block" })

  test("signup continuity stays same-origin and session-only", async ({
    context,
    page,
  }) => {
    const funnelRequests: FunnelRequest[] = []
    const externalAnalyticsRequests: string[] = []

    page.on("request", (request) => {
      const url = new URL(request.url())
      if (
        url.pathname !== FUNNEL_ENDPOINT &&
        (url.hostname.includes("posthog") || url.pathname === "/i/v0/e/")
      ) {
        externalAnalyticsRequests.push(request.url())
      }
    })

    await page.route(`**${FUNNEL_ENDPOINT}`, async (route) => {
      funnelRequests.push(toFunnelRequest(route.request()))
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({ token: FUNNEL_TOKEN }),
      })
    })

    // This suite runs against `next dev`. Compile the destination before the
    // WebKit click so an on-demand Fast Refresh reload cannot replace the
    // in-flight client navigation. The click and URL assertions below still
    // prove the real acquisition journey.
    const signupWarmup = await page.request.get("/signup")
    expect(signupWarmup.status()).toBeLessThan(400)

    const response = await page.goto("/")
    expect(response?.status()).toBeLessThan(400)

    await expect
      .poll(() => eventsFrom(funnelRequests), {
        message: "landing hydration records the marketing-view milestone",
      })
      .toContain("merchant_marketing_viewed")

    await page.getByRole("link", { name: "Start your launch" }).first().click()
    await expect(page).toHaveURL(/\/signup$/)
    await expect
      .poll(() => eventsFrom(funnelRequests))
      .toContain("merchant_signup_clicked")

    const signupStorage = await analyticsStorage(page)
    expect(signupStorage.session).toEqual([
      expect.objectContaining({ value: FUNNEL_TOKEN }),
    ])
    expect(signupStorage.local).toEqual([])
    expect(await analyticsCookies(context, FUNNEL_TOKEN)).toEqual([])
    await expect(page.getByLabel(/email/i)).toBeVisible()

    const appOrigin = new URL(page.url()).origin
    for (const request of funnelRequests) {
      const url = new URL(request.url)
      expect(url.origin).toBe(appOrigin)
      expect(url.pathname).toBe(FUNNEL_ENDPOINT)
      expect(request.method).toBe("POST")
    }

    const marketingView = funnelRequests.find(
      ({ body }) => body.event === "merchant_marketing_viewed"
    )
    expect(marketingView?.body.token).toBeUndefined()
    expect(await analyticsCookies(context, FUNNEL_TOKEN)).toEqual([])
    expect(externalAnalyticsRequests).toEqual([])
  })

  test("an aborted analytics route never blocks signup rendering", async ({
    context,
    page,
  }) => {
    const abortedRequests: FunnelRequest[] = []

    await page.route(`**${FUNNEL_ENDPOINT}`, async (route) => {
      abortedRequests.push(toFunnelRequest(route.request()))
      await route.abort("failed")
    })

    const response = await page.goto("/")
    expect(response?.status()).toBeLessThan(400)
    await expect
      .poll(() => eventsFrom(abortedRequests), {
        message: "the browser attempts first-party measurement before failure",
      })
      .toContain("merchant_marketing_viewed")
    await page.getByRole("link", { name: "Start your launch" }).first().click()
    await expect(page.getByLabel(/email/i)).toBeVisible()

    const storage = await analyticsStorage(page)
    expect(storage.session).toEqual([])
    expect(storage.local).toEqual([])
    expect(await analyticsCookies(context, FUNNEL_TOKEN)).toEqual([])
  })

  test("blocked session storage and analytics failure do not block signup submission", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const blockedSessionStorage = window.sessionStorage
      const getItem = Storage.prototype.getItem
      const setItem = Storage.prototype.setItem

      Storage.prototype.getItem = function (key: string) {
        if (this === blockedSessionStorage) {
          throw new DOMException("Storage blocked", "SecurityError")
        }
        return getItem.call(this, key)
      }
      Storage.prototype.setItem = function (key: string, value: string) {
        if (this === blockedSessionStorage) {
          throw new DOMException("Storage blocked", "SecurityError")
        }
        return setItem.call(this, key, value)
      }
    })

    const abortedEvents: unknown[] = []
    let signupSubmitted = false
    await page.route(`**${FUNNEL_ENDPOINT}`, async (route) => {
      abortedEvents.push(readJsonBody(route.request()).event)
      await route.abort("failed")
    })
    await page.route("**/signup", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue()
        return
      }
      signupSubmitted = true
      await route.fulfill({
        status: 503,
        contentType: "text/plain",
        body: "deliberate auth endpoint stop after submission proof",
      })
    })

    await page.goto("/")
    await expect
      .poll(() => abortedEvents)
      .toContain("merchant_marketing_viewed")
    await page.getByRole("link", { name: "Start your launch" }).first().click()
    await page.getByLabel("Your name").fill("Privacy Proof")
    await page.getByLabel("Email", { exact: true }).fill("proof@example.test")
    await page.getByLabel("Password", { exact: true }).fill("Privacy123")
    await page.getByLabel("Confirm password").fill("Privacy123")
    await expect(page.locator('input[name="funnelToken"]')).toHaveValue("")
    await page.getByRole("button", { name: "Create account" }).click()

    await expect.poll(() => abortedEvents).toContain("merchant_signup_started")

    await expect
      .poll(() => signupSubmitted, {
        message: "the valid auth form still reaches its own POST endpoint",
      })
      .toBe(true)
  })
})

function toFunnelRequest(request: PlaywrightRequest): FunnelRequest {
  return {
    body: readJsonBody(request),
    method: request.method(),
    url: request.url(),
  }
}

function readJsonBody(request: PlaywrightRequest): Record<string, unknown> {
  try {
    const body: unknown = request.postDataJSON()
    return body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

function eventsFrom(requests: FunnelRequest[]): unknown[] {
  return requests.map(({ body }) => body.event)
}

async function analyticsStorage(page: Page) {
  return page.evaluate(
    ({ markerSource, token }) => {
      const marker = new RegExp(markerSource, "i")
      const selectAnalyticsEntries = (storage: Storage) =>
        Object.entries(storage)
          .filter(
            ([key, value]) =>
              marker.test(key) || marker.test(value) || value === token
          )
          .map(([key, value]) => ({ key, value }))

      return {
        session: selectAnalyticsEntries(window.sessionStorage),
        local: selectAnalyticsEntries(window.localStorage),
      }
    },
    { markerSource: ANALYTICS_MARKER.source, token: FUNNEL_TOKEN }
  )
}

async function analyticsCookies(
  context: BrowserContext,
  token: string
): Promise<Array<{ name: string; value: string }>> {
  const cookies = await context.cookies()
  return cookies
    .filter(
      ({ name, value }) =>
        ANALYTICS_MARKER.test(name) ||
        ANALYTICS_MARKER.test(value) ||
        value === token
    )
    .map(({ name, value }) => ({ name, value }))
}
