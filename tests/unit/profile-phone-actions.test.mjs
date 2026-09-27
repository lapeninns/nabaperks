import assert from "node:assert/strict"
import path from "node:path"
import { afterEach, test } from "node:test"
import { build } from "esbuild"

/**
 * Adding a phone to an email-only wallet from the profile, with identity,
 * the pending cookie, admission, Twilio and tracking stubbed. The OTP
 * normaliser and channel choice are the real ones.
 */
const REAL = [
  "@/lib/customer/experience/otp-field",
  "@/lib/customer/otp-channel-core",
]

const STUBS = {
  "fixture-state": `export const state = {
    calls: [],
    events: [],
    revalidated: [],
    customer: { id: "customer-1", phoneLast4: null },
    admitted: true,
    sent: { status: "sent", channel: "sms" },
    pending: null,
    verifyLimited: false,
    check: { status: "approved" },
    attach: { status: "attached", customer: { id: "customer-1", phoneLast4: "0123" } },
  };`,
  "server-only": "",
  "next/cache": `import { state } from "fixture-state";
    export function revalidatePath(path) { state.revalidated.push(path) }`,
  "next/headers": "export async function headers() { return new Headers() }",
  "@/lib/customer/contact-events": `import { state } from "fixture-state";
    export function recordCustomerContactEvent(input) { state.events.push(input) }`,
  "@/lib/customer/identity": `import { state } from "fixture-state";
    export async function getCurrentCustomer() { return state.customer }
    export async function attachVerifiedPhoneToCustomer(input) { state.calls.push(["attach", input]); return state.attach }`,
  "@/lib/customer/otp-rate-limit": `import { state } from "fixture-state";
    import { RateLimitError } from "@/lib/security/rate-limit";
    export async function enforceCustomerOtpSendRateLimit(input) { state.calls.push(["admit", input.scope, input.phone]); return state.admitted }
    export async function enforceCustomerOtpVerifyRateLimit(input) { state.calls.push(["verifyLimit", input.phone]); if (state.verifyLimited) throw new RateLimitError() }`,
  "@/lib/customer/phone": `export function defaultCountryFromHeaders() { return "GB" }
    export function normalizePhone(raw) {
      const digits = raw.replace(/\\s/g, "")
      return /^07\\d{9}$/.test(digits)
        ? { ok: true, phone: { e164: "+44" + digits.slice(1), country: "GB", last4: digits.slice(-4) } }
        : { ok: false, error: "Enter a valid phone number." }
    }`,
  "@/lib/customer/session": `import { state } from "fixture-state";
    export async function setPendingPhoneVerification(input) { state.calls.push(["setPending", input]); state.pending = { ...input, phoneHmac: "h" } }
    export async function getPendingPhoneVerification() { return state.pending }
    export async function clearPendingPhoneVerification() { state.calls.push(["clearPending"]); state.pending = null }`,
  "@/lib/customer/verification": `import { state } from "fixture-state";
    export async function startCustomerPhoneVerification(phone, channel) { state.calls.push(["send", phone, channel]); return state.sent }
    export async function checkCustomerPhoneVerification(phone, code) { state.calls.push(["check", phone, code]); return state.check }`,
  "@/lib/security/rate-limit": `export class RateLimitError extends Error {}
    export function customerDeviceHashFromHeaders() { return "d".repeat(64) }
    export function customerRateLimitIdentityFromHeaders() { return "identity" }
    export function trustedClientIp() { return "203.0.113.1" }`,
}

async function loadActions() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents:
        'export * from "./app/home/(authed)/profile/phone-actions.ts"; export { state } from "fixture-state";',
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "profile-phone-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\/lib\// }, ({ path: specifier }) =>
            REAL.includes(specifier)
              ? { path: path.join(root, `${specifier.slice(2)}.ts`) }
              : undefined
          )
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/lib\/)/ },
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

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const START = { step: "phone" }

afterEach(() => {
  delete process.env.CUSTOMER_OTP_PRIMARY_CHANNEL
})

test("Given an email-only wallet When a phone code is requested Then it is admitted under the attach scope and bound to this wallet", async () => {
  process.env.CUSTOMER_OTP_PRIMARY_CHANNEL = "sms"
  const { profilePhoneAction, state } = await loadActions()

  const result = await profilePhoneAction(
    START,
    form({ intent: "request", phone: "07700 900123" })
  )

  assert.deepEqual(result, {
    step: "code",
    phone: "+447700900123",
    message: "If a code arrives for that number, enter it here.",
  })
  assert.deepEqual(state.calls, [
    ["admit", "attach", "+447700900123"],
    ["send", "+447700900123", "sms"],
    [
      "setPending",
      {
        purpose: "attach",
        phone: "+447700900123",
        country: "GB",
        channel: "sms",
        customerId: "customer-1",
      },
    ],
  ])
})

test("Given admission refuses When a phone code is requested Then nothing is sent but the answer is the same", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.admitted = false

  const result = await profilePhoneAction(START, form({ phone: "07700900123" }))

  assert.equal(result.step, "code")
  assert.ok(!state.calls.some(([name]) => name === "send"))
  assert.ok(state.calls.some(([name]) => name === "setPending"))
})

test("Given the phone step When the number is invalid, the provider is down, or the wallet already has a phone Then no code is pending", async () => {
  const actions = await loadActions()
  const { profilePhoneAction, state } = actions

  const invalid = await profilePhoneAction(START, form({ phone: "123" }))
  assert.deepEqual(invalid.errors, { phone: "Enter a valid phone number." })

  state.sent = { status: "unavailable" }
  const down = await profilePhoneAction(START, form({ phone: "07700900123" }))
  assert.match(down.errors.form, /couldn't send a code/)

  state.customer = { id: "customer-1", phoneLast4: "4567" }
  const already = await profilePhoneAction(
    START,
    form({ phone: "07700900123" })
  )
  assert.deepEqual(already, {
    step: "attached",
    message: "Your wallet already has a phone number.",
  })

  state.customer = null
  const signedOut = await profilePhoneAction(
    START,
    form({ phone: "07700900123" })
  )
  assert.equal(signedOut.errors.form, "Sign in to add a phone number.")
  assert.ok(!state.calls.some(([name]) => name === "setPending"))
})

test("Given a code for this wallet When it is confirmed Then the phone is attached and the profile refreshes", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = {
    purpose: "attach",
    phone: "+447700900123",
    country: "GB",
    customerId: "customer-1",
  }

  const result = await profilePhoneAction(
    { step: "code", phone: "+447700900123" },
    form({ intent: "verify", otp: "12 34 56" })
  )

  assert.deepEqual(result, {
    step: "attached",
    message: "Your phone number is added. You can sign in with it too.",
  })
  assert.deepEqual(state.calls, [
    ["verifyLimit", "+447700900123"],
    ["check", "+447700900123", "123456"],
    [
      "attach",
      {
        customerId: "customer-1",
        phone: { e164: "+447700900123", country: "GB", last4: "0123" },
      },
    ],
    ["clearPending"],
  ])
  assert.deepEqual(state.revalidated, ["/home/profile"])
  assert.deepEqual(state.events, [])
})

test("Given a pending code for another wallet or purpose When it is confirmed Then nothing is checked or attached", async () => {
  const { profilePhoneAction, state } = await loadActions()
  for (const pending of [
    null,
    { purpose: "wallet", phone: "+447700900123", country: "GB" },
    { purpose: "join", phone: "+447700900123", country: "GB" },
    {
      purpose: "attach",
      phone: "+447700900123",
      country: "GB",
      customerId: "customer-2",
    },
  ]) {
    state.pending = pending
    const result = await profilePhoneAction(
      { step: "code" },
      form({ intent: "verify", otp: "123456" })
    )
    assert.deepEqual(result, {
      step: "phone",
      errors: { phone: "Request a new code." },
    })
  }
  assert.deepEqual(state.calls, [])
})

test("Given another wallet holds the phone When the code is confirmed Then nothing changes, the conflict is recorded and support is offered", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = {
    purpose: "attach",
    phone: "+447700900123",
    country: "GB",
    customerId: "customer-1",
  }
  state.attach = { status: "contact_conflict" }

  const result = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "123456" })
  )

  assert.deepEqual(result, {
    step: "phone",
    errors: {
      form: "This phone number is already used by another Nabaperks wallet. Sign in with that number, or ask the venue for help.",
    },
  })
  assert.deepEqual(state.events, [
    {
      eventName: "customer_contact_conflict",
      customerId: "customer-1",
      metadata: { method: "phone", surface: "profile", reason: "phone_in_use" },
    },
  ])
  assert.deepEqual(state.revalidated, [])
  assert.equal(state.pending, null)
})

test("Given a wrong, malformed or over-limit code When it is checked Then nothing is attached", async () => {
  const { profilePhoneAction, state } = await loadActions()
  const pending = {
    purpose: "attach",
    phone: "+447700900123",
    country: "GB",
    customerId: "customer-1",
  }

  state.pending = pending
  const malformed = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "12" })
  )
  assert.equal(malformed.errors.otp, "Enter the code from your message.")

  state.check = { status: "rejected" }
  const wrong = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "000000" })
  )
  assert.equal(wrong.errors.otp, "That code was not accepted.")
  assert.equal(wrong.step, "code")

  state.check = { status: "unavailable" }
  const down = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "000000" })
  )
  assert.match(down.errors.form, /couldn't check that code/)

  state.verifyLimited = true
  const limited = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "000000" })
  )
  assert.match(limited.errors.form, /Too many code attempts/)

  assert.ok(!state.calls.some(([name]) => name === "attach"))
  assert.deepEqual(state.pending, pending)
})

test("Given the code step When the customer changes the number Then the pending code is dropped and the number refilled", async () => {
  const { profilePhoneAction, state } = await loadActions()

  const result = await profilePhoneAction(
    { step: "code", phone: "+447700900123" },
    form({ intent: "edit", phone: "+447700900123" })
  )

  assert.deepEqual(result, { step: "phone", phone: "+447700900123" })
  assert.deepEqual(state.calls, [["clearPending"]])
})
