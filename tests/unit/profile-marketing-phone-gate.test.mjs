import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * Text and WhatsApp marketing need a phone. The refusals for a wallet with no
 * verified phone, no verified email or no venue are proved against the real
 * consent module in marketing-consent-verified-contact.test.mjs (QA BUG-033,
 * BUG-034, BUG-035); this file keeps the action's pass-through for a wallet
 * whose change is recorded.
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
    "next/navigation": "export function redirect() {}",
    "@/lib/customer/contact-notice-flash":
      "export async function setContactNoticeFlash() { return '/home/profile' }",
    "@/lib/customer/previous-stamps":
      "export const PREVIOUS_STAMPS_RETURN_TO = '/home/profile#previous-stamps'; export function walletLinkedMessage() { return 'Your stamps are together now.' } export function walletLinkFailureCopy() { return '' }",
    "@/lib/customer/email-auth-mode":
      "export function emailSignInEnabled() { return false } export function emailPromptReason() { return 'rewards' }",
    "@/lib/rewards/issue-birthday":
      "export function triggerBirthdayIssuanceForCustomer() {}",
    "@/lib/customer/consent": `import {state} from "fixture-state";
      export const PHONE_MARKETING_CHANNELS = new Set(["sms", "whatsapp"])
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

function toggle(channel, optedIn) {
  const data = new FormData()
  data.set("channel", channel)
  if (optedIn) data.set("optedIn", "on")
  return data
}

test("Given a wallet with a phone When it opts in to text offers Then the choice is recorded", async () => {
  const { updateHomeMarketingConsentAction: update, state } = await loadAction()
  state.customer = { id: "customer-1", phoneLast4: "0123" }

  assert.deepEqual(await update({}, toggle("whatsapp", true)), {
    channel: "whatsapp",
    optedIn: true,
  })
  assert.deepEqual(state.recorded, [{ channel: "whatsapp", optedIn: true }])
})
