import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import path from "node:path"
import { afterEach, beforeEach, test } from "node:test"
import { build } from "esbuild"

import {
  emailSignInCodeHmac,
  readPendingEmailSignInCookieValue,
} from "@/lib/customer/email-sign-in-core"

/**
 * Signed-out email sign-in, driven through the real module with its request,
 * database and provider boundaries stubbed. The codec, the dev-code rule and
 * the cookie encryption are the real ones.
 */

const SECRET = "s".repeat(48)
const DEVICE = "device-1"
const DEVICE_HASH = createHash("sha256")
  .update(`customer-device:${DEVICE}`)
  .digest("hex")
const REAL = [
  "@/lib/customer/dev-otp-core",
  "@/lib/customer/email-pii-core",
  "@/lib/customer/email-sign-in-core",
  "@/lib/customer/pending-cookie-crypto",
  "@/lib/notifications/provider-delivery-error",
]

const STATE = `export const state = {
  cookies: new Map(),
  headers: new Headers(),
  cleared: [],
  admission: null,
  rpcCalls: [],
  sends: [],
  sendError: null,
  logs: [],
  events: [],
  buckets: new Map(),
  limits: [],
};`

const STUBS = {
  "fixture-state": STATE,
  "server-only": "",
  "next/headers": `import { state } from "fixture-state";
    export async function headers() { return state.headers }
    export async function cookies() {
      return {
        get(name) { return state.cookies.has(name) ? { name, value: state.cookies.get(name) } : undefined },
        set(name, value) { state.cookies.set(name, value) },
        delete(name) { state.cookies.delete(name); state.cleared.push(name) },
      }
    }`,
  "@/lib/customer/contact-events": `import { state } from "fixture-state";
    export function recordCustomerContactEvent(input) { state.events.push(input) }`,
  "@/lib/customer/profile-fields":
    "export function isEmailAddress(raw) { return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(raw) }",
  "@/lib/customer/session": `import { state } from "fixture-state";
    export async function clearPendingPhoneVerification() { state.cleared.push("phone") }`,
  "@/lib/http/persistent-cookie-options":
    "export function persistentCookieOptions(maxAge) { return { maxAge } }",
  "@/lib/notifications/resend": `import { state } from "fixture-state";
    export async function sendEmailOtp(input) { state.sends.push(input); if (state.sendError) throw state.sendError }`,
  "@/lib/observability/logger": `import { state } from "fixture-state";
    const log = (level) => (message, context) => state.logs.push({ level, message, context });
    export const logger = { info: log("info"), warn: log("warn"), error: log("error") }`,
  "@/lib/security/customer-session-secret": `export function requiredCustomerSessionSecret() { return "${SECRET}" }`,
  "@/lib/security/rate-limit": `import { state } from "fixture-state";
    import { createHash } from "node:crypto";
    export class RateLimitError extends Error {}
    export function rateLimitBucketHash(key) { return createHash("sha256").update(key).digest("hex") }
    export function customerDeviceHashFromHeaders(headers) {
      const device = headers.get("x-nabaperks-device-id");
      return device ? createHash("sha256").update("customer-device:" + device).digest("hex") : null
    }
    export function customerRateLimitIdentityFromHeaders() { return "identity-1" }
    export function trustedClientIp() { return "203.0.113.9" }
    export async function enforceRateLimit({ key, limit, windowMs }) {
      state.limits.push({ key, limit, windowMs });
      const used = state.buckets.get(key) ?? 0;
      if (used >= limit) throw new RateLimitError("rate limit exceeded");
      state.buckets.set(key, used + 1)
    }`,
  "@/lib/supabase/server": `import { state } from "fixture-state";
    export function createSupabaseServiceRoleClient() {
      return { async rpc(name, args) { state.rpcCalls.push({ name, args }); return { error: state.admission } } }
    }`,
}

async function loadModule() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents:
        'export * from "./lib/customer/email-sign-in.ts"; export { state } from "fixture-state"; export { DefinitiveProviderRejectionError } from "@/lib/notifications/provider-delivery-error";',
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "email-sign-in-boundaries",
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
  const mod = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
  mod.state.headers.set("x-nabaperks-device-id", DEVICE)
  return mod
}

function pendingCookie(mod) {
  const value = mod.state.cookies.get(mod.pendingEmailSignInCookieName)
  assert.ok(value, "pending email sign-in cookie is set")
  const read = readPendingEmailSignInCookieValue(
    value,
    SECRET,
    Math.floor(Date.now() / 1000)
  )
  assert.equal(read.ok, true)
  return read.payload
}

beforeEach(() => {
  process.env.CUSTOMER_EMAIL_HMAC_SECRET = "h".repeat(48)
  delete process.env.CUSTOMER_DEV_OTP_CODE
  delete process.env.VERCEL_ENV
})

afterEach(() => {
  delete process.env.CUSTOMER_EMAIL_HMAC_SECRET
  delete process.env.CUSTOMER_DEV_OTP_CODE
  delete process.env.VERCEL_ENV
})

test("Given an admitted send When a join challenge starts Then the emailed code is the one bound in the cookie", async () => {
  const mod = await loadModule()
  const result = await mod.startEmailSignInChallenge({
    email: " Guest@Example.com ",
    purpose: "join",
    merchantId: "merchant-1",
  })

  assert.equal(result.status, "code_sent")
  assert.equal(result.maskedEmail, "g***@example.com")
  const payload = pendingCookie(mod)
  assert.equal(payload.purpose, "join")
  assert.equal(payload.email, "guest@example.com")
  assert.equal(mod.state.sends.length, 1)
  const [send] = mod.state.sends
  assert.equal(send.to, "guest@example.com")
  assert.equal(send.idempotencyKey, payload.challengeId)
  assert.equal(
    emailSignInCodeHmac({
      secret: SECRET,
      purpose: "join",
      challengeId: payload.challengeId,
      email: payload.email,
      code: send.code,
    }),
    payload.codeHmac
  )
  // Only one sign-in challenge per browser.
  assert.ok(mod.state.cleared.includes("phone"))
  assert.ok(mod.state.cleared.includes(mod.verifiedEmailHandoffCookieName))

  const [rpc] = mod.state.rpcCalls
  assert.equal(rpc.name, "admit_anonymous_customer_email_otp_send")
  const buckets = Object.values(rpc.args)
  assert.equal(buckets.length, 6)
  assert.equal(new Set(buckets).size, 6)
  for (const bucket of buckets) assert.match(bucket, /^[0-9a-f]{64}$/)
  assert.equal(
    rpc.args.p_cooldown_bucket,
    createHash("sha256")
      .update("customer-email-otp:cooldown:guest@example.com")
      .digest("hex")
  )
  assert.doesNotMatch(JSON.stringify(rpc.args), /guest|example/)
})

test("Given admission refuses When a challenge starts Then the answer and cookie look the same and nothing is sent", async () => {
  const mod = await loadModule()
  mod.state.admission = { message: "rate limit exceeded" }
  const result = await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })

  assert.equal(result.status, "code_sent")
  assert.equal(pendingCookie(mod).email, "guest@example.com")
  assert.deepEqual(mod.state.sends, [])
  assert.deepEqual(mod.state.events, [])
})

test("Given a code already on its way When the same address is submitted again Then the challenge is kept, not replaced", async () => {
  const mod = await loadModule()
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  const first = pendingCookie(mod)
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })

  assert.equal(pendingCookie(mod).challengeId, first.challengeId)
  assert.equal(mod.state.rpcCalls.length, 1)
  assert.equal(mod.state.sends.length, 1)
})

test("Given the provider rejects When a code is sent Then only a category is logged and the failure is tracked", async () => {
  const mod = await loadModule()
  mod.state.sendError = new mod.DefinitiveProviderRejectionError(
    'Resend send failed (422): {"to":"guest@example.com"}'
  )
  const result = await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
    merchantId: "merchant-1",
  })

  assert.equal(result.status, "delivery_failed")
  // The challenge stays, so a late email can still be used.
  assert.equal(pendingCookie(mod).email, "guest@example.com")
  const failure = mod.state.logs.find(
    (log) => log.message === "customer_email_sign_in_send_failed"
  )
  assert.deepEqual(failure.context, {
    purpose: "join",
    category: "provider_rejected_422",
  })
  assert.doesNotMatch(JSON.stringify(mod.state.logs), /guest@example\.com/)
  assert.deepEqual(mod.state.events, [
    {
      eventName: "join_code_send_failed",
      merchantId: "merchant-1",
      metadata: {
        method: "email",
        surface: "join",
        reason: "provider_unavailable",
      },
    },
  ])
})

test("Given a wallet sign-in send fails When tracked Then it is the login send failure", async () => {
  const mod = await loadModule()
  mod.state.sendError = new Error("network")
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "wallet",
  })
  assert.equal(mod.state.events[0].eventName, "customer_login_code_send_failed")
  assert.equal(mod.state.events[0].metadata.surface, "home_login")
})

test("Given an invalid address When a challenge starts Then nothing is admitted, set or sent", async () => {
  const mod = await loadModule()
  const result = await mod.startEmailSignInChallenge({
    email: "not-an-email",
    purpose: "join",
  })
  assert.deepEqual(result, { status: "invalid_email" })
  assert.equal(mod.state.rpcCalls.length, 0)
  assert.equal(mod.state.cookies.size, 0)
})

test("Given a local dev code When a challenge starts and is checked Then no email is sent and the dev code verifies", async () => {
  process.env.CUSTOMER_DEV_OTP_CODE = "424242"
  const mod = await loadModule()
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  assert.deepEqual(mod.state.sends, [])

  const result = await mod.checkEmailSignInChallenge({
    code: "424242",
    purpose: "join",
  })
  assert.equal(result.status, "verified")
  assert.equal(result.email, "guest@example.com")
})

test("Given a Vercel preview When a dev code is configured Then the email is sent and the dev code is refused", async () => {
  process.env.CUSTOMER_DEV_OTP_CODE = "424242"
  process.env.VERCEL_ENV = "preview"
  const mod = await loadModule()
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  assert.equal(mod.state.sends.length, 1)

  const sent = mod.state.sends[0].code
  const guess = sent === "424242" ? "424243" : "424242"
  const result = await mod.checkEmailSignInChallenge({
    code: guess,
    purpose: "join",
  })
  assert.deepEqual(result, { status: "invalid_code" })
})

test("Given wrong guesses When the code is checked Then single use is spent only by the match", async () => {
  const mod = await loadModule()
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  const { challengeId } = pendingCookie(mod)
  const cookieValue = mod.state.cookies.get(mod.pendingEmailSignInCookieName)
  const code = mod.state.sends[0].code
  const wrong = code === "000000" ? "000001" : "000000"
  const consumedKey = `email-sign-in:consumed:${challengeId}`

  assert.deepEqual(
    await mod.checkEmailSignInChallenge({ code: wrong, purpose: "join" }),
    { status: "invalid_code" }
  )
  assert.equal(mod.state.buckets.has(consumedKey), false)
  // A malformed code is not a guess and spends nothing.
  const before = mod.state.limits.length
  assert.deepEqual(
    await mod.checkEmailSignInChallenge({ code: "12", purpose: "join" }),
    { status: "invalid_code" }
  )
  assert.equal(mod.state.limits.length, before)

  const verified = await mod.checkEmailSignInChallenge({
    code,
    purpose: "join",
  })
  assert.equal(verified.status, "verified")
  assert.equal(mod.state.buckets.get(consumedKey), 1)
  assert.equal(mod.state.cookies.has(mod.pendingEmailSignInCookieName), false)

  // Replaying the same cookie after success is refused.
  mod.state.cookies.set(mod.pendingEmailSignInCookieName, cookieValue)
  assert.deepEqual(
    await mod.checkEmailSignInChallenge({ code, purpose: "join" }),
    {
      status: "expired",
    }
  )
})

test("Given the per-challenge limit When a sixth guess arrives Then it is rate limited", async () => {
  const mod = await loadModule()
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  const code = mod.state.sends[0].code
  const wrong = code === "000000" ? "000001" : "000000"
  for (let i = 0; i < 5; i += 1) {
    assert.equal(
      (await mod.checkEmailSignInChallenge({ code: wrong, purpose: "join" }))
        .status,
      "invalid_code"
    )
  }
  assert.deepEqual(
    await mod.checkEmailSignInChallenge({ code, purpose: "join" }),
    {
      status: "rate_limited",
    }
  )
  const keys = new Set(
    mod.state.limits.map((limit) => limit.key.split(":").slice(0, 3).join(":"))
  )
  assert.deepEqual([...keys].sort(), [
    "email-sign-in:verify:challenge",
    "email-sign-in:verify:device",
    "email-sign-in:verify:email",
  ])
})

test("Given a challenge for another purpose or none When checked Then it has expired", async () => {
  const mod = await loadModule()
  assert.deepEqual(
    await mod.checkEmailSignInChallenge({ code: "123456", purpose: "join" }),
    {
      status: "expired",
    }
  )
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "wallet",
  })
  assert.deepEqual(
    await mod.checkEmailSignInChallenge({
      code: mod.state.sends[0].code,
      purpose: "join",
    }),
    { status: "expired" }
  )
})

test("Given a verified-email handoff When read back Then only this device, venue and QR see it", async () => {
  const mod = await loadModule()
  const payload = await mod.setVerifiedEmailHandoff({
    email: "guest@example.com",
    emailHmac: "a".repeat(64),
    merchantSlug: "old-crown",
    qrId: "venue-qr",
  })
  assert.equal(payload.deviceHash, DEVICE_HASH)

  assert.equal(
    (
      await mod.readVerifiedEmailHandoff({
        merchantSlug: "old-crown",
        qrId: "venue-qr",
      })
    )?.email,
    "guest@example.com"
  )
  assert.equal(
    await mod.readVerifiedEmailHandoff({
      merchantSlug: "the-bell",
      qrId: "venue-qr",
    }),
    null
  )
  assert.equal(
    await mod.readVerifiedEmailHandoff({
      merchantSlug: "old-crown",
      qrId: undefined,
    }),
    null
  )
  mod.state.headers.set("x-nabaperks-device-id", "device-2")
  assert.equal(
    await mod.readVerifiedEmailHandoff({
      merchantSlug: "old-crown",
      qrId: "venue-qr",
    }),
    null
  )

  mod.state.headers.delete("x-nabaperks-device-id")
  await assert.rejects(
    mod.setVerifiedEmailHandoff({
      email: "guest@example.com",
      emailHmac: "a".repeat(64),
      merchantSlug: "old-crown",
      qrId: null,
    }),
    /device is required/
  )
})
