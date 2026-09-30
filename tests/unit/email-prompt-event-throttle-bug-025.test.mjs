import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-025 (38c42a1..2c45031): `recordEmailPromptEvent` is a server action a
 * browser can call directly. It wrote one `product_events` row (and one
 * PostHog capture) per call, so replaying the captured POST 50 times added 51
 * rows. The real action and the real contact-event helpers run here; the
 * session, the rate-limit RPC, the event sink and the UK date are stubs.
 */
async function loadAction() {
  const modules = {
    "fixture-state": `export const state = {
      customer: { id: "11111111-1111-4111-8111-111111111111" },
      today: "2026-09-30", events: [], warnings: [], buckets: new Map(), limits: [],
    };`,
    "server-only": "",
    "next/server": "export function after(task) { task() }",
    "next/headers": "export async function headers() { return new Headers() }",
    "@/lib/customer/identity":
      'import { state } from "fixture-state"; export async function getCurrentCustomer() { return state.customer }',
    "@/lib/analytics/events":
      'import { state } from "fixture-state"; export async function recordProductEvent(event) { state.events.push(event) }',
    "@/lib/observability/logger":
      'import { state } from "fixture-state"; export const logger = { warn(name, detail) { state.warnings.push(name) } }',
    "@/lib/customer/uk-calendar":
      'import { state } from "fixture-state"; export function ukTodayIso() { return state.today }',
    "@/lib/security/rate-limit": `import { state } from "fixture-state";
      export class RateLimitError extends Error {}
      export async function enforceRateLimit({ key, limit, windowMs }) {
        state.limits.push({ key, limit, windowMs })
        const used = (state.buckets.get(key) ?? 0) + 1
        state.buckets.set(key, used)
        if (used > limit) throw new RateLimitError()
      }`,
  }
  const passthrough = new Set([
    "@/lib/customer/contact-event-core",
    "@/lib/customer/contact-events",
    "@/lib/analytics/after-response",
    "@/lib/security/rate-limit-core",
    "@/lib/observability/request-id",
  ])
  const result = await build({
    stdin: {
      contents:
        'export { recordEmailPromptEvent } from "./lib/customer/email-prompt-events.ts"; export { state } from "fixture-state";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "email-prompt-event-boundaries",
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
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

test("Given one customer replays the prompt view 50 times When each call is recorded Then at most five reach product events, all under one event id", async () => {
  const { state, recordEmailPromptEvent } = await loadAction()

  for (let i = 0; i < 50; i += 1) {
    await recordEmailPromptEvent("customer_email_prompt_viewed", "home_prompt")
  }

  assert.ok(state.events.length >= 1, "the genuine view is recorded")
  assert.ok(
    state.events.length <= 5,
    `expected at most 5 recorded events, got ${state.events.length}`
  )
  const ids = new Set(state.events.map((event) => event.eventId))
  assert.equal(ids.size, 1, "repeats share one idempotency key")
  assert.match([...ids][0] ?? "", UUID)
  for (const event of state.events) {
    assert.equal(event.customerId, state.customer.id)
    assert.deepEqual(event.metadata, {
      method: "email",
      surface: "home_prompt",
    })
  }
  assert.ok(
    state.limits.every(
      ({ key, windowMs }) => key.includes(state.customer.id) && windowMs > 0
    ),
    "the bucket is keyed to the session customer"
  )
})

test("Given the prompt limit is reached When the browser calls again Then the refusal stays silent and nothing is logged as a failure", async () => {
  const { state, recordEmailPromptEvent } = await loadAction()
  for (let i = 0; i < 20; i += 1) {
    const result = await recordEmailPromptEvent(
      "customer_email_prompt_dismissed",
      "stamp_prompt"
    )
    assert.equal(result, undefined)
  }
  assert.ok(state.events.length <= 5)
  assert.deepEqual(state.warnings, [])
})

test("Given different customers, events, surfaces and UK days When recorded Then each gets its own event id", async () => {
  const { state, recordEmailPromptEvent } = await loadAction()
  await recordEmailPromptEvent("customer_email_prompt_viewed", "home_prompt")
  await recordEmailPromptEvent("customer_email_prompt_dismissed", "home_prompt")
  await recordEmailPromptEvent("customer_email_prompt_viewed", "stamp_prompt")
  state.today = "2026-10-01"
  await recordEmailPromptEvent("customer_email_prompt_viewed", "home_prompt")
  state.customer = { id: "22222222-2222-4222-8222-222222222222" }
  await recordEmailPromptEvent("customer_email_prompt_viewed", "home_prompt")

  const ids = state.events.map((event) => event.eventId)
  assert.equal(ids.length, 5)
  assert.equal(new Set(ids).size, 5)
  for (const id of ids) assert.match(id ?? "", UUID)
})

test("Given no session or an unknown event When the action is called Then no bucket is spent and nothing is recorded", async () => {
  const { state, recordEmailPromptEvent } = await loadAction()
  await recordEmailPromptEvent("customer_login_verified", "home_prompt")
  await recordEmailPromptEvent("customer_email_prompt_viewed", "profile")
  state.customer = null
  await recordEmailPromptEvent("customer_email_prompt_viewed", "home_prompt")
  assert.deepEqual(state.events, [])
  assert.deepEqual(state.limits, [])
})
