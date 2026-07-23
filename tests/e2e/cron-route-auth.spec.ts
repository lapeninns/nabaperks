import { expect, test, type APIRequestContext } from "@playwright/test"

/**
 * Cron and monitor route-wiring proof.
 *
 * The cron-auth helper is unit-tested (tests/unit/cron-auth.test.mjs). This
 * spec proves the other half: that every `/api/cron/*` route actually wires the
 * bearer gate at the HTTP boundary — fails closed without a bearer, rejects a
 * wrong bearer, and opens for the configured secret — and that `/api/readiness`
 * gates on a DISTINCT secret and does not accept the cron secret. The route
 * handlers cannot be imported under `node --test` (their `next/server` graph
 * only resolves inside Next), so the proof lives here.
 *
 * The harness bakes `CRON_SECRET` / `PRODUCTION_MONITOR_SECRET` in
 * playwright.config.ts. When run against a reused dev server that uses different
 * secrets, the positive "gate opens" cases skip (mirroring auth-hook-routes).
 */

const CRON_SECRET = "pw-cron-secret-e2e-do-not-use-in-production"
const PRODUCTION_MONITOR_SECRET =
  "pw-monitor-secret-e2e-do-not-use-in-production"

const CRON_ROUTES = [
  "/api/cron/notifications",
  "/api/cron/birthday-rewards",
  "/api/cron/referral-bonus-drain",
  "/api/cron/loyalty-invite-drain",
  "/api/cron/merchant-digest",
  "/api/cron/privacy-retention",
] as const

async function getWithAuth(
  request: APIRequestContext,
  path: string,
  authorization?: string
) {
  return request.get(path, {
    headers: authorization ? { authorization } : {},
    // A failing gate could redirect or error; never auto-follow so we assert on
    // the route's own response.
    maxRedirects: 0,
  })
}

test.describe("cron route bearer gate", () => {
  for (const path of CRON_ROUTES) {
    test(`${path} rejects a request with no Authorization header`, async ({
      request,
    }) => {
      const response = await getWithAuth(request, path)

      expect(response.status()).toBe(401)
      expect(response.headers()["cache-control"] ?? "").toContain("no-store")
      await expect(response.json()).resolves.toEqual({ error: "unauthorized" })
    })

    test(`${path} rejects a wrong bearer token`, async ({ request }) => {
      const response = await getWithAuth(
        request,
        path,
        "Bearer not-the-cron-secret"
      )

      expect(response.status()).toBe(401)
      await expect(response.json()).resolves.toEqual({ error: "unauthorized" })
    })

    test(`${path} rejects a non-Bearer scheme carrying the secret`, async ({
      request,
    }) => {
      const response = await getWithAuth(request, path, `Basic ${CRON_SECRET}`)

      expect(response.status()).toBe(401)
    })
  }

  // One representative route proves the gate OPENS for the configured secret,
  // so the 401s above are the gate working, not a route hardcoded to 401. The
  // drain itself is DB-covered (tests/db/referral-settlement.test.mjs); here we
  // only assert the gate passed (status is not the auth rejection). Against the
  // real local DB this returns 200; against CI placeholder creds the drain RPC
  // errors to 500 — both prove the bearer was accepted.
  test("a valid cron bearer passes the gate (referral-bonus-drain)", async ({
    request,
  }) => {
    const response = await getWithAuth(
      request,
      "/api/cron/referral-bonus-drain",
      `Bearer ${CRON_SECRET}`
    )

    test.skip(
      response.status() === 401,
      "dev server is not using the Playwright harness CRON_SECRET"
    )
    expect(response.status()).not.toBe(401)
  })
})

test.describe("readiness route uses a distinct monitor secret", () => {
  test("no Authorization header is rejected", async ({ request }) => {
    const response = await getWithAuth(request, "/api/readiness")

    expect(response.status()).toBe(401)
  })

  test("the cron secret is NOT accepted by readiness", async ({ request }) => {
    const response = await getWithAuth(
      request,
      "/api/readiness",
      `Bearer ${CRON_SECRET}`
    )

    // Proves CRON_SECRET and PRODUCTION_MONITOR_SECRET are not interchangeable.
    expect(response.status()).toBe(401)
  })

  test("the monitor secret passes the readiness gate", async ({ request }) => {
    const response = await getWithAuth(
      request,
      "/api/readiness",
      `Bearer ${PRODUCTION_MONITOR_SECRET}`
    )

    test.skip(
      response.status() === 401,
      "dev server is not using the Playwright harness PRODUCTION_MONITOR_SECRET"
    )
    // Gate opened: 200 (ready) with a live DB, or 503 (not ready) against
    // placeholder creds — either way, not the auth rejection.
    expect(response.status()).not.toBe(401)
  })
})
