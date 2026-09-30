import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { afterEach, beforeEach, test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-009 follow-up (38c42a1..2c45031): a dead session cookie past its
 * renewal point was no longer re-signed, but it stayed in the jar and cost one
 * service-role touch_customer_session RPC on every proxied GET until it lapsed
 * (up to a year). The proxy now clears it on the response that finds it dead,
 * so the browser stops presenting it. A transient failure only skips renewal.
 *
 * This drives the real Proxy with a stubbed fetch, so the RPC count and the
 * Set-Cookie header are what a browser would see. The live-database HTTP proof
 * is tests/e2e/customer-session-renewal-live-db.spec.ts.
 */

const SESSION_COOKIE = "nabaperks_customer_session"
const DEVICE_COOKIE = "nabaperks_device"
const DAY = 24 * 60 * 60
const YEAR = 365 * DAY
const SECRET = "unit-test-customer-session-secret-0123456789"

const ENV = {
  NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "unit-test-anon-key",
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_unit",
  SUPABASE_SERVICE_ROLE_KEY: "unit-test-service-role-key",
  CUSTOMER_SESSION_SECRET: SECRET,
}

const savedEnv = {}
const realFetch = globalThis.fetch
let rpcCalls = 0
/** What touch_customer_session answers: true, false, or an HTTP status. */
let touchAnswer = true

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    savedEnv[key] = process.env[key]
    process.env[key] = value
  }
  rpcCalls = 0
  touchAnswer = true
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url.includes("/rest/v1/rpc/touch_customer_session")) {
      rpcCalls += 1
      if (typeof touchAnswer === "number") {
        return new Response(JSON.stringify({ message: "unavailable" }), {
          status: touchAnswer,
          headers: { "content-type": "application/json" },
        })
      }
      return new Response(JSON.stringify(touchAnswer), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    }
    return new Response(JSON.stringify({}), {
      status: 401,
      headers: { "content-type": "application/json" },
    })
  }
})

afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  globalThis.fetch = realFetch
})

/** The real proxy and its imports, bundled so `next/server` resolves as in Next. */
async function loadProxy() {
  const result = await build({
    stdin: {
      contents: `export { proxy } from "./proxy.ts"; export { NextRequest } from "next/server"; export { createCustomerSessionCookieValue } from "./lib/customer/session-cookie-core.ts"; export { issueCustomerDeviceToken } from "./lib/security/customer-device-token.ts";`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
    banner: {
      js: `import { createRequire as __cr } from "node:module"; const require = __cr(${JSON.stringify(`${process.cwd()}/proxy.ts`)}); const __dirname = ${JSON.stringify(process.cwd())}; const __filename = ${JSON.stringify(`${process.cwd()}/proxy.ts`)};`,
    },
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`
  )
}

const {
  proxy,
  NextRequest,
  createCustomerSessionCookieValue,
  issueCustomerDeviceToken,
} = await loadProxy()

/** A browser whose session cookie was issued three days ago: renewal due. */
function agedJar() {
  const nowSeconds = Math.floor(Date.now() / 1_000)
  const issuedAt = nowSeconds - 3 * DAY
  const session = createCustomerSessionCookieValue(
    {
      version: 2,
      sessionId: randomUUID(),
      customerId: randomUUID(),
      issuedAt,
      expiresAt: issuedAt + YEAR,
    },
    SECRET
  )
  return new Map([
    [DEVICE_COOKIE, issueCustomerDeviceToken(randomUUID(), SECRET)],
    [SESSION_COOKIE, session],
  ])
}

async function get(jar, path = "/home") {
  const cookie = [...jar].map(([name, value]) => `${name}=${value}`).join("; ")
  const response = await proxy(
    new NextRequest(`http://127.0.0.1:3000${path}`, {
      method: "GET",
      headers: { cookie },
    })
  )
  return response
}

function sessionSetCookie(response) {
  return response.headers
    .getSetCookie()
    .find((value) => value.startsWith(`${SESSION_COOKIE}=`))
}

/** Apply Set-Cookie to the jar the way a browser does for this cookie. */
function applySessionCookie(jar, header) {
  if (!header) return
  const value = header.split(";")[0].slice(SESSION_COOKIE.length + 1)
  const maxAge = /;\s*Max-Age=(\d+)/i.exec(header)?.[1]
  const expires = /;\s*Expires=([^;]+)/i.exec(header)?.[1]
  const expired =
    maxAge === "0" ||
    (expires !== undefined && Date.parse(expires) <= Date.now())
  if (!value || expired) jar.delete(SESSION_COOKIE)
  else jar.set(SESSION_COOKIE, value)
}

test("Given a revoked session cookie past its renewal point When the proxy checks it Then the response clears it and the next request makes no renewal RPC", async () => {
  touchAnswer = false
  const jar = agedJar()

  const first = await get(jar)
  const header = sessionSetCookie(first)

  assert.equal(rpcCalls, 1, "the due renewal asks the database once")
  assert.ok(header, "the dead session cookie is cleared on this response")
  assert.match(header, /^nabaperks_customer_session=;/)
  assert.match(header, /Path=\//)
  assert.match(header, /Max-Age=0/)
  assert.match(header, /Expires=Thu, 01 Jan 1970 00:00:00 GMT/)
  assert.match(header, /HttpOnly/i)
  assert.match(header, /SameSite=lax/i)

  applySessionCookie(jar, header)
  assert.equal(jar.has(SESSION_COOKIE), false)

  await get(jar)
  await get(jar, "/api/customer/profile")
  assert.equal(rpcCalls, 1, "no further touch_customer_session RPC")
})

test("Given the database cannot answer When a renewal is due Then the cookie is neither renewed nor cleared", async () => {
  touchAnswer = 503
  const jar = agedJar()

  const response = await get(jar)

  assert.equal(rpcCalls, 1)
  assert.equal(sessionSetCookie(response), undefined)
})

test("Given an active session past its renewal point When the proxy checks it Then it is re-signed for a year as before", async () => {
  touchAnswer = true
  const jar = agedJar()
  const presented = jar.get(SESSION_COOKIE)

  const header = sessionSetCookie(await get(jar))

  assert.equal(rpcCalls, 1)
  assert.ok(header)
  const value = header.split(";")[0].slice(SESSION_COOKIE.length + 1)
  assert.ok(value && value !== presented, "a freshly signed value")
  assert.match(header, new RegExp(`Max-Age=${YEAR}`))
})

test("Given the proxy runtime lacks the service-role configuration When a renewal is due Then the session cookie is left alone", async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
  const jar = agedJar()

  const response = await get(jar)

  assert.equal(rpcCalls, 0)
  assert.equal(sessionSetCookie(response), undefined)
})
