import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

async function loadProfile() {
  const result = await build({
    stdin: {
      contents: `export * from "./app/home/(authed)/profile/actions.ts";
        export { getCustomerProfile } from "./lib/customer/profile.ts";
        export { state } from "fixture-state";`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "phone-preference-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/lib\/)/ },
            ({ path }) => {
              if (path === "@/lib/customer/profile") return null
              return { path, namespace: "fixture" }
            }
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
            const modules = {
              "fixture-state": `export const state = {
              customer: { id: "signed-in-customer", email: null, createdAt: "2026-09-01" },
              preferences: { phone_messages_enabled: true, preferred_phone_channel: "whatsapp", whatsapp_unavailable_at: null },
              failure: null, calls: [], revalidated: []
            };`,
              "server-only": "",
              "next/cache":
                'import {state} from "fixture-state"; export function revalidatePath(path) {state.revalidated.push(path)}',
              "next/server": "export function after() {}",
              "@/lib/rewards/issue-birthday":
                "export function triggerBirthdayIssuanceForCustomer() {}",
              "@/lib/customer/consent":
                "export function isMarketingChannel() {} export function updateCustomerMarketingConsent() {}",
              "@/lib/customer/identity":
                'import {state} from "fixture-state"; export async function getCurrentCustomer() {return state.customer}',
              "@/lib/customer/email-pii-core":
                "export function customerEmailHmac() {} export function normalizeEmail(value) {return value}",
              "@/lib/customer/profile-completion":
                "export function profileCompletionFrom(customer) {return customer}",
              "@/lib/customer/reward-invites":
                "export function attachRewardInvitesForCustomer() {}",
              "@/lib/customer/email-audit":
                "export async function recordCustomerEmailAudit() {}",
              "@/lib/customer/profile-fields":
                "export function isEmailAddress() {} export function validateProfileFields() {}",
              "@/lib/customer/contact-event-core":
                'export function isEmailPromptSurface(value) {return value === "home_prompt" || value === "stamp_prompt"}',
              "@/lib/customer/contact-events":
                "export function recordCustomerContactEvent() {}",
              "@/lib/customer/email-confirmation":
                "export function confirmCustomerEmailCode() {} export function emailConfirmationErrors() {return null}",
              "@/lib/customer/session":
                "export function clearPendingEmailVerification() {}",
              "@/lib/security/rate-limit":
                "export class RateLimitError extends Error {}",
              "@/lib/customer/email-verification":
                "export function checkCustomerEmailVerification() {} export function startCustomerEmailVerification() {}",
              "@/lib/supabase/server": `import {state} from "fixture-state";
              export function createSupabaseServiceRoleClient() { return {
                from() { return { select() { return { eq() { return {
                  count: 1, error: null, order() { return {data: [], error: null} }
                } } } } } },
                async rpc(name, args) {
                  state.calls.push({name, args});
                  if(state.failure === "transport") throw new Error("private provider detail");
                  if(state.failure) return {data: null, error: {message: "private database detail"}};
                  if(name === "update_customer_phone_messaging_preferences") {
                    state.preferences = {...state.preferences,
                      phone_messages_enabled: args.p_phone_messages_enabled,
                      preferred_phone_channel: args.p_preferred_phone_channel};
                  }
                  return {data: [state.preferences], error: null};
                }
              } }`,
            }
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

function preferenceForm(channel, enabled = true) {
  const form = new FormData()
  form.set("customerId", "forged-customer")
  form.set("preferredPhoneChannel", channel)
  if (enabled) form.set("phoneMessagesEnabled", "on")
  return form
}

test("phone preference save derives the customer from the session and readback retains SMS", async () => {
  const fixture = await loadProfile()
  assert.equal(typeof fixture.updateHomePhoneMessagingAction, "function")
  const result = await fixture.updateHomePhoneMessagingAction(
    {},
    preferenceForm("sms")
  )
  assert.equal(result.error, undefined)
  assert.deepEqual(fixture.state.calls, [
    {
      name: "update_customer_phone_messaging_preferences",
      args: {
        p_customer_id: "signed-in-customer",
        p_phone_messages_enabled: true,
        p_preferred_phone_channel: "sms",
      },
    },
  ])
  assert.deepEqual(fixture.state.revalidated, ["/home/profile"])
  const profile = await fixture.getCustomerProfile()
  assert.deepEqual(profile.phoneMessagingPreferences, {
    phoneMessagesEnabled: true,
    preferredPhoneChannel: "sms",
    whatsappUnavailableAt: null,
  })
})

test("phone preference save rejects an unsigned customer without an RPC", async () => {
  const fixture = await loadProfile()
  fixture.state.customer = null
  const result = await fixture.updateHomePhoneMessagingAction(
    {},
    preferenceForm("sms")
  )
  assert.ok(result.error)
  assert.deepEqual(fixture.state.calls, [])
})

for (const channel of ["email", "", "push"]) {
  test(`phone preference save rejects unsupported channel ${JSON.stringify(channel)}`, async () => {
    const fixture = await loadProfile()
    const result = await fixture.updateHomePhoneMessagingAction(
      {},
      preferenceForm(channel)
    )
    assert.ok(result.error)
    assert.deepEqual(fixture.state.calls, [])
  })
}

test("phone preference save preserves the chosen channel when messages are switched off", async () => {
  const fixture = await loadProfile()
  const result = await fixture.updateHomePhoneMessagingAction(
    {},
    preferenceForm("whatsapp", false)
  )
  assert.equal(result.error, undefined)
  assert.equal(fixture.state.calls[0].args.p_phone_messages_enabled, false)
  assert.equal(
    fixture.state.calls[0].args.p_preferred_phone_channel,
    "whatsapp"
  )
})

for (const failure of ["database", "transport"]) {
  test(`phone preference save exposes no success or private detail after ${failure} failure`, async () => {
    const fixture = await loadProfile()
    fixture.state.failure = failure
    const result = await fixture.updateHomePhoneMessagingAction(
      {},
      preferenceForm("sms")
    )
    assert.ok(result.error)
    assert.equal(result.message, undefined)
    assert.doesNotMatch(result.error, /private/)
    assert.deepEqual(fixture.state.revalidated, [])
  })
}

test("profile readback includes WhatsApp unavailability without changing the preferred channel", async () => {
  const fixture = await loadProfile()
  fixture.state.preferences.whatsapp_unavailable_at = "2026-09-19T11:00:00Z"
  const profile = await fixture.getCustomerProfile()
  assert.deepEqual(profile.phoneMessagingPreferences, {
    phoneMessagesEnabled: true,
    preferredPhoneChannel: "whatsapp",
    whatsappUnavailableAt: "2026-09-19T11:00:00Z",
  })
  assert.deepEqual(fixture.state.calls, [
    {
      name: "get_notification_preferences_for_customer",
      args: { p_customer_id: "signed-in-customer" },
    },
  ])
})

test("profile keeps unknown phone preferences unavailable instead of inventing enabled defaults", async () => {
  const fixture = await loadProfile()
  fixture.state.preferences = {}
  const profile = await fixture.getCustomerProfile()
  assert.equal(profile.phoneMessagingPreferences, null)
})

test("phone preference save rejects a malformed toggle without a write", async () => {
  const fixture = await loadProfile()
  const form = preferenceForm("sms")
  form.set("phoneMessagesEnabled", "false")
  const result = await fixture.updateHomePhoneMessagingAction({}, form)
  assert.ok(result.error)
  assert.deepEqual(fixture.state.calls, [])
})

test("profile keeps phone preferences unavailable after a database read failure", async () => {
  const fixture = await loadProfile()
  fixture.state.failure = "database"
  const profile = await fixture.getCustomerProfile()
  assert.equal(profile.phoneMessagingPreferences, null)
  assert.equal(profile.membershipCount, 1)
})
