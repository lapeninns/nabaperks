import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { createRequire } from "node:module"
import path from "node:path"
import { afterEach, beforeEach, test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-067 (38c42a1..2c45031): about 3% of page-level redirects (for
 * example a signed-out GET /home, 307 to /home/login) carried two
 * `nabaperks_device` Set-Cookie lines with the same value and Expires one
 * second apart.
 *
 * Mechanism, in Next 16.3.5: the Proxy's cookie reaches the render through
 * `x-middleware-set-cookie`; the redirect branch of app-render re-sets it on
 * the response with `appendMutableCookies`. Each `ResponseCookies.set`
 * recomputes Expires from Max-Age at that instant, and the final header merge
 * drops only byte-identical lines, so a render that crosses a wall-clock second
 * sends both.
 *
 * This drives the real Proxy, then replays the redirect branch with Next's own
 * request store and `appendMutableCookies` one and a half seconds later, and
 * merges the lines the way `base-http/node.js` `appendHeader` does. Every
 * cookie must end up with exactly one Set-Cookie line.
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

const root = process.cwd()
const nextRequire = createRequire(path.join(root, "package.json"))
const { createRequestStoreForRender } = nextRequire(
  "next/dist/server/async-storage/request-store.js"
)
const { appendMutableCookies } = nextRequire(
  "next/dist/server/web/spec-extension/adapters/request-cookies.js"
)

const savedEnv = {}
const realFetch = globalThis.fetch
const realNow = Date.now

beforeEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    savedEnv[key] = process.env[key]
    process.env[key] = value
  }
  // The session renewal check: the database still accepts the session.
  globalThis.fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input)
    const active = url.includes("/rest/v1/rpc/touch_customer_session")
    return new Response(JSON.stringify(active ? true : {}), {
      status: active ? 200 : 401,
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
  Date.now = realNow
})

/** The real proxy and its imports, bundled so `next/server` resolves as in Next. */
async function loadProxy() {
  const result = await build({
    stdin: {
      contents: `export { proxy } from "./proxy.ts"; export { NextRequest } from "next/server"; export { createCustomerSessionCookieValue } from "./lib/customer/session-cookie-core.ts"; export { issueCustomerDeviceToken } from "./lib/security/customer-device-token.ts";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
    banner: {
      js: `import { createRequire as __cr } from "node:module"; const require = __cr(${JSON.stringify(`${root}/proxy.ts`)}); const __dirname = ${JSON.stringify(root)}; const __filename = ${JSON.stringify(`${root}/proxy.ts`)};`,
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

/**
 * The Set-Cookie lines a browser receives when the page behind this Proxy
 * response redirects `laterMs` after the Proxy ran.
 */
function redirectSetCookies(response, pathname, laterMs) {
  const proxyLines = response.headers.getSetCookie()
  const forwarded = response.headers.get("x-middleware-set-cookie")
  assert.ok(forwarded, "the Proxy forwards its cookies to the render")

  const renderAt = realNow() + laterMs
  Date.now = () => renderAt
  const store = createRequestStoreForRender(
    { headers: { "x-middleware-set-cookie": forwarded } },
    undefined,
    { pathname, search: "" },
    {},
    [],
    () => {},
    undefined,
    false,
    undefined,
    null,
    null,
    undefined
  )
  const redirectHeaders = new Headers()
  appendMutableCookies(redirectHeaders, store.mutableCookies)
  Date.now = realNow

  // base-http/node.js appendHeader: only a byte-identical line is dropped.
  const lines = [...proxyLines]
  for (const line of redirectHeaders.getSetCookie()) {
    if (!lines.includes(line)) lines.push(line)
  }
  return lines
}

function linesByName(lines) {
  const byName = new Map()
  for (const line of lines) {
    const name = line.slice(0, line.indexOf("="))
    byName.set(name, [...(byName.get(name) ?? []), line])
  }
  return byName
}

function assertOneLinePerCookie(lines, expectedNames) {
  const byName = linesByName(lines)
  for (const name of expectedNames) {
    assert.equal(
      byName.get(name)?.length,
      1,
      `${name} has exactly one Set-Cookie line: ${JSON.stringify(
        (byName.get(name) ?? []).map((line) =>
          line.replace(/^[^;]*/, `${name}=<value>`)
        )
      )}`
    )
  }
}

/** Persistent across Safari process death: an absolute Expires a year out. */
function assertPersistentForAYear(line) {
  const expires = /;\s*Expires=([^;]+)/i.exec(line)?.[1]
  assert.ok(expires, "carries an absolute Expires date")
  const days = (Date.parse(expires) - realNow()) / 1_000 / DAY
  assert.ok(days > 364 && days <= 365, `expires in a year, got ${days} days`)
}

test("Given a signed-out visit with no device cookie When /home redirects to sign-in across a second boundary Then the device cookie is sent once", async () => {
  const response = await proxy(
    new NextRequest("http://127.0.0.1:3000/home", { method: "GET" })
  )

  const lines = redirectSetCookies(response, "/home", 1_500)

  assertOneLinePerCookie(lines, [DEVICE_COOKIE])
  assertPersistentForAYear(linesByName(lines).get(DEVICE_COOKIE)[0])
})

test("Given a returning customer whose session renewal is due When the page redirects across a second boundary Then the device and renewed session cookies are each sent once", async () => {
  const issuedAt = Math.floor(realNow() / 1_000) - 3 * DAY
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
  const device = issueCustomerDeviceToken(randomUUID(), SECRET)
  const response = await proxy(
    new NextRequest("http://127.0.0.1:3000/home/profile", {
      method: "GET",
      headers: {
        cookie: `${DEVICE_COOKIE}=${device}; ${SESSION_COOKIE}=${session}`,
      },
    })
  )

  const lines = redirectSetCookies(response, "/home/profile", 1_500)

  assertOneLinePerCookie(lines, [DEVICE_COOKIE, SESSION_COOKIE])
  assertPersistentForAYear(linesByName(lines).get(SESSION_COOKIE)[0])
})
