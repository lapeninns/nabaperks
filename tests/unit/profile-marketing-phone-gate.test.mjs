import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * Text and WhatsApp marketing need a phone. record_customer_marketing_consent
 * accepts any channel, so a wallet started with an email (no phone) must be
 * refused an sms or whatsapp opt-in by the profile action and by the consent
 * module itself. Opting out, and email, always work.
 */
const FIXTURE = `export const state = {
  customer: { id: "customer-1", phoneLast4: null },
  recorded: [],
  rpcs: [],
  revalidated: [],
};`

async function bundle(entry, modules) {
  const result = await build({
    stdin: {
      contents: `export * from "${entry}"; export { state } from "fixture-state";`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "marketing-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/lib\/)/ },
            ({ path }) => ({ path, namespace: "fixture" })
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

function loadAction() {
  return bundle("./app/home/(authed)/profile/actions.ts", {
    "fixture-state": FIXTURE,
    "next/cache":
      'import {state} from "fixture-state"; export function revalidatePath(path) {state.revalidated.push(path)}',
    "next/server": "export function after() {}",
    "@/lib/rewards/issue-birthday":
      "export function triggerBirthdayIssuanceForCustomer() {}",
    "@/lib/customer/consent": `import {state} from "fixture-state";
      export function isMarketingChannel(value) { return ["email", "sms", "whatsapp", "push"].includes(value) }
      export async function updateCustomerMarketingConsent(input) { state.recorded.push(input) }`,
    "@/lib/customer/identity":
      'import {state} from "fixture-state"; export async function getCurrentCustomer() {return state.customer}',
    "@/lib/customer/profile":
      "export function clearCustomerEmail() {} export function setCustomerEmailForVerification() {} export function updateCustomerProfile() {}",
    "@/lib/customer/profile-fields":
      "export function isEmailAddress() {} export function validateProfileFields() {}",
    "@/lib/customer/contact-event-core":
      "export function isEmailPromptSurface() { return false }",
    "@/lib/customer/contact-events":
      "export function recordCustomerContactEvent() {}",
    "@/lib/customer/email-confirmation":
      "export function confirmCustomerEmailCode() {} export function emailConfirmationErrors() {return null}",
    "@/lib/customer/session":
      "export function clearPendingEmailVerification() {}",
    "@/lib/security/rate-limit": "export class RateLimitError extends Error {}",
    "@/lib/supabase/server":
      "export function createSupabaseServiceRoleClient() {}",
    "@/lib/customer/email-verification":
      "export function startCustomerEmailVerification() {}",
  })
}

function loadConsent() {
  return bundle("./lib/customer/consent.ts", {
    "fixture-state": FIXTURE,
    "server-only": "",
    "@/lib/customer/identity":
      'import {state} from "fixture-state"; export async function getCurrentCustomer() {return state.customer}',
    "@/lib/legal/content": 'export const CUSTOMER_LEGAL_VERSION = "test-v1"',
    "@/lib/supabase/server": `import {state} from "fixture-state";
      export function createSupabaseServiceRoleClient() {
        return { rpc(name, args) { state.rpcs.push([name, args]); return Promise.resolve({ error: null }) } }
      }`,
  })
}

function toggle(channel, optedIn) {
  const data = new FormData()
  data.set("channel", channel)
  if (optedIn) data.set("optedIn", "on")
  return data
}

test("Given a wallet with no phone When it opts in to text or WhatsApp offers Then the profile action refuses and records nothing", async () => {
  const { updateHomeMarketingConsentAction: update, state } = await loadAction()

  for (const channel of ["sms", "whatsapp"]) {
    assert.deepEqual(await update({}, toggle(channel, true)), {
      channel,
      optedIn: false,
      error: "Add a phone number first to get offers by text or WhatsApp.",
    })
  }
  assert.deepEqual(state.recorded, [])
  assert.deepEqual(state.revalidated, [])

  // Email, and opting out of anything, still work.
  assert.deepEqual(await update({}, toggle("email", true)), {
    channel: "email",
    optedIn: true,
  })
  assert.deepEqual(await update({}, toggle("sms", false)), {
    channel: "sms",
    optedIn: false,
  })
  assert.deepEqual(state.recorded, [
    { channel: "email", optedIn: true },
    { channel: "sms", optedIn: false },
  ])
})

test("Given a wallet with a phone When it opts in to text offers Then the choice is recorded", async () => {
  const { updateHomeMarketingConsentAction: update, state } = await loadAction()
  state.customer = { id: "customer-1", phoneLast4: "0123" }

  assert.deepEqual(await update({}, toggle("whatsapp", true)), {
    channel: "whatsapp",
    optedIn: true,
  })
  assert.deepEqual(state.recorded, [{ channel: "whatsapp", optedIn: true }])
})

test("Given the consent module When a phoneless wallet opts in to a phone channel Then it never reaches the RPC", async () => {
  const { updateCustomerMarketingConsent, state } = await loadConsent()

  for (const channel of ["sms", "whatsapp"]) {
    await assert.rejects(
      updateCustomerMarketingConsent({ channel, optedIn: true }),
      /needs a phone number/
    )
  }
  assert.deepEqual(state.rpcs, [])

  await updateCustomerMarketingConsent({ channel: "sms", optedIn: false })
  await updateCustomerMarketingConsent({ channel: "email", optedIn: true })
  state.customer = { id: "customer-1", phoneLast4: "0123" }
  await updateCustomerMarketingConsent({ channel: "sms", optedIn: true })
  assert.deepEqual(
    state.rpcs.map(([name, args]) => [
      name,
      args.p_channel,
      args.p_consent_status,
    ]),
    [
      ["record_customer_marketing_consent", "sms", "opted_out"],
      ["record_customer_marketing_consent", "email", "opted_in"],
      ["record_customer_marketing_consent", "sms", "opted_in"],
    ]
  )
})
