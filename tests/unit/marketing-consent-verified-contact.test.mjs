import assert from "node:assert/strict"
import { resolve } from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-033, BUG-034 and BUG-035 (38c42a1..2c45031), at the server boundary.
 * The real profile action and the real consent module run against a stubbed
 * Supabase client. record_customer_marketing_consent accepts any channel and
 * writes one row per membership, so:
 *  - text and WhatsApp opt-in need a verified phone: a staged phone (hash and
 *    last four digits, no phone_verified_at) counts as none (BUG-033);
 *  - email opt-in needs a verified email (BUG-034);
 *  - a wallet with no venue membership has nowhere to record the choice, and
 *    the toggle must not say Saved (BUG-035).
 */

const REAL = {
  "@/lib/customer/consent": "lib/customer/consent.ts",
  "@/lib/customer/experience/marketing-consent-row":
    "lib/customer/experience/marketing-consent-row.ts",
  "@/lib/customer/phone-verification-state":
    "lib/customer/phone-verification-state.ts",
}

const FIXTURE = `export const state = {
  customer: null,
  row: null,
  memberships: 1,
  rpcs: [],
  revalidated: [],
};`

const SUPABASE = `import {state} from "fixture-state";
function query(table) {
  const result = table === "customers"
    ? { data: state.row, error: null }
    : { count: state.memberships, error: null }
  const builder = {
    select() { return builder },
    eq() { return builder },
    maybeSingle() { return Promise.resolve(result) },
    then(onFulfilled, onRejected) { return Promise.resolve(result).then(onFulfilled, onRejected) },
  }
  return builder
}
export function createSupabaseServiceRoleClient() {
  return {
    from: query,
    rpc(name, args) { state.rpcs.push([name, args]); return Promise.resolve({ error: null }) },
  }
}`

const MOCKS = {
  "fixture-state": FIXTURE,
  "server-only": "",
  react: "export function cache(fn) { return fn }",
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
  "@/lib/supabase/server": SUPABASE,
  "@/lib/customer/identity":
    'import {state} from "fixture-state"; export async function getCurrentCustomer() {return state.customer}',
  "@/lib/legal/content": 'export const CUSTOMER_LEGAL_VERSION = "2026-09-28.1"',
  "@/lib/rewards/issue-birthday":
    "export function triggerBirthdayIssuanceForCustomer() {}",
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
  "@/lib/customer/email-verification":
    "export function startCustomerEmailVerification() {}",
}

async function loadProfileAction() {
  const result = await build({
    stdin: {
      contents:
        'export { updateHomeMarketingConsentAction } from "./app/home/(authed)/profile/actions.ts"; export { state } from "fixture-state";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "consent-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|react|next\/|@\/lib\/)/ },
            ({ path }) =>
              path in REAL
                ? { path: resolve(REAL[path]) }
                : { path, namespace: "fixture" }
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
            assert.ok(path in MOCKS, `Unrecognised boundary: ${path}`)
            return { contents: MOCKS[path] }
          })
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

function toggle(channel, optedIn) {
  const data = new FormData()
  data.set("channel", channel)
  if (optedIn) data.set("optedIn", "on")
  return data
}

function wallet(state, { email = null, emailVerified = false, phone = null }) {
  state.customer = {
    id: "customer-1",
    email,
    emailVerifiedAt: emailVerified ? "2026-09-29T10:00:00Z" : null,
    phoneLast4: phone === null ? null : "0328",
  }
  state.row =
    phone === null
      ? { phone_hmac: null, phone_verified_at: null }
      : {
          phone_hmac: "a".repeat(64),
          phone_verified_at:
            phone === "verified" ? "2026-09-29T10:00:00Z" : null,
        }
}

const recorded = (state) =>
  state.rpcs.map(([name, args]) => [
    name,
    args.p_channel,
    args.p_consent_status,
  ])

test("Given a staged, unverified phone When the wallet opts in to text or WhatsApp Then nothing is recorded and the toggle does not claim it was saved", async () => {
  const { updateHomeMarketingConsentAction: update, state } =
    await loadProfileAction()
  // A staged phone, and an email-only wallet with no phone at all.
  for (const phone of ["staged", null]) {
    wallet(state, {
      email: "guest@example.test",
      emailVerified: true,
      phone,
    })
    for (const channel of ["sms", "whatsapp"]) {
      const result = await update({}, toggle(channel, true))
      assert.equal(result.channel, channel)
      assert.equal(result.optedIn, false)
      assert.equal(result.refusal, "needs_verified_phone")
    }
  }
  assert.deepEqual(state.rpcs, [])
  assert.deepEqual(state.revalidated, [])

  // Email is verified, so it is recorded.
  assert.deepEqual(await update({}, toggle("email", true)), {
    channel: "email",
    optedIn: true,
  })
  assert.deepEqual(recorded(state), [
    ["record_customer_marketing_consent", "email", "opted_in"],
  ])
})

test("Given a phone wallet with no email or an unconfirmed email When it opts in to email Then nothing is recorded", async () => {
  const { updateHomeMarketingConsentAction: update, state } =
    await loadProfileAction()

  for (const email of [null, "unconfirmed@example.test"]) {
    wallet(state, { email, emailVerified: false, phone: "verified" })
    const result = await update({}, toggle("email", true))
    assert.equal(result.optedIn, false)
    assert.equal(result.refusal, "needs_verified_email")
  }
  assert.deepEqual(state.rpcs, [])

  // Its verified phone channels, and opting out of email, still record.
  assert.deepEqual(await update({}, toggle("sms", true)), {
    channel: "sms",
    optedIn: true,
  })
  assert.deepEqual(await update({}, toggle("email", false)), {
    channel: "email",
    optedIn: false,
  })
  assert.deepEqual(recorded(state), [
    ["record_customer_marketing_consent", "sms", "opted_in"],
    ["record_customer_marketing_consent", "email", "opted_out"],
  ])
})

test("Given a wallet with no venue memberships When it changes a marketing toggle Then it is told to join a venue and nothing is recorded", async () => {
  const { updateHomeMarketingConsentAction: update, state } =
    await loadProfileAction()
  wallet(state, {
    email: "guest@example.test",
    emailVerified: true,
    phone: "verified",
  })
  state.memberships = 0

  for (const [channel, optedIn] of [
    ["sms", true],
    ["email", true],
    ["whatsapp", false],
  ]) {
    const result = await update({}, toggle(channel, optedIn))
    assert.equal(result.refusal, "no_memberships", channel)
    assert.equal(result.optedIn, !optedIn, channel)
  }
  assert.deepEqual(state.rpcs, [])
  assert.deepEqual(state.revalidated, [])
})

test("Given verified contacts and a membership When the wallet opts in Then every channel is recorded", async () => {
  const { updateHomeMarketingConsentAction: update, state } =
    await loadProfileAction()
  wallet(state, {
    email: "guest@example.test",
    emailVerified: true,
    phone: "verified",
  })

  for (const channel of ["email", "sms", "whatsapp"]) {
    assert.deepEqual(await update({}, toggle(channel, true)), {
      channel,
      optedIn: true,
    })
  }
  assert.deepEqual(recorded(state), [
    ["record_customer_marketing_consent", "email", "opted_in"],
    ["record_customer_marketing_consent", "sms", "opted_in"],
    ["record_customer_marketing_consent", "whatsapp", "opted_in"],
  ])
  assert.deepEqual(state.revalidated, [
    "/home/profile",
    "/home/profile",
    "/home/profile",
  ])
})

test("Given the wallet's contacts and venues When the profile lists marketing toggles Then it offers only the channels the server accepts", async () => {
  const { marketingConsentChannels } =
    await import("@/lib/customer/experience/marketing-consent-row")
  const offered = (input) => marketingConsentChannels(input)

  assert.deepEqual(
    offered({
      hasVerifiedPhone: true,
      hasVerifiedEmail: true,
      membershipCount: 2,
    }),
    { channels: ["email", "sms", "whatsapp"], notice: null }
  )
  // A phone wallet with no email, or one it has not confirmed.
  assert.deepEqual(
    offered({
      hasVerifiedPhone: true,
      hasVerifiedEmail: false,
      membershipCount: 1,
    }),
    { channels: ["sms", "whatsapp"], notice: null }
  )
  // A staged phone counts as none.
  assert.deepEqual(
    offered({
      hasVerifiedPhone: false,
      hasVerifiedEmail: true,
      membershipCount: 1,
    }),
    { channels: ["email"], notice: null }
  )
  // No venue yet: explain instead of offering toggles that store nothing.
  const noVenue = offered({
    hasVerifiedPhone: true,
    hasVerifiedEmail: true,
    membershipCount: 0,
  })
  assert.deepEqual(noVenue.channels, [])
  assert.match(noVenue.notice, /^Join a venue first\./)
  assert.doesNotMatch(noVenue.notice, /!/)
})

test("Given a refused change When the row renders the result Then it explains why instead of saying Saved", async () => {
  const { marketingConsentRowState, MARKETING_CONSENT_REFUSAL_NOTICE } =
    await import("@/lib/customer/experience/marketing-consent-row")

  for (const refusal of [
    "needs_verified_phone",
    "needs_verified_email",
    "no_memberships",
  ]) {
    const view = marketingConsentRowState({
      channel: "sms",
      optedIn: false,
      pending: false,
      state: { channel: "sms", optedIn: false, refusal },
    })
    assert.equal(view.checked, false)
    assert.equal(view.message, MARKETING_CONSENT_REFUSAL_NOTICE[refusal])
    assert.notEqual(view.message, "Saved")
  }
  assert.deepEqual(
    marketingConsentRowState({
      channel: "sms",
      optedIn: true,
      pending: false,
      state: { channel: "sms", optedIn: true },
    }),
    { checked: true, message: "Saved" }
  )
})
