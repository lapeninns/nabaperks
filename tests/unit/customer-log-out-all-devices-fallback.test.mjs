import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * "Log out on all devices" when the app runs ahead of its migration
 * (QA BUG-012, 38c42a1..2c45031).
 *
 * The real `lib/customer/session.ts` runs with the cookie store, request
 * headers and the Supabase service client stubbed. The session cookie codec,
 * the cookie options and the missing-RPC classifier are the real ones, so the
 * test proves what the customer's browser and the session rows end up with.
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

const rpcNames = (state) => state.rpcs.map(([name]) => name)

test("Given the revoke-all RPC is deployed When the customer logs out on all devices Then every session is revoked and this browser is signed out", async () => {
  const { clearAllCustomerSessions, state, customerSessionCookieName } =
    await loadSession()

  const outcome = await clearAllCustomerSessions()

  assert.equal(outcome, "all_devices")
  assert.deepEqual(state.rpcs.at(-1), [
    "revoke_all_customer_sessions",
    { p_customer_id: CUSTOMER_ID },
  ])
  assert.ok(!rpcNames(state).includes("revoke_customer_session"))
  assert.ok(state.deleted.includes(customerSessionCookieName))
  assert.equal(state.cookies.has(customerSessionCookieName), false)
})

test("Given the app runs ahead of the revoke-all migration When the customer logs out on all devices Then this device's session is still revoked and its cookie cleared, without an error", async () => {
  const { clearAllCustomerSessions, state, customerSessionCookieName } =
    await loadSession()
  state.revokeAllError = {
    code: "PGRST202",
    message:
      "Could not find the function public.revoke_all_customer_sessions(p_customer_id) in the schema cache",
  }

  const outcome = await clearAllCustomerSessions()

  assert.equal(outcome, "this_device")
  assert.deepEqual(state.rpcs.at(-1), [
    "revoke_customer_session",
    { p_customer_id: CUSTOMER_ID, p_session_id: SESSION_ID },
  ])
  assert.equal(state.cookies.has(customerSessionCookieName), false)
  assert.deepEqual(
    state.warnings.map(([message]) => message),
    ["customer_log_out_all_devices_unavailable"]
  )
})

test("Given any other revoke-all failure When the customer logs out on all devices Then it fails loudly and keeps the session, as before", async () => {
  const { clearAllCustomerSessions, state, customerSessionCookieName } =
    await loadSession()
  state.revokeAllError = { code: "57014", message: "canceling statement" }

  await assert.rejects(
    () => clearAllCustomerSessions(),
    /Unable to revoke customer sessions: canceling statement/
  )
  assert.ok(!rpcNames(state).includes("revoke_customer_session"))
  assert.equal(state.cookies.has(customerSessionCookieName), true)
})
