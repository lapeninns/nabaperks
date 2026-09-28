import assert from "node:assert/strict"
import path from "node:path"
import { afterEach, test } from "node:test"
import { build } from "esbuild"

/**
 * /home/login's email actions and the one login dispatcher, with the sign-in
 * module, identity, session and tracking stubbed. The rollout mode, the OTP
 * normaliser and the safe `next` parser are the real ones, so the mode gate
 * and the redirect target are proved against the real code.
 */
const REAL = [
  "@/lib/customer/email-auth-mode",
  "@/lib/customer/experience/otp-field",
  "@/lib/customer/phone-code-email-fallback",
  "@/lib/navigation/safe-next-path",
]

const CUSTOMER = { id: "customer-1", phoneLast4: null }

const STUBS = {
  "fixture-state": `export const state = {
    calls: [],
    events: [],
    start: { status: "code_sent", maskedEmail: "g***@example.com", resendAvailableAt: 1060 },
    pending: null,
    check: { status: "verified", email: "guest@example.com", emailHmac: "a".repeat(64), retryChallenge: { challengeId: "retry-1" } },
    wallet: null,
    findFails: false,
    sessionFails: false,
    phonePending: null,
    gate: { open: true, phoneCode: null },
    opened: [],
  };`,
  // The fallback gate itself is proved in email-fallback-gate.test.mjs.
  "@/lib/customer/email-fallback": `import { state } from "fixture-state";
    export async function walletEmailFallbackGate() { return state.gate }
    export async function openEmailFallback(purpose, reason) { state.opened.push([purpose, reason]) }`,
  "server-only": "",
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }`,
  "@/lib/customer/access-continuity": `import { state } from "fixture-state";
    export async function establishCustomerSessionAfterVerifiedEmail(input) {
      state.calls.push(["session", input.customer.id, input.customerWasCreated]);
      if (state.sessionFails) throw new Error("no device");
      return "authenticated"
    }`,
  "@/lib/customer/contact-events": `import { state } from "fixture-state";
    export function recordCustomerContactEvent(input) { state.events.push(input) }`,
  "@/lib/customer/email-pii-core":
    "export function normalizeEmail(email) { return email.trim().toLowerCase() }",
  "@/lib/customer/email-sign-in": `import { state } from "fixture-state";
    export async function startEmailSignInChallenge(input) { state.calls.push(["start", input]); return state.start }
    export async function checkEmailSignInChallenge(input) { state.calls.push(["check", input]); return state.check }
    export async function getPendingEmailSignIn() { state.calls.push(["pending"]); return state.pending }
    export async function clearPendingEmailSignIn() { state.calls.push(["clearEmail"]) }
    export async function keepEmailSignInForRetry(verified) { state.calls.push(["keepForRetry", verified.retryChallenge.challengeId]) }`,
  "@/lib/customer/identity": `import { state } from "fixture-state";
    export async function findCustomerByVerifiedEmail(email) {
      state.calls.push(["find", email]);
      if (state.findFails) throw new Error("database unavailable");
      return state.wallet
    }
    export async function createCustomerByVerifiedEmail() { throw new Error("login must never create a wallet") }`,
  "@/lib/customer/profile-fields":
    "export function isEmailAddress(raw) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(raw) }",
  "@/lib/customer/session": `import { state } from "fixture-state";
    export async function clearPendingPhoneVerification() { state.calls.push(["clearPhone"]) }
    export async function getPendingPhoneVerification() { state.calls.push(["phonePending"]); return state.phonePending }`,
  "@/lib/observability/logger":
    "export const logger = { error() {}, warn() {}, info() {} }",
  // Only the dispatcher build reaches these two.
  "@/app/home/actions": `import { state } from "fixture-state";
    export async function requestCustomerLoginOtpAction() { state.calls.push(["phoneRequest"]); return { fields: { contact: "+447700900123", otpSent: true } } }
    export async function verifyCustomerLoginOtpAction() { state.calls.push(["phoneVerify"]); return { errors: { contact: "Request a new phone code." } } }`,
  "@/app/home/login/email-actions": `import { state } from "fixture-state";
    export async function requestCustomerLoginEmailAction() { state.calls.push(["emailRequest"]); return {} }
    export async function verifyCustomerLoginEmailAction() { state.calls.push(["emailVerify"]); return {} }
    export async function editCustomerLoginEmailAction() { state.calls.push(["emailEdit"]); return {} }
    export async function switchCustomerLoginMethodAction() { state.calls.push(["switch"]); return {} }`,
}

async function load(entry, { stubEmailActions = false } = {}) {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents: `export * from "./${entry}"; export { state } from "fixture-state";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "login-email-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\/lib\// }, ({ path: specifier }) =>
            REAL.includes(specifier)
              ? { path: path.join(root, `${specifier.slice(2)}.ts`) }
              : undefined
          )
          build.onResolve(
            { filter: /^@\/app\/home\/login\/email-actions$/ },
            ({ path: specifier }) =>
              stubEmailActions
                ? { path: specifier, namespace: "fixture" }
                : { path: path.join(root, `${specifier.slice(2)}.ts`) }
          )
          build.onResolve(
            {
              filter:
                /^(fixture-state|server-only|next\/|@\/lib\/|@\/app\/home\/actions$)/,
            },
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

const loadActions = () => load("app/home/login/email-actions.ts")

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

async function redirectOf(promise) {
  try {
    await promise
  } catch (error) {
    if (error?.message === "NEXT_REDIRECT") return error.destination
    throw error
  }
  assert.fail("expected a redirect")
}

afterEach(() => {
  delete process.env.CUSTOMER_EMAIL_AUTH_MODE
})

test("Given email sign-in is off When any login email action is posted Then it refuses before touching sign-in state", async () => {
  const actions = await loadActions()
  const { state } = actions
  for (const action of [
    actions.requestCustomerLoginEmailAction,
    actions.verifyCustomerLoginEmailAction,
    actions.editCustomerLoginEmailAction,
  ]) {
    const result = await action(
      {},
      form({ email: "guest@example.com", otp: "123456" })
    )
    assert.equal(result.fields.method, "phone")
    assert.match(result.errors.form, /use your phone number instead/i)
  }
  const switched = await actions.switchCustomerLoginMethodAction(
    {},
    form({ method: "email" })
  )
  assert.deepEqual(switched, { fields: { method: "phone" } })
  assert.deepEqual(state.calls, [])
  assert.deepEqual(state.events, [])
})

test("Given mode existing When an email code is requested Then a wallet challenge starts and the code step answers in place", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "existing"
  const { requestCustomerLoginEmailAction, state } = await loadActions()

  const result = await requestCustomerLoginEmailAction(
    {},
    form({ email: " Guest@Example.com " })
  )

  assert.deepEqual(state.calls, [
    ["start", { email: "guest@example.com", purpose: "wallet" }],
  ])
  assert.deepEqual(result, {
    fields: {
      method: "email",
      email: "guest@example.com",
      otpSent: true,
      maskedEmail: "g***@example.com",
      retryAt: 1060,
    },
    message: "If a code arrives at that address, enter it here.",
  })
  assert.deepEqual(state.events, [
    {
      eventName: "customer_login_code_requested",
      metadata: { method: "email", surface: "home_login" },
    },
  ])
})

test("Given an invalid address When a code is requested Then nothing is sent", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { requestCustomerLoginEmailAction, state } = await loadActions()

  const result = await requestCustomerLoginEmailAction(
    {},
    form({ email: "nope" })
  )

  assert.equal(result.errors.email, "Enter a valid email address.")
  assert.equal(result.fields.method, "email")
  assert.deepEqual(state.calls, [])
  assert.deepEqual(state.events, [])
})

test("Given the email provider fails When a code is requested Then the delay copy is shown and no request is counted", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { requestCustomerLoginEmailAction, state } = await loadActions()
  state.start = {
    status: "delivery_failed",
    maskedEmail: "g***@example.com",
    resendAvailableAt: 1,
  }

  const result = await requestCustomerLoginEmailAction(
    {},
    form({ email: "guest@example.com" })
  )

  assert.equal(
    result.errors.form,
    "Email codes are delayed. Try again shortly or use your phone."
  )
  assert.equal(result.fields.otpSent, undefined)
  // The sign-in module records customer_login_code_send_failed itself.
  assert.deepEqual(state.events, [])
})

test("Given a resend When posted Then it goes to the pending wallet address, never a posted one", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { requestCustomerLoginEmailAction, state } = await loadActions()
  state.pending = { purpose: "wallet", email: "guest@example.com" }

  const result = await requestCustomerLoginEmailAction(
    {},
    form({ resend: "1", email: "attacker@example.com" })
  )

  assert.equal(result.message, "Use the latest code we sent.")
  assert.equal(state.calls[1][1].email, "guest@example.com")

  // A join challenge is not this page's to resend.
  state.pending = { purpose: "join", email: "guest@example.com" }
  const joinPending = await requestCustomerLoginEmailAction(
    {},
    form({ resend: "1" })
  )
  assert.equal(joinPending.errors.email, "Request a new email code.")
  assert.equal(state.calls.filter(([name]) => name === "start").length, 1)
})

test("Given a verified email a wallet holds When the code is confirmed Then that wallet is signed in and the safe next path opens", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "existing"
  const { verifyCustomerLoginEmailAction, state } = await loadActions()
  state.wallet = CUSTOMER

  const destination = await redirectOf(
    verifyCustomerLoginEmailAction(
      { fields: { email: "guest@example.com" } },
      form({ otp: "12 34 56", next: "/home/rewards" })
    )
  )

  assert.equal(destination, "/home/rewards")
  assert.deepEqual(state.calls, [
    ["check", { code: "123456", purpose: "wallet" }],
    ["find", "guest@example.com"],
    ["session", "customer-1", false],
  ])
  assert.deepEqual(state.events, [
    {
      eventName: "customer_login_verified",
      customerId: "customer-1",
      metadata: { method: "email", surface: "home_login" },
    },
  ])

  const offsite = await redirectOf(
    verifyCustomerLoginEmailAction({}, form({ otp: "123456", next: "//evil" }))
  )
  assert.equal(offsite, "/home")
})

test("Given a verified email no wallet holds When the code is confirmed Then it shows the scan step, signs no one in and creates nothing", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { verifyCustomerLoginEmailAction, state } = await loadActions()

  const result = await verifyCustomerLoginEmailAction(
    { fields: { email: "guest@example.com" } },
    form({ otp: "123456" })
  )

  assert.deepEqual(result, {
    fields: { method: "email", email: "guest@example.com", noCards: true },
    message:
      "No wallet uses this email yet. Scan a venue QR to join, or sign in with your phone.",
  })
  assert.ok(!state.calls.some(([name]) => name === "session"))
  assert.deepEqual(state.events, [
    {
      eventName: "customer_login_no_wallet",
      metadata: { method: "email", surface: "home_login" },
    },
  ])
})

test("Given a wrong, expired or over-limit code When it is checked Then no wallet is looked up", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { verifyCustomerLoginEmailAction, state } = await loadActions()
  const codeState = {
    fields: {
      email: "guest@example.com",
      maskedEmail: "g***@example.com",
      retryAt: 1060,
    },
  }

  state.check = { status: "invalid_code" }
  const wrong = await verifyCustomerLoginEmailAction(
    codeState,
    form({ otp: "000000" })
  )
  assert.equal(wrong.errors.otp, "That code was not accepted.")
  assert.deepEqual(wrong.fields, {
    method: "email",
    email: "guest@example.com",
    otpSent: true,
    maskedEmail: "g***@example.com",
    retryAt: 1060,
  })

  state.check = { status: "rate_limited" }
  const limited = await verifyCustomerLoginEmailAction(
    codeState,
    form({ otp: "000000" })
  )
  assert.match(limited.errors.form, /Too many code attempts/)

  state.check = { status: "expired" }
  const expired = await verifyCustomerLoginEmailAction(
    codeState,
    form({ otp: "000000" })
  )
  assert.equal(expired.errors.email, "Request a new email code.")
  assert.equal(expired.fields.otpSent, undefined)

  assert.ok(!state.calls.some(([name]) => name === "find"))
  assert.deepEqual(state.events, [])
})

for (const fault of ["session", "lookup"]) {
  test(`Given the ${fault} fails after a matched code When the email is confirmed Then the same code is kept for a retry and no sign-in is recorded`, async () => {
    process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
    const { verifyCustomerLoginEmailAction, state } = await loadActions()
    state.wallet = CUSTOMER
    state.sessionFails = fault === "session"
    state.findFails = fault === "lookup"

    const result = await verifyCustomerLoginEmailAction(
      {
        fields: {
          email: "guest@example.com",
          maskedEmail: "g***@example.com",
          retryAt: 1060,
        },
      },
      form({ otp: "123456" })
    )

    // Still on the code step, so the customer can enter the same code again.
    assert.deepEqual(result, {
      fields: {
        method: "email",
        email: "guest@example.com",
        otpSent: true,
        maskedEmail: "g***@example.com",
        retryAt: 1060,
      },
      errors: {
        form: "We couldn't sign you in just now. Enter the same code again shortly.",
      },
    })
    assert.deepEqual(
      state.calls.at(-1),
      ["keepForRetry", "retry-1"],
      "the matched code is restored under its new challenge"
    )
    assert.equal(
      state.calls.some(([name]) => name === "session"),
      fault === "session"
    )
    assert.deepEqual(state.events, [])
  })
}

test("Given a verified email no wallet holds When the code is confirmed Then the spent code is not restored", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { verifyCustomerLoginEmailAction, state } = await loadActions()

  await verifyCustomerLoginEmailAction({}, form({ otp: "123456" }))

  assert.ok(!state.calls.some(([name]) => name === "keepForRetry"))
})

test("Given a signed-in wallet When the email code is confirmed Then the spent code is not restored", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { verifyCustomerLoginEmailAction, state } = await loadActions()
  state.wallet = CUSTOMER

  await redirectOf(verifyCustomerLoginEmailAction({}, form({ otp: "123456" })))

  assert.ok(!state.calls.some(([name]) => name === "keepForRetry"))
})

test("Given the code step When the customer changes email or method Then only email loses its pending code, and the phone code survives the fallback", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "existing"
  const actions = await loadActions()
  const { state } = actions

  assert.deepEqual(
    await actions.editCustomerLoginEmailAction(
      {},
      form({ email: "guest@example.com" })
    ),
    {
      fields: {
        method: "email",
        email: "guest@example.com",
        editingContact: true,
      },
    }
  )
  assert.deepEqual(
    await actions.switchCustomerLoginMethodAction(
      {},
      form({ method: "phone" })
    ),
    { fields: { method: "phone" } }
  )
  assert.deepEqual(
    await actions.switchCustomerLoginMethodAction(
      {},
      form({ method: "email" })
    ),
    { fields: { method: "email" } }
  )
  // Taking the email fallback keeps the phone code: only an email code
  // actually requested replaces it (startEmailSignInChallenge).
  assert.deepEqual(state.calls, [
    ["clearEmail"],
    ["clearEmail"],
    ["phonePending"],
  ])
})

test("Given a phone code is still pending When the customer leaves the email fallback Then they return to that code step with the server's wait", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const actions = await loadActions()
  const { state } = actions
  const nowSeconds = Math.floor(Date.now() / 1_000)
  state.phonePending = {
    purpose: "wallet",
    phone: "+447700900123",
    issuedAt: nowSeconds - 40,
  }

  assert.deepEqual(
    await actions.switchCustomerLoginMethodAction(
      {},
      form({ method: "phone" })
    ),
    {
      fields: {
        method: "phone",
        contact: "+447700900123",
        otpSent: true,
        // Over 30 seconds since the send: the fallback shows again at once.
        emailFallbackInSeconds: 0,
        // The step keys its wait on the send time.
        phoneCodeSentAt: nowSeconds - 40,
      },
    }
  )

  state.phonePending = { ...state.phonePending, issuedAt: nowSeconds - 10 }
  const recent = await actions.switchCustomerLoginMethodAction(
    {},
    form({ method: "phone" })
  )
  assert.ok(recent.fields.emailFallbackInSeconds >= 19)
  assert.ok(recent.fields.emailFallbackInSeconds <= 21)

  // A code for another purpose is never shown here.
  state.phonePending = { ...state.phonePending, purpose: "join" }
  assert.deepEqual(
    await actions.switchCustomerLoginMethodAction(
      {},
      form({ method: "phone" })
    ),
    { fields: { method: "phone" } }
  )
  assert.ok(!state.calls.some(([name]) => name === "clearPhone"))
})

test("Given the server has not opened email When the switch, request or edit is posted Then each answers with the phone step and touches no email state", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const actions = await loadActions()
  const { state } = actions
  const nowSeconds = Math.floor(Date.now() / 1_000)
  // A phone code sent 10 seconds ago: 20 seconds of its wait are left.
  state.gate = {
    open: false,
    phoneCode: { phone: "+447700900123", issuedAt: nowSeconds - 10 },
  }

  const answers = [
    await actions.switchCustomerLoginMethodAction(
      {},
      form({ method: "email" })
    ),
    await actions.requestCustomerLoginEmailAction(
      {},
      form({ email: "guest@example.com" })
    ),
    await actions.requestCustomerLoginEmailAction(
      {},
      form({ email: "someone-else@example.com" })
    ),
    await actions.editCustomerLoginEmailAction(
      {},
      form({ email: "guest@example.com" })
    ),
  ]
  for (const answer of answers) {
    assert.equal(answer.fields.method, "phone")
    assert.equal(answer.fields.otpSent, true)
    assert.equal(answer.fields.contact, "+447700900123")
    assert.equal(answer.fields.phoneCodeSentAt, nowSeconds - 10)
    assert.ok(answer.fields.emailFallbackInSeconds >= 19)
    assert.ok(answer.fields.emailFallbackInSeconds <= 21)
    assert.equal(answer.errors, undefined)
  }
  // The same answer whatever address was named: nothing to enumerate.
  assert.deepEqual(answers[1], answers[2])
  assert.deepEqual(state.calls, [])
  assert.deepEqual(state.opened, [])
  assert.deepEqual(state.events, [])

  // No phone code pending: the number form.
  state.gate = { open: false, phoneCode: null }
  assert.deepEqual(
    await actions.switchCustomerLoginMethodAction(
      {},
      form({ method: "email" })
    ),
    { fields: { method: "phone" } }
  )
})

test("Given the server has opened email When the switch or request is posted Then email opens and stays open for the next address", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const actions = await loadActions()
  const { state } = actions

  assert.deepEqual(
    await actions.switchCustomerLoginMethodAction(
      {},
      form({ method: "email" })
    ),
    { fields: { method: "email" } }
  )
  await actions.requestCustomerLoginEmailAction(
    {},
    form({ email: "guest@example.com" })
  )
  await actions.editCustomerLoginEmailAction(
    {},
    form({ email: "guest@example.com" })
  )
  assert.deepEqual(state.opened, [
    ["wallet", "opened"],
    ["wallet", "opened"],
    ["wallet", "opened"],
  ])
  assert.ok(state.calls.some(([name]) => name === "start"))
})

test("Given the login dispatcher When each intent is posted Then it reaches its action and phone answers stay on phone", async () => {
  const { submitCustomerLoginOtpAction, state } = await load(
    "app/home/login/otp-action.ts",
    { stubEmailActions: true }
  )

  for (const intent of [
    "email-request",
    "email-verify",
    "email-edit",
    "switch-method",
  ]) {
    await submitCustomerLoginOtpAction({}, form({ intent }))
  }
  const request = await submitCustomerLoginOtpAction(
    {},
    form({ intent: "request" })
  )
  const verify = await submitCustomerLoginOtpAction(
    {},
    form({ intent: "verify" })
  )
  const edit = await submitCustomerLoginOtpAction(
    {},
    form({ intent: "edit", contact: "+447700900123" })
  )

  assert.deepEqual(
    state.calls.map(([name]) => name),
    [
      "emailRequest",
      "emailVerify",
      "emailEdit",
      "switch",
      "phoneRequest",
      "phoneVerify",
      "clearPhone",
    ]
  )
  assert.equal(request.fields.method, "phone")
  assert.equal(request.fields.otpSent, true)
  assert.deepEqual(verify, {
    errors: { contact: "Request a new phone code." },
    fields: { method: "phone" },
  })
  assert.deepEqual(edit.fields, {
    contact: "+447700900123",
    editingContact: true,
    method: "phone",
  })
})
