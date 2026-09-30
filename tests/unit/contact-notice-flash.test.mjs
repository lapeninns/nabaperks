import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * The previous-stamps and reward-gate outcome notices ("Your stamps are
 * together now", "Mobile number confirmed") come only from a one-time cookie
 * the confirming server action sets, never from a URL parameter.
 *
 * The real flash module, its cookie codec, the session cookie codec and the
 * consume route run with only the cookie store, the secret and the logger
 * stubbed, so the test proves what a browser can and cannot make a screen say.
 */
const REAL = new Set([
  "@/lib/customer/contact-notice-flash",
  "@/lib/customer/contact-notice-flash-core",
  "@/lib/customer/pending-cookie-crypto",
  "@/lib/customer/previous-stamps",
  "@/lib/customer/session-cookie",
  "@/lib/customer/session-cookie-core",
  "@/lib/http/persistent-cookie-options",
  "@/lib/http/no-store-json",
  "@/lib/navigation/safe-next-path",
])

const SECRET = "unit-test-customer-session-secret-0123456789"
const CUSTOMER_ID = "9b8f7e6d-5c4b-4a39-8281-716151413121"
const OTHER_CUSTOMER_ID = "1b8f7e6d-5c4b-4a39-8281-716151413121"
const NOTICE_COOKIE = "nabaperks_contact_notice"
const SESSION_COOKIE = "nabaperks_customer_session"

const STUBS = {
  "fixture-state": `export const state = { cookies: new Map(), set: [], warnings: [] };`,
  "server-only": "",
  "next/headers": `import { state } from "fixture-state";
    export async function cookies() {
      return {
        get(name) { return state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined },
        set(name, value, options) { state.set.push([name, options]); state.cookies.set(name, value) },
        delete(name) { state.cookies.delete(name) },
      }
    }`,
  "next/server": `export class NextResponse {
      constructor(body, init) { this.body = body; this.status = init.status; this.headers = init.headers }
      static json(body, init) { return new NextResponse(body, init) }
    }`,
  "@/lib/security/customer-session-secret": `export function requiredCustomerSessionSecret() { return ${JSON.stringify(SECRET)} }`,
  "@/lib/observability/logger": `import { state } from "fixture-state";
    export const logger = { warn(message, context) { state.warnings.push([message, context]) }, error() {}, info() {} }`,
}

async function load() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents: [
        `export * from "./lib/customer/contact-notice-flash.ts";`,
        `export { POST as consumeContactNotice } from "./app/home/contact-notice/route.ts";`,
        `export { createCustomerSessionCookieValue } from "@/lib/customer/session-cookie-core";`,
        `export { createContactNoticeCookieValue } from "@/lib/customer/contact-notice-flash-core";`,
        `export { state } from "fixture-state";`,
      ].join("\n"),
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "contact-notice-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\// }, ({ path: specifier }) =>
            REAL.has(specifier)
              ? { path: path.join(root, `${specifier.slice(2)}.ts`) }
              : { path: specifier, namespace: "fixture" }
          )
          build.onResolve(
            {
              filter:
                /^(fixture-state|server-only|next\/headers|next\/server)$/,
            },
            ({ path: specifier }) => ({ path: specifier, namespace: "fixture" })
          )
          build.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path: id }) => {
              assert.ok(id in STUBS, `Unrecognised boundary: ${id}`)
              return { contents: STUBS[id], resolveDir: root }
            }
          )
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

function now() {
  return Math.floor(Date.now() / 1_000)
}

function signIn(mod, customerId = CUSTOMER_ID) {
  mod.state.cookies.set(
    SESSION_COOKIE,
    mod.createCustomerSessionCookieValue(
      {
        version: 2,
        sessionId: "3f0c5f7e-2d3b-4c1a-9a57-5f2f1f8f9a10",
        customerId,
        issuedAt: now() - 60,
        expiresAt: now() + 3_600,
      },
      SECRET
    )
  )
}

const PROFILE = { customerId: CUSTOMER_ID, pathname: "/home/profile" }

test("Given a forged notice When a screen reads it Then nothing is shown", async () => {
  const mod = await load()
  signIn(mod)

  // What the old URL flag carried, or any hand-made value.
  for (const forged of [
    "stamps-together",
    "nothing-found-email",
    "phone-added",
    "v2.aaaa.bbbb.cccc",
  ]) {
    mod.state.cookies.set(NOTICE_COOKIE, forged)
    assert.equal(await mod.readContactNoticeFlash(PROFILE), null, forged)
  }

  // Sealed with another secret.
  mod.state.cookies.set(
    NOTICE_COOKIE,
    mod.createContactNoticeCookieValue(
      {
        version: 1,
        customerId: CUSTOMER_ID,
        notice: "stamps-together",
        pathname: "/home/profile",
        issuedAt: now(),
        expiresAt: now() + 60,
      },
      "another-secret-0123456789-0123456789-0123"
    )
  )
  assert.equal(await mod.readContactNoticeFlash(PROFILE), null)

  // Genuine, but for another customer, another screen, or lapsed.
  for (const payload of [
    { customerId: OTHER_CUSTOMER_ID, pathname: "/home/profile", age: 0 },
    { customerId: CUSTOMER_ID, pathname: "/reward/r-1", age: 0 },
    { customerId: CUSTOMER_ID, pathname: "/home/profile", age: 120 },
  ]) {
    mod.state.cookies.set(
      NOTICE_COOKIE,
      mod.createContactNoticeCookieValue(
        {
          version: 1,
          customerId: payload.customerId,
          notice: "stamps-together",
          pathname: payload.pathname,
          issuedAt: now() - payload.age,
          expiresAt: now() - payload.age + 60,
        },
        SECRET
      )
    )
    assert.equal(
      await mod.readContactNoticeFlash(PROFILE),
      null,
      JSON.stringify(payload)
    )
  }

  // No signed-in viewer: nothing.
  assert.equal(
    await mod.readContactNoticeFlash({ customerId: null, pathname: "/" }),
    null
  )
})

test("Given the confirming action records an outcome When the screen it returns to reads it Then it shows once", async () => {
  const mod = await load()
  signIn(mod)

  const href = await mod.setContactNoticeFlash(
    "stamps-together",
    "/home/profile#previous-stamps"
  )
  // The redirect carries no flag; query and hash of returnTo are kept.
  assert.equal(href, "/home/profile#previous-stamps")
  const [[name, options]] = mod.state.set
  assert.equal(name, NOTICE_COOKIE)
  assert.equal(options.httpOnly, true)
  assert.equal(options.sameSite, "lax")
  assert.equal(options.maxAge, 60)

  // Only the screen it was sent to, for the customer who proved it.
  assert.equal(
    await mod.readContactNoticeFlash({
      customerId: OTHER_CUSTOMER_ID,
      pathname: "/home/profile",
    }),
    null
  )
  assert.equal(
    await mod.readContactNoticeFlash({
      customerId: CUSTOMER_ID,
      pathname: "/reward/r-1",
    }),
    null
  )
  assert.equal(await mod.readContactNoticeFlash(PROFILE), "stamps-together")

  // Shown, then spent: a reload shows nothing.
  const response = await mod.consumeContactNotice()
  assert.equal(response.status, 204)
  assert.equal(response.headers["cache-control"], "no-store, max-age=0")
  assert.equal(await mod.readContactNoticeFlash(PROFILE), null)
})

test("Given the reward gate returns to a reward When the notice is recorded Then it is bound to that reward's path", async () => {
  const mod = await load()
  signIn(mod)

  assert.equal(
    await mod.setContactNoticeFlash("phone-added", "/reward/r-1?prepare=1"),
    "/reward/r-1?prepare=1"
  )
  assert.equal(
    await mod.readContactNoticeFlash({
      customerId: CUSTOMER_ID,
      pathname: "/reward/r-1",
    }),
    "phone-added"
  )
  assert.equal(await mod.readContactNoticeFlash(PROFILE), null)

  // An off-site returnTo falls back to the profile.
  assert.equal(
    await mod.setContactNoticeFlash("phone-added", "https://evil.example/x"),
    "/home/profile"
  )
})

test("Given a wallet link re-issued the session When the notice is recorded Then it is bound to the surviving card", async () => {
  const mod = await load()
  // The link action set a new session cookie for the survivor earlier in the
  // same request.
  signIn(mod, OTHER_CUSTOMER_ID)

  await mod.setContactNoticeFlash("stamps-together", "/home/profile")
  assert.equal(await mod.readContactNoticeFlash(PROFILE), null)
  assert.equal(
    await mod.readContactNoticeFlash({
      customerId: OTHER_CUSTOMER_ID,
      pathname: "/home/profile",
    }),
    "stamps-together"
  )
})

test("Given no signed-in session When an outcome is recorded Then no notice is minted", async () => {
  const mod = await load()

  assert.equal(
    await mod.setContactNoticeFlash("phone-added", "/reward/r-1"),
    "/reward/r-1"
  )
  assert.deepEqual(mod.state.set, [])
})
