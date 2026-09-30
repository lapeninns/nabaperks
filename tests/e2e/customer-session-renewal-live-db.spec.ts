import { createHash, randomUUID } from "node:crypto"

import {
  expect,
  request as playwrightRequest,
  test,
  type APIResponse,
} from "@playwright/test"

import {
  createCustomerSessionCookieValue,
  readCustomerSessionCookieValue,
} from "../../lib/customer/session-cookie-core"
import { issueCustomerDeviceToken } from "../../lib/security/customer-device-token"

import { connectLocalDb, type Sql } from "./helpers/admin-live-db"
import { customerReadbackLiveDbSkipReason } from "./helpers/customer-readback-live-db"

/**
 * QA BUG-009 (38c42a1..2c45031): the proxy re-signed a revoked, server-expired
 * or deleted session's cookie for another year on the redirect to sign-in.
 * Only a session the database still accepts may be renewed. A dead one is
 * cleared on that response (BUG-009 follow-up), so the browser stops
 * presenting it and the proxy stops asking the database about it on every
 * request until it lapses.
 *
 * Plain HTTP with redirects off, so the proof is the response that carries
 * (or does not carry) the renewal, not whatever the browser follows next.
 */

const SESSION_COOKIE = "nabaperks_customer_session"
const DEVICE_COOKIE = "nabaperks_device"
const DAY = 24 * 60 * 60
const YEAR = 365 * DAY

type SessionState = "active" | "revoked" | "expired" | "deleted"

const nowSeconds = () => Math.floor(Date.now() / 1_000)

function sessionSecret(): string {
  return process.env.CUSTOMER_SESSION_SECRET?.trim() ?? ""
}

async function insertCustomer(sql: Sql): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    insert into public.customers (email, email_verified_at, created_at, updated_at)
    values (${`renewal-${randomUUID()}@example.com`}, now(), now(), now())
    returning id`
  return row.id
}

/** A signed-in browser whose cookie was issued three days ago: renewal due. */
async function agedBrowserSession(
  sql: Sql,
  customerId: string,
  state: SessionState
): Promise<string> {
  const sessionId = randomUUID()
  const deviceId = randomUUID()
  const deviceHash = createHash("sha256")
    .update(`customer-device:${deviceId}`)
    .digest("hex")
  const issuedAt = nowSeconds() - 3 * DAY
  const expiresAt =
    state === "expired"
      ? new Date(Date.now() - DAY * 1_000).toISOString()
      : "infinity"

  await sql`
    insert into public.customer_sessions (
      id, customer_id, created_at, expires_at, last_seen_at, device_hash
    )
    values (
      ${sessionId}::uuid, ${customerId}::uuid, to_timestamp(${issuedAt}),
      ${expiresAt}::text::timestamptz, to_timestamp(${issuedAt}), ${deviceHash}
    )`
  if (state === "revoked") {
    await sql`update public.customer_sessions set revoked_at = now()
      where id = ${sessionId}::uuid`
  }
  if (state === "deleted") {
    await sql`delete from public.customer_sessions where id = ${sessionId}::uuid`
  }

  const secret = sessionSecret()
  const session = createCustomerSessionCookieValue(
    { version: 2, sessionId, customerId, issuedAt, expiresAt: issuedAt + YEAR },
    secret
  )
  return `${DEVICE_COOKIE}=${issueCustomerDeviceToken(deviceId, secret)}; ${SESSION_COOKIE}=${session}`
}

/** Days of life the response gives the session cookie, or null if unset. */
function renewedSessionDays(response: APIResponse): number | null {
  const cookies = response
    .headersArray()
    .filter(({ name }) => name.toLowerCase() === "set-cookie")
    .map(({ value }) => value)
    .filter((value) => value.startsWith(`${SESSION_COOKIE}=`))
  if (cookies.length === 0) return null
  const value = cookies
    .at(-1)
    ?.split(";")[0]
    .slice(SESSION_COOKIE.length + 1)
  if (!value) return 0
  const read = readCustomerSessionCookieValue(
    value,
    sessionSecret(),
    nowSeconds()
  )
  return read.ok ? Math.round((read.payload.expiresAt - nowSeconds()) / DAY) : 0
}

/**
 * The response deletes the session cookie outright: every Set-Cookie for it
 * is empty, on path /, and already expired. (Next repeats a proxy cookie on a
 * redirect without its Max-Age, so Expires is what both copies share.)
 */
function clearsSessionCookie(response: APIResponse): boolean {
  const headers = response
    .headersArray()
    .filter(({ name }) => name.toLowerCase() === "set-cookie")
    .map(({ value }) => value)
    .filter((value) => value.startsWith(`${SESSION_COOKIE}=`))
  return (
    headers.length > 0 &&
    headers.every((header) => {
      const expires = /;\s*Expires=([^;]+)/i.exec(header)?.[1]
      return (
        header.startsWith(`${SESSION_COOKIE}=;`) &&
        /;\s*Path=\/(;|$)/i.test(header) &&
        expires !== undefined &&
        Date.parse(expires) < Date.now() - 1_000
      )
    })
  )
}

test.describe("@customer-flow customer session cookie renewal", () => {
  const reason = customerReadbackLiveDbSkipReason()
  test.skip(Boolean(reason), reason)

  let sql: Sql | undefined
  let customerId: string | undefined

  test.beforeAll(async () => {
    sql = connectLocalDb()
    if (sql) customerId = await insertCustomer(sql)
  })

  test.afterAll(async () => {
    if (sql && customerId) {
      await sql`delete from public.customers where id = ${customerId}::uuid`
    }
    await sql?.end({ timeout: 5 })
  })

  test("renews an active session that is due", async ({ request }) => {
    test.skip(!sql || !customerId, "local Supabase DB is not configured")
    if (!sql || !customerId) return

    const cookie = await agedBrowserSession(sql, customerId, "active")
    const response = await request.get("/home", {
      headers: { cookie },
      maxRedirects: 0,
    })

    expect(response.status()).toBe(200)
    expect(renewedSessionDays(response)).toBe(365)
  })

  for (const state of ["revoked", "expired", "deleted"] as const) {
    test(`clears, rather than re-signs, the cookie of a session that is ${state}`, async ({
      request,
    }) => {
      test.skip(!sql || !customerId, "local Supabase DB is not configured")
      if (!sql || !customerId) return

      const cookie = await agedBrowserSession(sql, customerId, state)
      const home = await request.get("/home", {
        headers: { cookie },
        maxRedirects: 0,
      })
      expect(home.status()).toBe(307)
      expect(home.headers().location).toMatch(/^\/home\/login/)
      expect(renewedSessionDays(home) ?? 0).toBe(0)
      expect(clearsSessionCookie(home)).toBe(true)

      const login = await request.get("/home/login", {
        headers: { cookie },
        maxRedirects: 0,
      })
      expect(login.status()).toBe(200)
      expect(renewedSessionDays(login) ?? 0).toBe(0)
      expect(clearsSessionCookie(login)).toBe(true)
    })
  }

  test("a browser jar drops a revoked cookie after one request, so later requests do not present it", async ({
    baseURL,
  }) => {
    test.skip(!sql || !customerId, "local Supabase DB is not configured")
    if (!sql || !customerId || !baseURL) return

    const cookieHeader = await agedBrowserSession(sql, customerId, "revoked")
    const { hostname } = new URL(baseURL)
    const jar = await playwrightRequest.newContext({
      baseURL,
      storageState: {
        cookies: cookieHeader.split("; ").map((pair) => {
          const at = pair.indexOf("=")
          return {
            name: pair.slice(0, at),
            value: pair.slice(at + 1),
            domain: hostname,
            path: "/",
            expires: nowSeconds() + YEAR,
            httpOnly: true,
            secure: false,
            sameSite: "Lax" as const,
          }
        }),
        origins: [],
      },
    })
    try {
      const first = await jar.get("/home", { maxRedirects: 0 })
      expect(clearsSessionCookie(first)).toBe(true)

      const remaining = (await jar.storageState()).cookies.map(
        ({ name }) => name
      )
      expect(remaining).toContain(DEVICE_COOKIE)
      expect(remaining).not.toContain(SESSION_COOKIE)

      const second = await jar.get("/home", { maxRedirects: 0 })
      expect(second.status()).toBe(307)
      expect(
        second
          .headersArray()
          .some(
            ({ name, value }) =>
              name.toLowerCase() === "set-cookie" &&
              value.startsWith(`${SESSION_COOKIE}=`)
          )
      ).toBe(false)
    } finally {
      await jar.dispose()
    }
  })
})
