import assert from "node:assert/strict"
import path from "node:path"
import { afterEach, beforeEach, test } from "node:test"
import { build } from "esbuild"

const savedEnvironment = {
  CUSTOMER_EMAIL_HMAC_SECRET: process.env.CUSTOMER_EMAIL_HMAC_SECRET,
  CUSTOMER_DEV_OTP_CODE: process.env.CUSTOMER_DEV_OTP_CODE,
}

beforeEach(() => {
  process.env.CUSTOMER_EMAIL_HMAC_SECRET =
    "recovery-unit-only-email-hmac-secret"
  delete process.env.CUSTOMER_DEV_OTP_CODE
})

afterEach(() => {
  for (const [name, value] of Object.entries(savedEnvironment)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

const REAL = [
  "@/lib/customer/access-continuity",
  "@/lib/customer/access-continuity-core",
  "@/lib/customer/email-pii-core",
]

const STUBS = {
  "fixture-state": `export const state = {
    calls: [], pending: null, customer: null, deviceHash: "device-1",
    sendFails: false, admissionFails: false, sessionSecretFails: false, deliveredCode: null,
    pendingAtDispatch: null, sessionCount: 0,
  };`,
  "server-only": "",
  "next/headers": "export async function headers() { return new Headers() }",
  "next/navigation": `export function redirect() { throw new Error("Unexpected redirect") }`,
  "@/lib/customer/session": `import { state } from "fixture-state";
    export async function getPendingAccessRecovery() { return state.pending }
    export async function setPendingAccessRecovery(input) {
      state.calls.push("replacePending");
      state.pending = { ...input, issuedAt: 1100, expiresAt: 1700 };
      return state.pending;
    }
    export async function clearPendingAccessRecovery() { state.calls.push("clearPending"); state.pending = null }
    export async function clearPendingPhoneVerification() { state.calls.push("clearPhone") }
    export async function setCustomerSession() { state.sessionCount += 1 }`,
  "@/lib/customer/email-otp-cooldown": `import { state } from "fixture-state";
    import { RateLimitError } from "@/lib/security/rate-limit";
    export async function enforceCustomerEmailOtpAdmission() {
      state.calls.push("admission");
      if (state.admissionFails) throw new RateLimitError();
    }`,
  "@/lib/notifications/resend": `import { state } from "fixture-state";
    export async function sendEmailOtp({ code }) {
      state.calls.push("send"); state.pendingAtDispatch = state.pending;
      if (state.sendFails) throw new Error("Synthetic email configuration rejection");
      state.deliveredCode = code;
    }`,
  "@/lib/security/customer-session-secret": `import { state } from "fixture-state";
    export function requiredCustomerSessionSecret() {
      if (state.sessionSecretFails) throw new Error("Synthetic missing signing configuration");
      return "recovery-unit-only-session-secret";
    }`,
  "@/lib/security/rate-limit": `import { state } from "fixture-state";
    export class RateLimitError extends Error {}
    export function customerDeviceHashFromHeaders() { return state.deviceHash }
    export async function enforceRateLimit() { state.calls.push("verifyLimit") }`,
  "@/lib/supabase/server": `import { state } from "fixture-state";
    export function createSupabaseServiceRoleClient() {
      return { from() { return { select() { return { eq() { return {
        async maybeSingle() { return { data: state.customer, error: null } }
      } } } } } } };
    }`,
}

async function loadRecovery() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents: `export * from "./app/home/recover/actions.ts";
        export * from "./lib/customer/access-continuity.ts";
        export * from "./lib/customer/access-continuity-core.ts";
        export * from "./lib/customer/email-pii-core.ts";
        export { state } from "fixture-state";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "recovery-boundaries",
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
  const recovery = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
  const email = "recovery-unit@example.test"
  const emailHmac = recovery.customerEmailHmac(email)
  recovery.state.customer = {
    id: "customer-1",
    email,
    email_hmac: emailHmac,
    email_verified_at: "2026-10-03T00:00:00Z",
    phone_hmac: "phone-1",
  }
  recovery.state.pending = {
    sessionId: "previous-session",
    customerId: "customer-1",
    phoneHmac: "phone-1",
    deviceHash: "device-1",
    emailHmac,
    codeHmac: recovery.customerAccessRecoveryCodeHmac({
      customerId: "customer-1",
      deviceHash: "device-1",
      email,
      code: "314159",
      secret: "recovery-unit-only-session-secret",
    }),
    next: "/home",
    issuedAt: 1000,
    expiresAt: 1600,
  }
  return recovery
}

test("Given a bound recovery When email resend fails Then feedback keeps the previous proof and expiry without a session", async () => {
  const recovery = await loadRecovery()
  const previous = recovery.state.pending
  recovery.state.sendFails = true

  const result = await recovery.resendCustomerAccessRecoveryAction({})

  assert.ok(result.errors?.form)
  assert.equal(result.message, undefined)
  assert.deepEqual(recovery.state.pending, previous)
  assert.deepEqual(recovery.state.calls, ["admission", "send"])
  assert.equal(recovery.state.sessionCount, 0)
})

test("Given a bound recovery When email resend succeeds Then only the delivered replacement code is accepted", async () => {
  const recovery = await loadRecovery()
  const previous = recovery.state.pending

  const result = await recovery.resendCustomerAccessRecoveryAction({})

  assert.ok(result.message)
  assert.equal(result.errors, undefined)
  assert.equal(recovery.state.pendingAtDispatch, previous)
  assert.notEqual(recovery.state.pending.sessionId, previous.sessionId)
  assert.equal(recovery.state.pending.next, previous.next)
  assert.equal(recovery.state.pending.deviceHash, previous.deviceHash)
  assert.equal(recovery.state.pending.phoneHmac, previous.phoneHmac)
  assert.equal(recovery.state.pending.emailHmac, previous.emailHmac)
  assert.equal(recovery.state.sessionCount, 0)
  const checked = await recovery.verifyCustomerAccessRecovery(
    recovery.state.deliveredCode
  )
  assert.equal(checked.status, "approved")
  assert.equal(checked.sessionId, recovery.state.pending.sessionId)
  const wrongCode =
    recovery.state.deliveredCode === "000000" ? "111111" : "000000"
  const wrongCheck = await recovery.verifyCustomerAccessRecovery(wrongCode)
  assert.equal(wrongCheck.status, "rejected")
})

test("Given a bound recovery When resend admission rejects Then its pending proof remains and no dispatch occurs", async () => {
  const recovery = await loadRecovery()
  const previous = recovery.state.pending
  recovery.state.admissionFails = true

  const result = await recovery.resendCustomerAccessRecoveryAction({})

  assert.ok(result.errors?.form)
  assert.equal(recovery.state.pending, previous)
  assert.deepEqual(recovery.state.calls, ["admission"])
  assert.equal(recovery.state.sessionCount, 0)
})

test("Given missing signing configuration When resend is requested Then no email is dispatched and the previous proof remains", async () => {
  const recovery = await loadRecovery()
  const previous = recovery.state.pending
  recovery.state.sessionSecretFails = true

  const result = await recovery.resendCustomerAccessRecoveryAction({})

  assert.ok(result.errors?.form)
  assert.equal(recovery.state.pending, previous)
  assert.deepEqual(recovery.state.calls, ["admission"])
  assert.equal(recovery.state.deliveredCode, null)
  assert.equal(recovery.state.sessionCount, 0)
})

for (const fault of ["device", "phone", "absent"]) {
  test(`Given ${fault} recovery proof When resend is requested Then no email or session is issued`, async () => {
    const recovery = await loadRecovery()
    if (fault === "device") recovery.state.deviceHash = "other-device"
    if (fault === "phone") recovery.state.customer.phone_hmac = "other-phone"
    if (fault === "absent") recovery.state.pending = null

    const result = await recovery.resendCustomerAccessRecoveryAction({})

    assert.ok(result.errors?.form)
    assert.equal(recovery.state.pending, null)
    assert.equal(recovery.state.deliveredCode, null)
    assert.equal(recovery.state.sessionCount, 0)
    assert.deepEqual(
      recovery.state.calls,
      fault === "absent" ? [] : ["clearPending"]
    )
  })
}
