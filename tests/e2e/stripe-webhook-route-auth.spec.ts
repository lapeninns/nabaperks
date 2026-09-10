import { expect, test, type APIRequestContext } from "@playwright/test"

/**
 * Stripe webhook route-wiring proof.
 *
 * Processor, lease, and claim behaviour is unit-owned
 * (`tests/unit/stripe-webhook-events.test.mjs`). This spec only proves the HTTP
 * boundary of `POST /api/stripe/webhook`: missing or junk signatures fail
 * closed, and an oversized Content-Length is rejected with 413 before Stripe
 * verification. The handler cannot be imported under `node --test` (its
 * `next/server` graph only resolves inside Next), so the proof lives here.
 */

const WEBHOOK_PATH = "/api/stripe/webhook"
const OVERSIZED_WEBHOOK_BYTES = 1_048_577
const JUNK_SIGNATURE = "t=1,v1=not-a-real-stripe-signature"

async function postWebhook(
  request: APIRequestContext,
  options: {
    signature?: string
    body?: string
  }
) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  }
  if (options.signature) {
    headers["stripe-signature"] = options.signature
  }

  return request.post(WEBHOOK_PATH, {
    headers,
    data: options.body ?? "{}",
    // A failing gate could redirect or error; never auto-follow so we assert on
    // the route's own response.
    maxRedirects: 0,
  })
}

test.describe("Stripe webhook route fail-closed", () => {
  test("POST without stripe-signature is rejected", async ({ request }) => {
    const response = await postWebhook(request, {})

    expect(response.status()).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Missing Stripe signature",
    })
  })

  test("POST with a junk signature and a small body is rejected", async ({
    request,
  }) => {
    const response = await postWebhook(request, {
      signature: JUNK_SIGNATURE,
      body: '{"id":"evt_playwright_junk"}',
    })

    expect(response.status()).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: "Invalid Stripe signature",
    })
  })

  test("POST with a signature and Content-Length 1048577 is rejected before verify", async ({
    request,
  }) => {
    // Playwright derives Content-Length from the body. Sending ceiling+1 bytes
    // makes the declared length 1048577 so the route's fast path returns 413
    // instead of running constructEvent (which would be 400 for this junk
    // signature).
    const response = await postWebhook(request, {
      signature: JUNK_SIGNATURE,
      body: "x".repeat(OVERSIZED_WEBHOOK_BYTES),
    })

    expect(response.status()).toBe(413)
    await expect(response.json()).resolves.toEqual({
      error: "Stripe webhook body is too large",
    })
  })
})
