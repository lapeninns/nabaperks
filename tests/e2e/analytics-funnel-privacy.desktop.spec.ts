import { expect, test } from "@playwright/test"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

import { deterministicFunnelEventId } from "../../lib/analytics/funnel-token"

const FUNNEL_ENDPOINT = "/api/analytics/funnel"
const FUNNEL_TOKEN = "test-signed-desktop-funnel-token"

test.describe("desktop privacy-safe merchant funnel", () => {
  test.use({ serviceWorkers: "block" })

  test("desktop signup uses one session-only identity", async ({
    context,
    page,
  }) => {
    const requests: Array<Record<string, unknown>> = []

    await page.route(`**${FUNNEL_ENDPOINT}`, async (route) => {
      requests.push(route.request().postDataJSON())
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        headers: { "cache-control": "no-store" },
        body: JSON.stringify({ token: FUNNEL_TOKEN }),
      })
    })

    await page.goto("/signup")
    await expect
      .poll(() => requests.map(({ event }) => event))
      .toContain("merchant_signup_started")
    await expect(page.getByLabel(/email/i)).toBeVisible()

    const storage = await page.evaluate(
      (token) => ({
        sessionValues: Object.values(sessionStorage),
        localEntries: Object.entries(localStorage),
        token,
      }),
      FUNNEL_TOKEN
    )
    expect(storage.sessionValues).toContain(FUNNEL_TOKEN)
    expect(storage.localEntries).toEqual([])
    expect(
      (await context.cookies()).filter(
        ({ name, value }) =>
          /analytics|funnel|posthog|^ph_/i.test(name) || value === FUNNEL_TOKEN
      )
    ).toEqual([])
  })

  test("the real local route is idempotent and drops a tampered identity", async ({
    page,
  }) => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    const parsedSupabaseUrl = URL.canParse(supabaseUrl)
      ? new URL(supabaseUrl)
      : null
    const hasDisposableSupabase =
      parsedSupabaseUrl !== null &&
      ["127.0.0.1", "localhost"].includes(parsedSupabaseUrl.hostname) &&
      Boolean(serviceRoleKey)
    test.skip(
      !hasDisposableSupabase,
      "Analytics route proof requires disposable local Supabase"
    )

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    let eventId = ""
    let lostResponseEventId = ""
    let rejectedEventId = ""
    let rejectedFreshEventId = ""
    const localBucketKeys = [
      "unknown",
      "127.0.0.1",
      "::1",
      "::ffff:127.0.0.1",
    ].map(analyticsRateLimitBucketKey)

    try {
      let lostToken = ""
      await page.route(`**${FUNNEL_ENDPOINT}`, async (route) => {
        const body = route.request().postDataJSON() as {
          token?: string
        }
        if (!lostToken && !body.token) {
          const response = await route.fetch()
          const result = (await response.json()) as { token?: string }
          lostToken = result.token ?? ""
          await route.abort("failed")
          return
        }
        await route.continue()
      })
      await page.goto("/signup")
      await expect
        .poll(() => lostToken, {
          message:
            "the real route issued identity before the response was lost",
        })
        .not.toBe("")
      lostResponseEventId = deterministicFunnelEventId(
        lostToken,
        "merchant_signup_started"
      )
      const { count: orphanCount, error: orphanError } = await supabase
        .from("product_events")
        .select("id", { count: "exact", head: true })
        .eq("id", lostResponseEventId)
      if (orphanError) throw orphanError
      expect(orphanCount).toBe(0)

      await page.unroute(`**${FUNNEL_ENDPOINT}`)
      await page.reload()
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                Object.entries(sessionStorage).find(([key]) =>
                  key.includes("analytics:funnel-token")
                )?.[1]
            ),
          { message: "the real route returns a signed session token" }
        )
        .not.toBeUndefined()
      const token = await page.evaluate(
        () =>
          Object.entries(sessionStorage).find(([key]) =>
            key.includes("analytics:funnel-token")
          )?.[1]
      )

      expect(token).toBeTruthy()
      eventId = deterministicFunnelEventId(token!, "merchant_signup_started")

      await expect
        .poll(async () => {
          const { count, error } = await supabase
            .from("product_events")
            .select("id", { count: "exact", head: true })
            .eq("id", eventId)
          if (error) throw error
          return count
        })
        .toBe(1)

      await page.reload()
      await expect
        .poll(async () => {
          const { data, error } = await supabase
            .from("product_events")
            .select("event_name,metadata")
            .eq("id", eventId)
          if (error) throw error
          return data
        })
        .toEqual([
          expect.objectContaining({
            event_name: "merchant_signup_started",
            metadata: expect.objectContaining({
              funnel_key: expect.any(String),
            }),
          }),
        ])

      const tampered = `${token!.slice(0, -1)}${token!.endsWith("a") ? "b" : "a"}`
      rejectedEventId = deterministicFunnelEventId(
        tampered,
        "merchant_otp_verification_viewed"
      )
      const {
        count: signupClickCountBefore,
        error: signupClickCountBeforeError,
      } = await supabase
        .from("product_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "merchant_otp_verification_viewed")
      if (signupClickCountBeforeError) throw signupClickCountBeforeError

      const rejectedResponse = await page.evaluate(
        async ({ endpoint, token: suppliedToken }) => {
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              event: "merchant_otp_verification_viewed",
              token: suppliedToken,
            }),
          })
          return { status: response.status, body: await response.json() }
        },
        { endpoint: FUNNEL_ENDPOINT, token: tampered }
      )
      expect(rejectedResponse.status).toBe(202)
      const freshToken = (rejectedResponse.body as { token?: string }).token
      expect(freshToken).toBeTruthy()
      rejectedFreshEventId = deterministicFunnelEventId(
        freshToken!,
        "merchant_otp_verification_viewed"
      )

      const { count: rejectedCount, error: rejectedError } = await supabase
        .from("product_events")
        .select("id", { count: "exact", head: true })
        .in("id", [rejectedEventId, rejectedFreshEventId])
      if (rejectedError) throw rejectedError
      expect(rejectedCount).toBe(0)

      const {
        count: signupClickCountAfter,
        error: signupClickCountAfterError,
      } = await supabase
        .from("product_events")
        .select("id", { count: "exact", head: true })
        .eq("event_name", "merchant_otp_verification_viewed")
      if (signupClickCountAfterError) throw signupClickCountAfterError
      expect(signupClickCountAfter).toBe(signupClickCountBefore)
    } finally {
      const ids = [
        eventId,
        lostResponseEventId,
        rejectedEventId,
        rejectedFreshEventId,
      ].filter(Boolean)
      if (ids.length > 0) {
        await supabase.from("product_events").delete().in("id", ids)
      }
      await supabase
        .from("rate_limit_buckets")
        .delete()
        .in("bucket_key", localBucketKeys)

      if (ids.length > 0) {
        const { count } = await supabase
          .from("product_events")
          .select("id", { count: "exact", head: true })
          .in("id", ids)
        expect(count).toBe(0)
      }
      const { count: bucketCount } = await supabase
        .from("rate_limit_buckets")
        .select("bucket_key", { count: "exact", head: true })
        .in("bucket_key", localBucketKeys)
      expect(bucketCount).toBe(0)
    }
  })
})

function analyticsRateLimitBucketKey(ip: string) {
  return createHash("sha256").update(`analytics-funnel-ip:${ip}`).digest("hex")
}
