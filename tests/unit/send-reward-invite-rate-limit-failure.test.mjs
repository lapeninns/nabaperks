import assert from "node:assert/strict"
import { join } from "node:path"
import { test } from "node:test"

import { build } from "esbuild"

// QA BUG-007 (38c42a1..2c45031): the invite row is written before the
// per-address email fatigue check. When that check failed with anything other
// than RateLimitError, the action threw a 500 and left the invite pending with
// no send attempt. The action must answer with the uniform success copy, mark
// the invite email as failed, and log without the address.

const fixture = `export const state = {
  rateLimit: {},
  afterCallbacks: [],
  updates: [],
  rpcs: [],
};`

const REAL_MODULES = new Set(["@/lib/merchant/send-reward-fields"])

const modules = {
  "fixture-state": fixture,
  "next/server":
    'import {state} from "fixture-state"; export function after(fn) {state.afterCallbacks.push(fn)}',
  "@/lib/auth/session":
    'export async function getCurrentMerchant() {return {id: "merchant-1", business_name: "The Test Arms"}}',
  "@/lib/customer/email-pii-core": `
    export function looksLikeEmail(value) {return value.includes("@")}
    export function customerEmailHmac() {return "email-hmac"}
    export function maskEmail() {return "n***@example.test"}
    export function normalizeEmail(value) {return value.trim().toLowerCase()}`,
  "@/lib/customer/phone":
    "export function normalizePhone() {return {ok: false}}",
  "@/lib/customer/phone-pii-core":
    'export function customerPhoneHmac() {return "phone-hmac"}',
  "@/lib/merchant/reward-invite-suppression":
    "export function shouldSuppressRewardInviteEmail() {return false}",
  "@/lib/notifications/reward-invite-email":
    'export function buildRewardInviteEmail() {return {subject: "s", text: "t", html: "h"}}',
  "@/lib/notifications/invite-unsubscribe-headers":
    "export function inviteUnsubscribeHeaders() {return {}}",
  "@/lib/notifications/resend":
    "export async function sendTransactionalEmail() {}",
  "@/lib/security/rate-limit": `
    import {state} from "fixture-state"
    export class RateLimitError extends Error {}
    export async function enforceRateLimit({key}) {
      const outcome = state.rateLimit[key.split(":")[0]]
      if (outcome === "limited") throw new RateLimitError()
      if (outcome === "broken") throw new Error("Unable to enforce rate limit: value out of range")
    }`,
  "@/lib/supabase/server": `
    import {state} from "fixture-state"
    function query(table) {
      const q = {
        payload: null,
        select() {return q}, not() {return q}, is() {return q}, in() {return q}, limit() {return q},
        update(payload) {q.payload = payload; return q},
        eq(column, value) {
          if (q.payload) {
            state.updates.push({table, payload: q.payload, [column]: value})
            return Promise.resolve({error: null})
          }
          return q
        },
        maybeSingle() {return Promise.resolve({data: null, error: null})},
        then(resolve, reject) {return Promise.resolve({data: [], error: null}).then(resolve, reject)},
      }
      return q
    }
    export async function createSupabaseServerClient() {
      return {async rpc(name) {
        state.rpcs.push(name)
        return {data: [{invite_id: "invite-1", deduped: false}], error: null}
      }}
    }
    export function createSupabaseServiceRoleClient() {
      return {from: query, async rpc(name) {state.rpcs.push(name); return {data: false, error: null}}}
    }`,
}

async function loadAction() {
  const result = await build({
    stdin: {
      contents:
        'export { sendMerchantRewardAction } from "./app/app/customers/send-reward/actions.ts"; export { state } from "fixture-state"; export { SEND_REWARD_SUCCESS } from "@/lib/merchant/send-reward-fields";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "send-reward-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|next\/|@\/lib\/)/ },
            ({ path }) =>
              REAL_MODULES.has(path)
                ? { path: join(process.cwd(), `${path.slice(2)}.ts`) }
                : { path, namespace: "fixture" }
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

function inviteForm(contact) {
  const form = new FormData()
  form.set("contact", contact)
  form.set("rewardName", "Free pudding")
  form.set("rewardTerms", "One pudding with any paid main course.")
  form.set("expiresInDays", "30")
  return form
}

async function captureErrors(fn) {
  const original = console.error
  const logged = []
  console.error = (...args) => logged.push(args)
  try {
    return { result: await fn(), logged }
  } finally {
    console.error = original
  }
}

test("Given the invite email rate-limit check fails When a reward goes to a new email Then the merchant gets the uniform success and the invite is marked failed", async () => {
  const { state, sendMerchantRewardAction, SEND_REWARD_SUCCESS } =
    await loadAction()
  state.rateLimit["invite-email"] = "broken"
  const contact = "new.guest+tag@example.test"

  const { result, logged } = await captureErrors(() =>
    sendMerchantRewardAction({}, inviteForm(contact))
  )

  assert.deepEqual(result, { message: SEND_REWARD_SUCCESS })
  assert.ok(state.rpcs.includes("create_bounded_merchant_reward_invite"))
  assert.deepEqual(state.updates, [
    {
      table: "pending_reward_invites",
      payload: { email_send_status: "failed" },
      id: "invite-1",
    },
  ])
  assert.equal(state.afterCallbacks.length, 0, "no email is scheduled")
  assert.ok(logged.length > 0, "the failure is logged")
  assert.doesNotMatch(JSON.stringify(logged), /new\.guest|example\.test/)
})

test("Given the invite email fatigue cap is reached When a reward goes to a new email Then no email is sent and the invite is left for the join", async () => {
  const { state, sendMerchantRewardAction, SEND_REWARD_SUCCESS } =
    await loadAction()
  state.rateLimit["invite-email"] = "limited"

  const result = await sendMerchantRewardAction(
    {},
    inviteForm("capped@example.test")
  )

  assert.deepEqual(result, { message: SEND_REWARD_SUCCESS })
  assert.deepEqual(state.updates, [])
  assert.equal(state.afterCallbacks.length, 0)
})

test("Given the rate-limit check passes When a reward goes to a new email Then one invite email is scheduled", async () => {
  const { state, sendMerchantRewardAction, SEND_REWARD_SUCCESS } =
    await loadAction()

  const result = await sendMerchantRewardAction(
    {},
    inviteForm("welcome@example.test")
  )

  assert.deepEqual(result, { message: SEND_REWARD_SUCCESS })
  assert.equal(state.afterCallbacks.length, 1)
  await state.afterCallbacks[0]()
  assert.deepEqual(state.updates, [
    {
      table: "pending_reward_invites",
      payload: { email_send_status: "sent" },
      id: "invite-1",
    },
  ])
})
