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

test.describe(
  "privacy-safe merchant funnel @MS-analytics-funnel-identity-privacy",
  () => {
    test.use({ serviceWorkers: "block" })

    test("homepage signup continuity stays same-origin and session-only", async ({
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

      const response = await page.goto("/")
      expect(response?.status()).toBeLessThan(400)

      await expect
        .poll(() => eventsFrom(funnelRequests), {
          message: "homepage hydration records the marketing-view milestone",
        })
        .toContain("merchant_marketing_viewed")

      const homeStorage = await analyticsStorage(page)
      expect(homeStorage.session).toEqual([
        expect.objectContaining({ value: FUNNEL_TOKEN }),
      ])
      expect(homeStorage.local).toEqual([])
      expect(await analyticsCookies(context, FUNNEL_TOKEN)).toEqual([])

      await page
        .getByRole("link", { name: "Start free pilot", exact: true })
        .first()
        .click()

      await expect(page).toHaveURL(/\/signup(?:\?|$)/)
      await expect(page.getByLabel(/email/i)).toBeVisible()
      await expect
        .poll(() => eventsFrom(funnelRequests), {
          message: "the signup CTA records its distinct click milestone",
        })
        .toContain("merchant_signup_clicked")

      const appOrigin = new URL(page.url()).origin
      for (const request of funnelRequests) {
        const url = new URL(request.url)
        expect(url.origin).toBe(appOrigin)
        expect(url.pathname).toBe(FUNNEL_ENDPOINT)
        expect(request.method).toBe("POST")
      }

      const signupClick = funnelRequests.find(
        ({ body }) => body.event === "merchant_signup_clicked"
      )
      expect(signupClick?.body.token).toBe(FUNNEL_TOKEN)

      const signupStorage = await analyticsStorage(page)
      expect(signupStorage.session).toEqual(homeStorage.session)
      expect(signupStorage.local).toEqual([])
      expect(await analyticsCookies(context, FUNNEL_TOKEN)).toEqual([])
      expect(externalAnalyticsRequests).toEqual([])
    })

    test("an aborted analytics route never blocks signup navigation", async ({
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

      await page
        .getByRole("link", { name: "Start free pilot", exact: true })
        .first()
        .click()

      await expect(page).toHaveURL(/\/signup(?:\?|$)/)
      await expect(page.getByLabel(/email/i)).toBeVisible()
      await expect
        .poll(() => eventsFrom(abortedRequests), {
          message: "the failed click capture remains best effort",
        })
        .toContain("merchant_signup_clicked")

      const storage = await analyticsStorage(page)
      expect(storage.session).toEqual([])
      expect(storage.local).toEqual([])
      expect(await analyticsCookies(context, FUNNEL_TOKEN)).toEqual([])
    })
  }
)

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
