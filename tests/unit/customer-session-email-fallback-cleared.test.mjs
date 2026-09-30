import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-053 (38c42a1..2c45031): the signed-out email fallback record
 * (`nabaperks_email_fallback`) outlived an email sign-in and a log-out for up
 * to ten minutes, so whoever used the browser next inherited "email already
 * opened" at /home/login. Signing in and signing out now clear it with the
 * other signed-out email cookies.
 *
 * The real `lib/customer/session.ts` runs with the cookie store, request
 * headers and the Supabase service client stubbed; the cookie codecs and the
 * fallback cookie name are the real ones.
 */

const REAL = new Set([
  "@/lib/customer/session-cookie",
  "@/lib/customer/session-cookie-core",
  "@/lib/customer/pending-cookie-crypto",
  "@/lib/customer/email-sign-in-core",
  "@/lib/customer/email-pii-core",
  "@/lib/customer/session-load-row",
  "@/lib/supabase/missing-rpc",
  "@/lib/http/persistent-cookie-options",
  "@/lib/customer/email-fallback-core",
])

const SECRET = "unit-test-customer-session-secret-0123456789"
const SESSION_ID = "3f0c5f7e-2d3b-4c1a-9a57-5f2f1f8f9a10"
const CUSTOMER_ID = "9b8f7e6d-5c4b-4a39-8281-716151413121"

const STUBS = {
  "fixture-state": `export const state = {
    cookies: new Map(),
    deleted: [],
    rpcs: [],
    revokeAllError: null,
    warnings: [],
  };`,
  "server-only": "",
  react: "export const cache = (fn) => fn",
  "next/headers": `import { state } from "fixture-state";
    export async function cookies() {
      return {
        get(name) { return state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined },
        set(name, value) { state.cookies.set(name, value) },
        delete(name) { state.deleted.push(name); state.cookies.delete(name) },
      }
    }
    export async function headers() { return new Headers() }`,
  "@/lib/customer/phone-pii":
    "export function customerPhoneHmac() { return 'h' }",
  "@/lib/security/customer-session-secret": `export function requiredCustomerSessionSecret() { return ${JSON.stringify(SECRET)} }`,
  "@/lib/security/rate-limit":
    "export function customerDeviceHashFromHeaders() { return 'a'.repeat(64) }",
  "@/lib/observability/logger": `import { state } from "fixture-state";
    export const logger = { warn(message, context) { state.warnings.push([message, context]) }, error() {}, info() {} }`,
  "@/lib/supabase/server": `import { state } from "fixture-state";
    export function createSupabaseServiceRoleClient() {
      return {
        async rpc(name, args) {
          state.rpcs.push([name, args]);
          if (name === "touch_customer_session_and_load") {
            return { data: [{ status: "active", id: args.p_customer_id }], error: null }
          }
          if (name === "revoke_all_customer_sessions") {
            return state.revokeAllError ? { data: null, error: state.revokeAllError } : { data: 2, error: null }
          }
          if (name === "revoke_customer_session") return { data: true, error: null }
          if (name === "register_customer_session") return { data: null, error: null }
          throw new Error("unexpected rpc " + name)
        },
      }
    }`,
}

async function loadSession() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents: `export * from "./lib/customer/session.ts"; export { state } from "fixture-state"; export { createCustomerSessionCookieValue } from "@/lib/customer/session-cookie-core";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "session-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\// }, ({ path: specifier }) =>
            REAL.has(specifier)
              ? { path: path.join(root, `${specifier.slice(2)}.ts`) }
              : { path: specifier, namespace: "fixture" }
          )
          build.onResolve(
            { filter: /^(fixture-state|server-only|react|next\/headers)$/ },
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
  const mod = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
  const now = Math.floor(Date.now() / 1000)
  mod.state.cookies.set(
    mod.customerSessionCookieName,
    mod.createCustomerSessionCookieValue(
      {
        version: 2,
        sessionId: SESSION_ID,
        customerId: CUSTOMER_ID,
        issuedAt: now - 60,
        expiresAt: now + 365 * 24 * 60 * 60,
      },
      SECRET
    )
  )
  return mod
}

const FALLBACK_COOKIE = "nabaperks_email_fallback"
const SIGNED_OUT_EMAIL_COOKIES = [
  "nabaperks_pending_email_sign_in",
  "nabaperks_email_handoff",
  FALLBACK_COOKIE,
]

function withSignedOutEmailCookies(state) {
  for (const name of SIGNED_OUT_EMAIL_COOKIES) state.cookies.set(name, "x")
}

test("Given the email fallback was opened When the customer signs in Then no signed-out email cookie survives, the fallback record included", async () => {
  const { setCustomerSession, state, customerSessionCookieName } =
    await loadSession()
  withSignedOutEmailCookies(state)

  await setCustomerSession(CUSTOMER_ID, "verified_email")

  assert.equal(state.cookies.has(customerSessionCookieName), true)
  for (const name of SIGNED_OUT_EMAIL_COOKIES) {
    assert.equal(state.cookies.has(name), false, `${name} is cleared`)
  }
})

test("Given the email fallback was opened When the customer logs out Then the next person on the browser does not inherit it", async () => {
  const { clearCustomerSession, state, customerSessionCookieName } =
    await loadSession()
  withSignedOutEmailCookies(state)

  await clearCustomerSession()

  assert.equal(state.cookies.has(customerSessionCookieName), false)
  for (const name of SIGNED_OUT_EMAIL_COOKIES) {
    assert.equal(state.cookies.has(name), false, `${name} is cleared`)
  }
})

test("Given the email fallback was opened When the customer logs out on all devices Then it is cleared too", async () => {
  const { clearAllCustomerSessions, state } = await loadSession()
  withSignedOutEmailCookies(state)

  assert.equal(await clearAllCustomerSessions(), "all_devices")

  for (const name of SIGNED_OUT_EMAIL_COOKIES) {
    assert.equal(state.cookies.has(name), false, `${name} is cleared`)
  }
})
