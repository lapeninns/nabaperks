import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, test } from "node:test"
import { build } from "esbuild"

/**
 * The join funnel's `method` dimension (QA BUG-028). Every join journey that
 * ends in a verified contact stores exactly one `join_otp_verified`, and it
 * names the contact that proved the customer: phone joins as well as email
 * sign-ins and new email wallets.
 *
 * Both join action modules are bundled with the real funnel capture
 * (`captureJoinFunnelEvent`, the signed journey token and its deterministic
 * event IDs) and every other boundary stubbed. `recordProductEvent` is stood
 * in for by the insert it performs, `upsert(..., { ignoreDuplicates: true })`
 * on the event ID, so a second event with the same ID in one journey is
 * dropped here exactly as Postgres drops it.
 */
const REAL = new Set([
  "@/lib/analytics/after-response",
  "@/lib/analytics/funnel-token",
  "@/lib/analytics/privacy-core",
  "@/lib/customer/contact-event-core",
  "@/lib/customer/email-auth-mode",
  "@/lib/customer/experience/otp-field",
  "@/lib/customer/join-funnel",
  "@/lib/customer/join-observability-contract",
  "@/lib/customer/otp-channel-core",
  "@/lib/customer/phone",
  "@/lib/customer/phone-code-email-fallback",
  "@/lib/navigation/customer-join-intent",
  "@/lib/observability/request-id",
])

const SECRET = "funnel-test-secret-".padEnd(48, "x")

// Boundaries the funnel capture itself reaches, and anything a stub must be
// rather than a recorded async call.
const SPECIAL = {
  "server-only": "",
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }`,
  "next/headers": `import { state } from "fixture-state";
    export async function headers() {
      return new Headers({ "x-nabaperks-join-journey": state.token })
    }
    export async function cookies() { return { get() {}, set() {}, delete() {} } }`,
  "next/server": `import { state } from "fixture-state";
    export function after(task) { state.after.push(task) }`,
  "@/lib/analytics/events": `import { state } from "fixture-state";
    export async function recordProductEvent(event) {
      // product_events upsert: onConflict "id", ignoreDuplicates.
      if (!state.rows.has(event.eventId)) state.rows.set(event.eventId, event)
    }`,
  "@/lib/security/customer-session-secret": `export function requiredCustomerSessionSecret() {
    return ${JSON.stringify(SECRET)}
  }`,
  "@/lib/security/rate-limit": `export class RateLimitError extends Error {}
    export function customerRateLimitIdentityFromHeaders() { return "identity" }
    export function customerDeviceHashFromHeaders() { return "device" }
    export function trustedClientIp() { return "127.0.0.1" }`,
  "@/lib/legal/content": 'export const CUSTOMER_LEGAL_VERSION = "test"',
  "@/lib/observability/logger":
    "export const logger = { error() {}, warn() {}, info() {} }",
}

const IMPORT_PATTERN = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g

/** Named value imports per specifier, read from the modules under test. */
function importedNames(files) {
  const names = new Map()
  for (const file of files) {
    const source = readFileSync(file, "utf8")
    for (const [, list, specifier] of source.matchAll(IMPORT_PATTERN)) {
      const set = names.get(specifier) ?? new Set()
      for (const raw of list.split(",")) {
        const name = raw.trim().split(/\s+as\s+/)[0]
        if (name && !name.startsWith("type ")) set.add(name)
      }
      names.set(specifier, set)
    }
  }
  return names
}

/** Every other stubbed import becomes a call answered from `state.impl`. */
function stubModule(specifier, names) {
  if (specifier in SPECIAL) return SPECIAL[specifier]
  const exports = [...names].map(
    (name) => `export async function ${name}(...args) {
      const impl = state.impl[${JSON.stringify(name)}];
      return typeof impl === "function" ? impl(...args) : impl
    }`
  )
  return `import { state } from "fixture-state";\n${exports.join("\n")}`
}

const STATE = `export const state = {
  token: "", after: [], rows: new Map(), impl: {},
};`

async function loadJoinActions() {
  const root = process.cwd()
  const joinDir = path.join(root, "app", "m", "[merchantSlug]", "join")
  const names = importedNames([
    path.join(joinDir, "actions.ts"),
    path.join(joinDir, "email-actions.ts"),
  ])
  const result = await build({
    stdin: {
      contents: `export * from "./app/m/[merchantSlug]/join/actions.ts";
        export {
          verifyCustomerEmailOtpAction,
          startEmailWalletAction,
          switchJoinToPhoneAction,
        } from "./app/m/[merchantSlug]/join/email-actions.ts";
        export { issueFunnelToken } from "@/lib/analytics/funnel-token";
        export { state } from "fixture-state";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "join-funnel-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\/lib\// }, ({ path: specifier }) =>
            REAL.has(specifier)
              ? { path: path.join(root, `${specifier.slice(2)}.ts`) }
              : { path: specifier, namespace: "fixture" }
          )
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/)/ },
            ({ path: specifier }) => ({ path: specifier, namespace: "fixture" })
          )
          build.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path: id }) => ({
              contents:
                id === "fixture-state"
                  ? STATE
                  : stubModule(id, names.get(id) ?? new Set()),
              resolveDir: root,
            })
          )
        },
      },
    ],
  })
  const actions = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
  )
  // One browser journey: one signed funnel token for every request in it.
  actions.state.token = actions.issueFunnelToken(randomUUID(), SECRET)
  return actions
}

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries({
    merchantSlug: "old-crown",
    qrId: "venue-qr",
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
  assert.fail("Expected a redirect")
}

/** Runs the after-response work, then reads what product_events kept. */
async function storedFunnel(state) {
  for (const task of state.after.splice(0)) await task()
  return [...state.rows.values()].map(({ eventName, metadata }) => ({
    eventName,
    step: metadata.step,
    method: metadata.method,
  }))
}

function verifiedEvents(rows) {
  return rows.filter(({ eventName }) => eventName === "join_otp_verified")
}

const VERIFIED_EMAIL = {
  status: "verified",
  email: "guest@example.com",
  emailHmac: "b".repeat(64),
  retryChallenge: { challengeId: "retry" },
}

function phoneJoinStubs(state) {
  Object.assign(state.impl, {
    getPendingPhoneVerification: null,
    getMerchantJoinContext: {
      available: true,
      merchant: { id: "merchant-1" },
    },
    enforceCustomerOtpSendRateLimit: true,
    startCustomerPhoneVerification: { status: "sent", channel: "sms" },
    setPendingPhoneVerification: { issuedAt: 1_000 },
  })
}

async function joinByPhone(actions) {
  const { requestCustomerIdentityAction, verifyCustomerOtpAction, state } =
    actions
  phoneJoinStubs(state)
  await redirectOf(
    requestCustomerIdentityAction({}, form({ contact: "07400 900123" }))
  )
  Object.assign(state.impl, {
    getPendingPhoneVerification: {
      purpose: "join",
      phone: "+447400900123",
      country: "GB",
      phoneHmac: "a".repeat(64),
    },
    checkCustomerPhoneVerification: { status: "approved" },
    getOrCreateCustomerByVerifiedPhone: {
      customer: { id: "customer-1" },
      created: true,
    },
    establishCustomerSessionAfterVerifiedPhone: "authenticated",
  })
  return redirectOf(verifyCustomerOtpAction({}, form({ otp: "123456" })))
}

afterEach(() => {
  delete process.env.CUSTOMER_EMAIL_AUTH_MODE
})

test("Given a phone join When the number is sent and its code confirmed Then both funnel steps name the phone", async () => {
  const actions = await loadJoinActions()

  const destination = await joinByPhone(actions)

  assert.equal(destination, "/m/old-crown/join?qr=venue-qr&step=terms")
  assert.deepEqual(await storedFunnel(actions.state), [
    { eventName: "join_phone_requested", step: "phone", method: "phone" },
    { eventName: "join_otp_verified", step: "otp", method: "phone" },
  ])
})

test("Given mode existing and a new email is confirmed When the guest goes back to their phone and confirms its code Then the one stored verification is by phone", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "existing"
  const actions = await loadJoinActions()
  const { verifyCustomerEmailOtpAction, switchJoinToPhoneAction, state } =
    actions
  Object.assign(state.impl, {
    checkEmailSignInChallenge: VERIFIED_EMAIL,
    findCustomerByVerifiedEmail: null,
  })

  assert.equal(
    await redirectOf(verifyCustomerEmailOtpAction({}, form({ otp: "123456" }))),
    "/m/old-crown/join?qr=venue-qr&step=email_choice"
  )
  // "Use my mobile number" on the no-card-for-this-email screen (J7).
  assert.equal(
    await redirectOf(switchJoinToPhoneAction(form({}))),
    "/m/old-crown/join?qr=venue-qr&step=phone"
  )
  assert.equal(
    await joinByPhone(actions),
    "/m/old-crown/join?qr=venue-qr&step=terms"
  )

  const rows = await storedFunnel(state)
  assert.deepEqual(verifiedEvents(rows), [
    { eventName: "join_otp_verified", step: "otp", method: "phone" },
  ])
  assert.deepEqual(
    rows.find(({ eventName }) => eventName === "join_email_no_wallet"),
    { eventName: "join_email_no_wallet", step: "email_choice", method: "email" }
  )
})

test("Given mode full and a new email is confirmed When the code step creates the wallet Then it stores one verification by email and the new-wallet confirmation", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const actions = await loadJoinActions()
  const { verifyCustomerEmailOtpAction, state } = actions
  Object.assign(state.impl, {
    checkEmailSignInChallenge: VERIFIED_EMAIL,
    findCustomerByVerifiedEmail: null,
    getMerchantJoinContext: {
      available: true,
      merchant: { id: "merchant-1" },
    },
    createCustomerByVerifiedEmail: {
      status: "created",
      customer: { id: "customer-new", phoneLast4: null },
    },
    establishCustomerSessionAfterVerifiedEmail: "authenticated",
  })

  // No choice screen: the code step goes straight to the terms step.
  assert.equal(
    await redirectOf(verifyCustomerEmailOtpAction({}, form({ otp: "123456" }))),
    "/m/old-crown/join?qr=venue-qr&step=terms"
  )

  const rows = await storedFunnel(state)
  assert.deepEqual(
    rows.map(({ eventName }) => eventName),
    ["join_otp_verified", "join_new_email_wallet_confirmed"]
  )
  assert.deepEqual(verifiedEvents(rows), [
    { eventName: "join_otp_verified", step: "otp", method: "email" },
  ])
})

test("Given a wallet start that failed to sign in When it is retried Then the verification is still stored once", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const actions = await loadJoinActions()
  const { startEmailWalletAction, state } = actions
  let sessionAttempts = 0
  Object.assign(state.impl, {
    readVerifiedEmailHandoff: {
      handoffId: "handoff-1",
      email: "guest@example.com",
      issuedAt: 1_000,
      expiresAt: 9_999_999_999,
    },
    getMerchantJoinContext: {
      available: true,
      merchant: { id: "merchant-1" },
    },
    consumeVerifiedEmailHandoff: true,
    reissueVerifiedEmailHandoff: (spent) => ({
      ...spent,
      handoffId: "handoff-2",
    }),
    createCustomerByVerifiedEmail: {
      status: "created",
      customer: { id: "customer-new", phoneLast4: null },
    },
    establishCustomerSessionAfterVerifiedEmail: () => {
      sessionAttempts += 1
      if (sessionAttempts === 1) throw new Error("session unavailable")
      return "authenticated"
    },
  })

  const failed = await startEmailWalletAction({}, form({}))
  assert.match(failed.errors.form, /couldn't sign you in/i)
  state.impl.createCustomerByVerifiedEmail = {
    status: "existing",
    customer: { id: "customer-new", phoneLast4: null },
  }
  await redirectOf(startEmailWalletAction({}, form({})))

  assert.deepEqual(verifiedEvents(await storedFunnel(state)), [
    { eventName: "join_otp_verified", step: "otp", method: "email" },
  ])
})

test("Given an email a wallet already holds When its code is confirmed Then the one verification is by email", async () => {
  process.env.CUSTOMER_EMAIL_AUTH_MODE = "full"
  const actions = await loadJoinActions()
  const { verifyCustomerEmailOtpAction, state } = actions
  Object.assign(state.impl, {
    checkEmailSignInChallenge: VERIFIED_EMAIL,
    findCustomerByVerifiedEmail: { id: "customer-1", phoneLast4: null },
    establishCustomerSessionAfterVerifiedEmail: "authenticated",
    destinationForReturningQrVisit: null,
  })

  await redirectOf(verifyCustomerEmailOtpAction({}, form({ otp: "123456" })))

  assert.deepEqual(verifiedEvents(await storedFunnel(state)), [
    { eventName: "join_otp_verified", step: "otp", method: "email" },
  ])
})
