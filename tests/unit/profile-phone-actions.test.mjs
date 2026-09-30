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
  "@/lib/customer/email-auth-mode",
  "@/lib/customer/previous-stamps",
  "@/lib/navigation/safe-next-path",
]

const CONFLICT_COPY =
  "This number is used by another card. Sign in with that number, or ask staff for help."

const STUBS = {
  "@/lib/customer/wallet-link": `import { state } from "fixture-state";
    export async function linkWalletAfterContactVerification(method,contact) {
      state.calls.push(["link",method,contact]); return state.link ?? {status:"conflict"};
    }
    export function walletLinkFailureMessage(status, method) {
      state.calls.push(["linkCopy", status, method]);
      return status === "conflict"
        ? "This number is used by another card. Sign in with that number, or ask staff for help."
        : "link copy " + status;
    }`,
  // The one-time notice cookie itself is proved in contact-notice-flash
  // tests; here the action's recorded outcome and redirect are observed.
  "@/lib/customer/contact-notice-flash": `import { state } from "fixture-state";
    import { contactNoticeReturn } from "@/lib/customer/previous-stamps";
    export async function setContactNoticeFlash(notice, returnTo) {
      state.notices.push(notice);
      return contactNoticeReturn(returnTo).href
    }`,
  "fixture-state": `export const state = {
    calls: [],
    notices: [],
    events: [],
    revalidated: [],
    customer: { id: "customer-1", phoneLast4: null },
    phoneVerified: false,
    admitted: true,
    sent: { status: "sent", channel: "sms" },
    pending: null,
    verifyLimited: false,
    check: { status: "approved" },
    attach: { status: "attached", customer: { id: "customer-1", phoneLast4: "0123" } },
    throwOn: null,
  };`,
  "server-only": "",
  "@/lib/customer/phone-verification-state": `import { state } from "fixture-state";
    export async function customerHasVerifiedPhone() { return state.phoneVerified }`,
  "next/cache": `import { state } from "fixture-state";
    export function revalidatePath(path) { state.revalidated.push(path) }`,
  "next/headers": "export async function headers() { return new Headers() }",
  "next/navigation": `export class RedirectSignal extends Error {
      constructor(url) { super("NEXT_REDIRECT " + url); this.url = url }
    }
    export function redirect(url) { throw new RedirectSignal(url) }`,
  "@/lib/customer/contact-events": `import { state } from "fixture-state";
    export function recordCustomerContactEvent(input) { state.events.push(input) }`,
  "@/lib/customer/identity": `import { state } from "fixture-state";
    export async function getCurrentCustomer() { return state.customer }
    export async function attachVerifiedPhoneToCustomer(input) {
      state.calls.push(["attach", input]);
      if (state.throwOn === "attach") throw new Error("rpc failed");
      return state.attach
    }`,
  "@/lib/customer/otp-rate-limit": `import { state } from "fixture-state";
    import { RateLimitError } from "@/lib/security/rate-limit";
    export async function enforceCustomerOtpSendRateLimit(input) {
      state.calls.push(["admit", input.scope, input.phone]);
      if (state.throwOn === "admit") throw new Error("store down");
      return state.admitted
    }
    export async function enforceCustomerOtpVerifyRateLimit(input) {
      state.calls.push(["verifyLimit", input.phone]);
      if (state.verifyLimited) throw new RateLimitError();
      if (state.throwOn === "verifyLimit") throw new Error("store down")
    }
    export async function releaseCustomerOtpVerifyAdmission(input) { state.calls.push(["verifyRelease", input.phone]) }`,
  "@/lib/customer/phone": `export function defaultCountryFromHeaders() { return "GB" }
    export function normalizePhone(raw) {
      const digits = raw.replace(/\\s/g, "")
      return /^07\\d{9}$/.test(digits)
        ? { ok: true, phone: { e164: "+44" + digits.slice(1), country: "GB", last4: digits.slice(-4) } }
        : { ok: false, error: "Enter a UK mobile number, like 07700 900123." }
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

test("Given a staged unverified phone When a new code is requested Then verification can restart", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.customer = { id: "customer-1", phoneLast4: "0123" }
  state.phoneVerified = false
  const result = await profilePhoneAction(START, form({ phone: "07700900123" }))
  assert.equal(result.step, "code")
  assert.ok(state.calls.some(([name]) => name === "send"))
})

for (const status of ["attached", "contact_conflict"]) {
  test(`Given reward collection phone verification When attachment returns ${status} Then its audit context is reward_gate`, async () => {
    const { rewardPhoneAction, state } = await loadActions()
    state.pending = {
      purpose: "attach",
      phone: "+447700900123",
      country: "GB",
      customerId: "customer-1",
    }
    state.attach = { status, customer: { id: "customer-1" } }
    await rewardPhoneAction(
      { step: "code" },
      form({ intent: "verify", otp: "123456", surface: "profile" })
    )
    assert.equal(
      state.calls.find(([name]) => name === "attach")[1].surface,
      "reward_gate"
    )
    if (status === "contact_conflict")
      assert.equal(state.events[0].metadata.surface, "reward_gate")
  })
}

afterEach(() => {
  delete process.env.CUSTOMER_OTP_PRIMARY_CHANNEL
})

test("Given an email-only wallet When a phone code is requested Then it is admitted under the attach scope and bound to this wallet", async () => {
  process.env.CUSTOMER_OTP_PRIMARY_CHANNEL = "sms"
  const { profilePhoneAction, state } = await loadActions()

  const before = Math.floor(Date.now() / 1_000)
  const result = await profilePhoneAction(
    START,
    form({ intent: "request", phone: "07700 900123" })
  )

  // The send time drives the code step's "Send a new code" wait.
  const { codeSentAt, ...answer } = result
  assert.ok(codeSentAt >= before && codeSentAt <= before + 1)
  assert.deepEqual(answer, {
    step: "code",
    phone: "+447700900123",
    channel: "sms",
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
  assert.deepEqual(invalid.errors, {
    phone: "Enter a UK mobile number, like 07700 900123.",
  })

  state.sent = { status: "unavailable" }
  const down = await profilePhoneAction(START, form({ phone: "07700900123" }))
  assert.match(down.errors.form, /couldn't send a code/)

  state.customer = { id: "customer-1", phoneLast4: "4567" }
  state.phoneVerified = true
  const already = await profilePhoneAction(
    START,
    form({ phone: "07700900123" })
  )
  assert.deepEqual(already, {
    step: "attached",
    message: "Your mobile number is already confirmed.",
  })

  state.customer = null
  const signedOut = await profilePhoneAction(
    START,
    form({ phone: "07700900123" })
  )
  assert.equal(
    signedOut.errors.form,
    "Sign in again to add your mobile number."
  )
  // The typed number survives every refusal.
  assert.equal(invalid.phone, "123")
  assert.equal(down.phone, "07700900123")
  assert.equal(signedOut.phone, "07700900123")
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
    verifiedNow: true,
    message: "Your mobile number is confirmed. You can use it to sign in.",
  })
  assert.deepEqual(state.calls, [
    ["verifyLimit", "+447700900123"],
    ["check", "+447700900123", "123456"],
    ["verifyRelease", "+447700900123"],
    [
      "attach",
      {
        customerId: "customer-1",
        phone: { e164: "+447700900123", country: "GB", last4: "0123" },
        surface: "profile",
      },
    ],
    ["clearPending"],
  ])
  assert.deepEqual(state.revalidated, ["/home/profile", "/reward"])
  assert.deepEqual(state.events, [])
})

test("Given a lapsed, missing or foreign pending code When it is confirmed Then nothing is checked or attached and the number is kept", async () => {
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
      { step: "code", phone: "+447700900123" },
      // The code step posts the number it showed.
      form({ intent: "verify", otp: "123456", phone: "+447700900123" })
    )
    assert.deepEqual(result, {
      step: "phone",
      phone: "+447700900123",
      errors: { phone: "Your code expired. Send a new one." },
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
    phone: "+447700900123",
    errors: { form: CONFLICT_COPY },
  })
  assert.ok(
    state.calls.some(
      ([name, status, method]) =>
        name === "linkCopy" && status === "conflict" && method === "phone"
    )
  )
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

test("Given a complementary phone wallet When its code is verified Then linking replaces the conflict and refreshes all cards", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = {
    purpose: "attach",
    phone: "+447700900123",
    country: "GB",
    customerId: "customer-1",
  }
  state.attach = { status: "contact_conflict" }
  state.link = { status: "linked", customerId: "customer-2" }
  const result = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "123456" })
  )
  assert.equal(result.step, "attached")
  assert.ok(
    state.calls.some(
      (call) =>
        call[0] === "link" && call[1] === "phone" && call[2] === "+447700900123"
    )
  )
  assert.deepEqual(state.revalidated, ["/home", "/reward"])
  assert.deepEqual(state.events, [])
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
  assert.equal(malformed.errors.otp, "Enter the code we sent you.")

  state.check = { status: "rejected" }
  const wrong = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "000000" })
  )
  assert.equal(
    wrong.errors.otp,
    "That code didn't work. Check it and try again."
  )
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
  assert.match(limited.errors.form, /Too many tries/)

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

const WHATSAPP_PENDING = {
  purpose: "attach",
  phone: "+447700900123",
  country: "GB",
  channel: "whatsapp",
  customerId: "customer-1",
}

test("Given a WhatsApp code When the customer resends Then the pending number and WhatsApp are kept, whatever the configured primary", async () => {
  process.env.CUSTOMER_OTP_PRIMARY_CHANNEL = "sms"
  const { profilePhoneAction, state } = await loadActions()
  state.pending = WHATSAPP_PENDING
  state.sent = { status: "sent", channel: "whatsapp" }

  const result = await profilePhoneAction(
    { step: "code", phone: "+447700900123", channel: "whatsapp" },
    // The pending code, not the posted number, says where it goes.
    form({ intent: "request", resend: "1", phone: "tampered" })
  )

  // A resend restarts the code step's wait from its own send time.
  const { codeSentAt, ...answer } = result
  assert.equal(typeof codeSentAt, "number")
  assert.deepEqual(answer, {
    step: "code",
    phone: "+447700900123",
    channel: "whatsapp",
    message: "If a code arrives for that number, enter it here.",
  })
  assert.deepEqual(state.calls.slice(0, 2), [
    ["admit", "attach", "+447700900123"],
    ["send", "+447700900123", "whatsapp"],
  ])
  assert.equal(state.pending.channel, "whatsapp")
})

test("Given a WhatsApp code that never arrives When the customer asks for a text Then it is resent by SMS and the code step records SMS", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = WHATSAPP_PENDING
  state.sent = { status: "sent", channel: "sms" }

  const result = await profilePhoneAction(
    { step: "code", phone: "+447700900123", channel: "whatsapp" },
    form({
      intent: "request",
      resend: "1",
      phone: "+447700900123",
      channel: "sms",
    })
  )

  assert.equal(result.step, "code")
  assert.equal(result.channel, "sms")
  assert.deepEqual(state.calls[1], ["send", "+447700900123", "sms"])
  assert.equal(state.pending.channel, "sms")
  assert.equal(state.pending.customerId, "customer-1")
})

test("Given another wallet's pending code When a resend is posted Then the posted number is validated as a fresh request", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = { ...WHATSAPP_PENDING, customerId: "customer-2" }

  const result = await profilePhoneAction(
    { step: "code" },
    form({ intent: "request", resend: "1", phone: "+447700900123" })
  )

  // The stubbed normaliser takes national numbers only.
  assert.deepEqual(result.errors, {
    phone: "Enter a UK mobile number, like 07700 900123.",
  })
  assert.ok(!state.calls.some(([name]) => name === "send"))
})

test("Given the wallet is erased while the code is checked When it is confirmed Then nothing is added and the customer is asked to sign in (QA BUG-002)", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = WHATSAPP_PENDING
  state.attach = { status: "wallet_unavailable" }

  const result = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "123456" })
  )

  assert.deepEqual(result, {
    step: "phone",
    phone: "+447700900123",
    errors: { form: "Sign in again to add your mobile number." },
  })
  assert.equal(state.pending, null)
  assert.deepEqual(state.revalidated, [])
  assert.deepEqual(state.events, [])
})

test("Given a wrong code on a WhatsApp code step When it is refused Then the step still knows the channel", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = WHATSAPP_PENDING
  state.check = { status: "rejected" }

  const result = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "000000" })
  )

  assert.deepEqual(result, {
    step: "code",
    phone: "+447700900123",
    channel: "whatsapp",
    errors: { otp: "That code didn't work. Check it and try again." },
  })
})

test("Given the phone could not be audited When the code is confirmed Then the customer is asked to try again and nothing is refreshed", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = WHATSAPP_PENDING
  state.attach = { status: "audit_failed" }

  const result = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "123456" })
  )

  assert.deepEqual(result, {
    step: "phone",
    phone: "+447700900123",
    errors: {
      form: "We couldn't save your number just now. Send a new code and try again.",
    },
  })
  assert.equal(state.pending, null)
  assert.deepEqual(state.revalidated, [])
  assert.deepEqual(state.events, [])
})

const PENDING = {
  purpose: "attach",
  phone: "+447700900123",
  country: "GB",
  customerId: "customer-1",
}

for (const [status, copy] of [
  ["reauthenticate", "link copy reauthenticate"],
  ["requires_review", "link copy requires_review"],
]) {
  test(`Given linking answers ${status} When the code is confirmed Then the number is kept and the recovery is offered`, async () => {
    const { profilePhoneAction, state } = await loadActions()
    state.pending = PENDING
    state.attach = { status: "contact_conflict" }
    state.link = { status }

    const result = await profilePhoneAction(
      { step: "code" },
      form({ intent: "verify", otp: "123456" })
    )

    assert.deepEqual(result, {
      step: "phone",
      phone: "+447700900123",
      errors: { form: copy },
      recovery: status,
    })
    assert.equal(state.pending, null)
  })
}

test("Given a complementary card When linking succeeds Then the copy says the stamps are together without promising email sign-in while email is off", async () => {
  delete process.env.CUSTOMER_EMAIL_AUTH_MODE
  const { profilePhoneAction, state } = await loadActions()
  state.pending = PENDING
  state.attach = { status: "contact_conflict" }
  state.link = { status: "linked", customerId: "customer-2" }

  const off = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "123456" })
  )
  assert.equal(
    off.message,
    "Your stamps are together now. Sign in with your mobile number."
  )
  assert.doesNotMatch(off.message, /email|wallet/i)

  process.env.CUSTOMER_EMAIL_AUTH_MODE = "existing"
  try {
    state.pending = PENDING
    const on = await profilePhoneAction(
      { step: "code" },
      form({ intent: "verify", otp: "123456" })
    )
    assert.match(on.message, /^Your stamps are together now\./)
    assert.match(on.message, /get one by email/)
  } finally {
    delete process.env.CUSTOMER_EMAIL_AUTH_MODE
  }
})

test("Given the verify limiter itself fails When a code is confirmed Then the code step answers and the pending code is kept", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = PENDING
  state.throwOn = "verifyLimit"

  const result = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "123456" })
  )

  assert.deepEqual(result, {
    step: "code",
    phone: "+447700900123",
    errors: {
      form: "We couldn't check that code. Try again, or send a new code.",
    },
  })
  assert.deepEqual(state.pending, PENDING)
  assert.ok(!state.calls.some(([name]) => name === "attach"))
})

test("Given the attach RPC throws When an approved code is confirmed Then the spent code is cleared and the number is kept", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = PENDING
  state.throwOn = "attach"

  const result = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "123456" })
  )

  assert.deepEqual(result, {
    step: "phone",
    phone: "+447700900123",
    errors: {
      form: "We couldn't save your number just now. Send a new code and try again.",
    },
  })
  assert.equal(state.pending, null)
  assert.deepEqual(state.revalidated, [])
})

test("Given the send limiter fails When a code is requested Then the number is kept and no code is pending", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.throwOn = "admit"

  const result = await profilePhoneAction(
    START,
    form({ intent: "request", phone: "07700 900123" })
  )

  assert.deepEqual(result, {
    step: "phone",
    phone: "07700 900123",
    errors: { form: "We couldn't send a code just now. Try again." },
  })
  assert.equal(state.pending, null)
})

test("Given the reward gate names where the guest was When the number is confirmed Then it redirects back with a server-set notice, never a URL flag", async () => {
  const { rewardPhoneAction, state } = await loadActions()

  state.pending = PENDING
  await assert.rejects(
    rewardPhoneAction(
      { step: "code" },
      form({ intent: "verify", otp: "123456", returnTo: "/reward/r-1" })
    ),
    (error) => error.url === "/reward/r-1"
  )

  state.pending = PENDING
  state.attach = { status: "contact_conflict" }
  state.link = { status: "linked", customerId: "customer-2" }
  await assert.rejects(
    rewardPhoneAction(
      { step: "code" },
      form({ intent: "verify", otp: "123456", returnTo: "/reward/r-1" })
    ),
    (error) => error.url === "/reward/r-1"
  )

  // An off-site returnTo falls back to the profile.
  state.pending = PENDING
  state.attach = { status: "attached" }
  await assert.rejects(
    rewardPhoneAction(
      { step: "code" },
      form({
        intent: "verify",
        otp: "123456",
        returnTo: "https://evil.example/x",
      })
    ),
    (error) => error.url === "/home/profile"
  )
  assert.deepEqual(state.notices, [
    "phone-added",
    "stamps-together",
    "phone-added",
  ])
})

test("Given the previous-stamps task When its number is confirmed with nothing to bring over Then it returns to the task with that notice", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = PENDING

  await assert.rejects(
    profilePhoneAction(
      { step: "code" },
      form({
        intent: "verify",
        otp: "123456",
        task: "previous",
        returnTo: "/home/profile#previous-stamps",
      })
    ),
    (error) => error.url === "/home/profile#previous-stamps"
  )
  assert.deepEqual(state.notices, ["nothing-found-phone"])
})

test("Given a stale previous-stamps form When the card already has a confirmed number Then it answers in place and never claims nothing was found", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.customer = { id: "customer-1", phoneLast4: "4567" }
  state.phoneVerified = true

  const result = await profilePhoneAction(
    START,
    form({
      phone: "07700900123",
      task: "previous",
      returnTo: "/home/profile#previous-stamps",
    })
  )
  assert.deepEqual(result, {
    step: "attached",
    message: "Your mobile number is already confirmed.",
  })
})

test("Given no returnTo When the Contact form confirms a number Then it answers in place", async () => {
  const { profilePhoneAction, state } = await loadActions()
  state.pending = PENDING
  const result = await profilePhoneAction(
    { step: "code" },
    form({ intent: "verify", otp: "123456" })
  )
  assert.equal(result.step, "attached")
})
