import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { test } from "node:test"
import { build } from "esbuild"

import { pseudonymizeAnalyticsId } from "../../lib/analytics/privacy-core.ts"

/**
 * QA BUG-027 (38c42a1..2c45031): every anonymous `customer_login_*` event fell
 * through to the `system` identity keyed by its own event name, so PostHog saw
 * one "visitor" per event name across all sign-in attempts, and no event had
 * an `$insert_id`. The real recorder, product event writer and PostHog payload
 * builder run here; the request headers the proxy forwards, `after()`, the
 * Supabase client and the network are stubs.
 */
async function loadRecorder() {
  const modules = {
    "fixture-state": `export const state = { headers: new Headers(), headersThrow: false, rows: [], captures: [], pending: [] };`,
    "server-only": "",
    "next/headers": `import { state } from "fixture-state";
      export async function headers() { if (state.headersThrow) throw new Error("outside a request"); return state.headers }`,
    "next/server": `import { state } from "fixture-state";
      export function after(task) { state.pending.push(Promise.resolve().then(task)) }`,
    "@/lib/supabase/server": `import { state } from "fixture-state";
      const write = async (row) => { state.rows.push(row); return { error: null } };
      export function createSupabaseServiceRoleClient() {
        return { from: () => ({ insert: write, upsert: write }) }
      }`,
    "@/lib/observability/logger": "export const logger = { warn() {} }",
  }
  const passthrough = new Set([
    "@/lib/analytics/events",
    "@/lib/analytics/privacy-core",
    "@/lib/customer/contact-event-core",
    "@/lib/analytics/after-response",
    "@/lib/observability/request-id",
    "@/lib/security/rate-limit-core",
  ])
  const result = await build({
    stdin: {
      contents:
        'export { recordCustomerContactEvent } from "./lib/customer/contact-events.ts"; export { state } from "fixture-state";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "contact-event-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/lib\/)/ },
            ({ path }) => {
              if (passthrough.has(path)) {
                return { path: `${process.cwd()}/${path.slice(2)}.ts` }
              }
              return { path, namespace: "fixture" }
            }
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
            assert.ok(path in modules, `Unrecognised boundary: ${path}`)
            return { contents: modules[path] }
          })
        },
      },
    ],
  })
  const loaded = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
  const record = async (event, headers) => {
    loaded.state.headers = new Headers(headers)
    loaded.recordCustomerContactEvent(event)
    await Promise.all(loaded.state.pending)
    await new Promise((resolve) => setImmediate(resolve))
    return {
      row: loaded.state.rows.at(-1),
      capture: loaded.state.captures.at(-1),
    }
  }
  return { ...loaded, record }
}

// Pseudonymous PostHog mirroring on, with the network intercepted.
process.env.ANALYTICS_EXTERNAL_PROCESSING_MODE = "pseudonymous"
process.env.POSTHOG_HOST = "https://eu.i.posthog.com/"
process.env.POSTHOG_PROJECT_KEY = "phc_unittest"
process.env.ANALYTICS_PSEUDONYM_SECRET = randomBytes(32).toString("base64url")
let current = null
globalThis.fetch = async (_url, init) => {
  current?.state.captures.push(JSON.parse(init.body))
  return new Response("{}", { status: 200 })
}
async function load() {
  current = await loadRecorder()
  return current
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const DEVICE = "x-nabaperks-device-id"
const REQUEST = "x-request-id"

const codeRequested = (method) => ({
  eventName: "customer_login_code_requested",
  metadata: { method, surface: "home_login" },
})
const noWallet = {
  eventName: "customer_login_no_wallet",
  metadata: { method: "phone", surface: "home_login" },
}

const pseudonym = (domain, value) =>
  pseudonymizeAnalyticsId(
    domain,
    value,
    process.env.ANALYTICS_PSEUDONYM_SECRET ?? ""
  )

test("Given three visitors sign in on different browsers When their events reach PostHog Then each visitor has its own id and every capture has an insert id", async () => {
  const { record } = await load()
  const captures = []
  for (let visitor = 0; visitor < 3; visitor += 1) {
    const device = crypto.randomUUID()
    for (const event of [codeRequested("phone"), noWallet]) {
      const { capture } = await record(event, {
        [DEVICE]: device,
        [REQUEST]: crypto.randomUUID(),
      })
      captures.push({ visitor, device, capture })
    }
  }

  assert.equal(captures.length, 6)
  const requested = captures.filter(
    ({ capture }) => capture.event === "customer_login_code_requested"
  )
  assert.equal(
    new Set(requested.map(({ capture }) => capture.distinct_id)).size,
    3
  )
  for (let visitor = 0; visitor < 3; visitor += 1) {
    const own = captures.filter((c) => c.visitor === visitor)
    assert.equal(
      new Set(own.map(({ capture }) => capture.distinct_id)).size,
      1,
      "a visitor's code request and no-wallet result share one id"
    )
  }
  for (const { device, capture } of captures) {
    assert.notEqual(capture.distinct_id, pseudonym("system", capture.event))
    assert.notEqual(capture.distinct_id, pseudonym("funnel", device))
    assert.match(capture.properties.$insert_id ?? "", /^ana_v1_/)
    assert.deepEqual(Object.keys(capture.properties).sort(), [
      "$insert_id",
      "$process_person_profile",
      "actor_type",
      "method",
      "surface",
    ])
  }
})

test("Given an anonymous event When it is written Then the row has a stable UUID for its request and only the closed metadata", async () => {
  const { record } = await load()
  const device = crypto.randomUUID()
  const request = crypto.randomUUID()
  const headers = { [DEVICE]: device, [REQUEST]: request }
  const first = await record(codeRequested("email"), headers)
  const repeat = await record(codeRequested("email"), headers)
  const later = await record(codeRequested("email"), {
    [DEVICE]: device,
    [REQUEST]: crypto.randomUUID(),
  })

  assert.match(first.row.id ?? "", UUID)
  assert.equal(repeat.row.id, first.row.id, "a replayed write de-duplicates")
  assert.notEqual(later.row.id, first.row.id, "a new request is a new event")
  assert.equal(later.capture.distinct_id, first.capture.distinct_id)
  assert.deepEqual(first.row.metadata, {
    method: "email",
    surface: "home_login",
  })
  assert.equal(first.row.customer_id, null)
  assert.equal(first.row.actor_id, null)
  assert.ok(!JSON.stringify(first).includes(device))
})

test("Given no verified device or no request scope When an anonymous event is recorded Then it still gets its own identity and an event id", async () => {
  const { state, record } = await load()
  const a = await record(noWallet, { [REQUEST]: crypto.randomUUID() })
  const b = await record(noWallet, { [REQUEST]: crypto.randomUUID() })
  state.headersThrow = true
  const c = await record(noWallet, {})
  for (const event of [a, b, c]) {
    assert.match(event.row.id ?? "", UUID)
    assert.match(event.capture.properties.$insert_id ?? "", /^ana_v1_/)
  }
  assert.equal(
    new Set([a, b, c].map((event) => event.capture.distinct_id)).size,
    3
  )
})

test("Given a customer-keyed event When it is recorded Then it keeps the customer identity and gains an event id", async () => {
  const { record } = await load()
  const customerId = "11111111-1111-4111-8111-111111111111"
  const { row, capture } = await record(
    {
      eventName: "customer_login_verified",
      customerId,
      metadata: { method: "phone", surface: "home_login", email: "x@y.test" },
    },
    { [DEVICE]: crypto.randomUUID(), [REQUEST]: crypto.randomUUID() }
  )
  assert.equal(capture.distinct_id, pseudonym("customer", customerId))
  assert.equal(row.customer_id, customerId)
  assert.match(row.id ?? "", UUID)
  assert.match(capture.properties.$insert_id ?? "", /^ana_v1_/)
  assert.deepEqual(row.metadata, { method: "phone", surface: "home_login" })
})
