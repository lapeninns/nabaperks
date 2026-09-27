import assert from "node:assert/strict"
import path from "node:path"
import { afterEach, test } from "node:test"
import { build } from "esbuild"

/**
 * The join page's email actions, with the sign-in module, identity, session
 * and join context stubbed. The rollout mode, join hrefs and funnel vocabulary
 * are the real ones, so the mode gate is proved against the real parser.
 */
const REAL = [
  "@/lib/customer/email-auth-mode",
  "@/lib/customer/experience/otp-field",
  "@/lib/customer/join-observability-contract",
  "@/lib/navigation/customer-join-intent",
]

const CUSTOMER = { id: "customer-1", phoneLast4: null }

const STUBS = {
  "fixture-state": `export const state = {
    calls: [],
    events: [],
    start: { status: "code_sent", maskedEmail: "g***@example.com", resendAvailableAt: 1060 },
    pending: null,
    check: { status: "verified", email: "guest@example.com", emailHmac: "a".repeat(64) },
    wallet: null,
    handoff: null,
    created: { customer: { id: "customer-new", phoneLast4: null }, created: true },
    returning: null,
    spent: new Set(),
  };`,
  "server-only": "",
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }`,
  "@/lib/customer/access-continuity": `import { state } from "fixture-state";
    export async function establishCustomerSessionAfterVerifiedEmail(input) {
      state.calls.push(["session", input.customer.id, input.customerWasCreated]); return "authenticated"
    }`,
  "@/lib/customer/email-pii-core":
    "export function normalizeEmail(email) { return email.trim().toLowerCase() }",
  "@/lib/customer/email-sign-in": `import { state } from "fixture-state";
    export async function startEmailSignInChallenge(input) { state.calls.push(["start", input]); return state.start }
    export async function checkEmailSignInChallenge(input) { state.calls.push(["check", input]); return state.check }
    export async function getPendingEmailSignIn() { state.calls.push(["pending"]); return state.pending }
    export async function setVerifiedEmailHandoff(input) { state.calls.push(["setHandoff", input]) }
    export async function readVerifiedEmailHandoff(input) { state.calls.push(["readHandoff", input]); return state.handoff }
    export async function clearVerifiedEmailHandoff() { state.calls.push(["clearHandoff"]) }
    export async function consumeVerifiedEmailHandoff(handoff) {
      state.calls.push(["consumeHandoff", handoff.handoffId]);
      if (state.spent.has(handoff.handoffId)) return false;
      state.spent.add(handoff.handoffId); return true
    }`,
  "@/lib/customer/identity": `import { state } from "fixture-state";
    export async function findCustomerByVerifiedEmail(email) { state.calls.push(["find", email]); return state.wallet }
    export async function createCustomerByVerifiedEmail(email) { state.calls.push(["create", email]); return state.created }`,
  "@/lib/customer/join": `export async function getMerchantJoinContext(slug) {
    return slug === "closed" ? { available: false } : { available: true, merchant: { id: "merchant-1" } }
  }`,
  "@/lib/customer/join-funnel": `import { state } from "fixture-state";
    export async function captureJoinFunnelEvent(input) { state.events.push(input) }`,
  "@/lib/customer/profile-fields":
    "export function isEmailAddress(raw) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(raw) }",
  "@/lib/customer/returning-qr-redirect": `import { state } from "fixture-state";
    export async function destinationForReturningQrVisit() { return state.returning }`,
  "@/lib/observability/logger":
    "export const logger = { error() {}, warn() {}, info() {} }",
}

async function loadActions() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents:
        'export * from "./app/m/[merchantSlug]/join/email-actions.ts"; export { state } from "fixture-state";',
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "join-email-boundaries",
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
  for (const [key, value] of Object.entries({
    merchantSlug: "old-crown",
    ...fields,
  })) {
    data.set(key, value)
  }
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

function callNames(state) {
  return state.calls.map(([name]) => name)
}

afterEach(() => {
  delete process.env.CUSTOMER_EMAIL_AUTH_MODE
})

test("Given email sign-in is off When any email action is posted Then it refuses before touching sign-in state", async () => {
  const actions = await loadActions()
  const { state } = actions
  for (const action of [
    actions.requestCustomerEmailIdentityAction,
    actions.verifyCustomerEmailOtpAction,
    actions.startEmailWalletAction,
  ]) {
    const result = await action(
      {},
      form({ email: "guest@example.com", otp: "123456" })
    )
    assert.match(result.errors.form, /use your phone number instead/i)
  }
  assert.equal(
    await redirectOf(
      actions.switchJoinToPhoneAction(form({ qrId: "venue-qr" }))
    ),
    "/m/old-crown/join?qr=venue-qr&step=phone"
  )
  assert.deepEqual(state.calls, [])
  assert.deepEqual(state.events, [])
})

test("Given mode existing When a new wallet is requested Then creation is refused and nothing is created", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "existing"
  const { startEmailWalletAction, state } = await loadActions()
  state.handoff = { email: "guest@example.com" }

  const result = await startEmailWalletAction({}, form({}))

  assert.match(result.errors.form, /can't start a wallet with email/)
  assert.deepEqual(state.calls, [])
})

test("Given mode existing When an email code is requested Then the join challenge starts and the code step opens", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "existing"
  const { requestCustomerEmailIdentityAction, state } = await loadActions()

  const destination = await redirectOf(
    requestCustomerEmailIdentityAction(
      {},
      form({ email: " Guest@Example.com ", qrId: "venue-qr", ref: "friend" })
    )
  )

  assert.equal(destination, "/m/old-crown/join?qr=venue-qr&ref=friend&step=otp")
  assert.deepEqual(state.calls, [
    [
      "start",
      { email: "guest@example.com", purpose: "join", merchantId: "merchant-1" },
    ],
  ])
  assert.deepEqual(state.events, [
    {
      eventName: "join_email_requested",
      merchantId: "merchant-1",
      entry: "qr_referral",
      step: "email",
      method: "email",
    },
  ])
})

test("Given an invalid address or unavailable card When a code is requested Then nothing is sent", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { requestCustomerEmailIdentityAction, state } = await loadActions()

  const invalid = await requestCustomerEmailIdentityAction(
    {},
    form({ email: "nope" })
  )
  assert.equal(invalid.errors.email, "Enter a valid email address.")

  const closed = await requestCustomerEmailIdentityAction(
    {},
    form({ email: "guest@example.com", merchantSlug: "closed" })
  )
  assert.equal(closed.errors.form, "This loyalty card is unavailable just now.")
  assert.deepEqual(state.calls, [])
})

test("Given the email provider fails When a code is requested Then the delay copy is shown in place", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { requestCustomerEmailIdentityAction, state } = await loadActions()
  state.start = {
    status: "delivery_failed",
    maskedEmail: "g***@example.com",
    resendAvailableAt: 1,
  }

  const result = await requestCustomerEmailIdentityAction(
    {},
    form({ email: "guest@example.com" })
  )

  assert.equal(
    result.errors.form,
    "Email codes are delayed. Try again shortly or use your phone."
  )
  assert.deepEqual(state.events, [])
})

test("Given a resend When posted Then it goes to the pending address, not a posted one, and answers in place", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { requestCustomerEmailIdentityAction, state } = await loadActions()
  state.pending = { purpose: "join", email: "guest@example.com" }

  const result = await requestCustomerEmailIdentityAction(
    {},
    form({ resend: "1", email: "attacker@example.com" })
  )

  assert.equal(result.message, "Use the latest code we sent.")
  assert.deepEqual(result.fields, {
    merchantSlug: "old-crown",
    qrId: "",
    emailOtpSent: true,
    resendAvailableAt: 1060,
  })
  assert.equal(state.calls[1][1].email, "guest@example.com")

  state.pending = null
  const expired = await requestCustomerEmailIdentityAction(
    {},
    form({ resend: "1" })
  )
  assert.match(expired.errors.form, /expired/)
})

test("Given a verified email a wallet holds When the code is confirmed Then that wallet is signed in and routed like the phone path", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "existing"
  const { verifyCustomerEmailOtpAction, state } = await loadActions()
  state.wallet = CUSTOMER

  const destination = await redirectOf(
    verifyCustomerEmailOtpAction({}, form({ otp: "12 34 56" }))
  )

  assert.equal(destination, "/m/old-crown/join?step=terms")
  assert.deepEqual(state.calls, [
    ["check", { code: "123456", purpose: "join" }],
    ["find", "guest@example.com"],
    ["session", "customer-1", false],
  ])
  assert.deepEqual(
    state.events.map((event) => [event.eventName, event.method]),
    [["join_otp_verified", "email"]]
  )

  // A returning member who scanned the venue QR goes straight to the stamp.
  state.calls = []
  state.returning = "/card/membership-1/stamp?qr=venue-qr"
  assert.equal(
    await redirectOf(
      verifyCustomerEmailOtpAction(
        {},
        form({ otp: "123456", qrId: "venue-qr" })
      )
    ),
    "/card/membership-1/stamp?qr=venue-qr"
  )
})

test("Given a verified email no wallet holds When the code is confirmed Then only a bound handoff is recorded and the choice opens", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "existing"
  const { verifyCustomerEmailOtpAction, state } = await loadActions()

  const destination = await redirectOf(
    verifyCustomerEmailOtpAction({}, form({ otp: "123456", qrId: "venue-qr" }))
  )

  assert.equal(destination, "/m/old-crown/join?qr=venue-qr&step=email_choice")
  assert.deepEqual(callNames(state), ["check", "find", "setHandoff"])
  assert.deepEqual(state.calls[2][1], {
    email: "guest@example.com",
    emailHmac: "a".repeat(64),
    merchantSlug: "old-crown",
    qrId: "venue-qr",
  })
  assert.equal(state.events[0].eventName, "join_email_no_wallet")
})

test("Given a rejected, expired or limited code When confirmed Then no wallet is looked up", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { verifyCustomerEmailOtpAction, state } = await loadActions()
  const expectations = {
    invalid_code: ["otp", "That code was not accepted."],
    expired: ["form", "That code has expired. Request a new one."],
    rate_limited: [
      "form",
      "Too many code attempts. Request a new code shortly.",
    ],
  }
  for (const [status, [field, copy]] of Object.entries(expectations)) {
    state.check = { status }
    const result = await verifyCustomerEmailOtpAction(
      {},
      form({ otp: "123456" })
    )
    assert.equal(result.errors[field], copy)
  }
  assert.deepEqual([...new Set(callNames(state))], ["check"])
})

test("Given mode full and a bound handoff When a new wallet is started Then it is created, signed in as new and sent to terms", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { startEmailWalletAction, state } = await loadActions()
  state.handoff = { handoffId: "handoff-1", email: "guest@example.com" }

  const destination = await redirectOf(
    startEmailWalletAction({}, form({ qrId: "venue-qr" }))
  )

  assert.equal(destination, "/m/old-crown/join?qr=venue-qr&step=terms")
  assert.deepEqual(state.calls, [
    ["readHandoff", { merchantSlug: "old-crown", qrId: "venue-qr" }],
    ["consumeHandoff", "handoff-1"],
    ["create", "guest@example.com"],
    ["clearHandoff"],
    ["session", "customer-new", true],
  ])
  assert.equal(state.events[0].eventName, "join_new_email_wallet_confirmed")
})

test("Given a handoff already used When a copy of it is replayed Then no wallet is created or signed in", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { startEmailWalletAction, state } = await loadActions()
  state.handoff = { handoffId: "handoff-1", email: "guest@example.com" }
  await redirectOf(startEmailWalletAction({}, form({ qrId: "venue-qr" })))

  // The same cookie again, as a copy would present it after the first use.
  state.calls = []
  state.created = {
    customer: { id: "customer-new", phoneLast4: null },
    created: false,
  }
  const replay = await startEmailWalletAction({}, form({ qrId: "venue-qr" }))

  assert.match(replay.errors.form, /confirmation has expired/)
  assert.deepEqual(callNames(state), [
    "readHandoff",
    "consumeHandoff",
    "clearHandoff",
  ])
})

test("Given no handoff for this device and venue When a new wallet is started Then nothing is created", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const { startEmailWalletAction, state } = await loadActions()

  const result = await startEmailWalletAction({}, form({}))

  assert.match(result.errors.form, /confirmation has expired/)
  assert.deepEqual(callNames(state), ["readHandoff"])
})

test("Given email sign-in is on When the customer switches to phone Then the handoff is dropped", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "existing"
  const { switchJoinToPhoneAction, state } = await loadActions()
  assert.equal(
    await redirectOf(switchJoinToPhoneAction(form({ ref: "friend" }))),
    "/m/old-crown/join?ref=friend&step=phone"
  )
  assert.deepEqual(callNames(state), ["clearHandoff"])
})
