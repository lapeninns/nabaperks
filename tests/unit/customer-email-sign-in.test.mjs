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

async function withClockAhead(seconds, run) {
  const realNow = Date.now
  Date.now = () => realNow() + seconds * 1000
  try {
    await run()
  } finally {
    Date.now = realNow
  }
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
  assert.equal(pendingCookie(mod).delivery, "held")
  assert.deepEqual(mod.state.sends, [])
  assert.deepEqual(mod.state.events, [])

  // Same size as the cookie an admitted send sets for the same address.
  const admitted = await loadModule()
  await admitted.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  assert.equal(
    mod.state.cookies.get(mod.pendingEmailSignInCookieName).length,
    admitted.state.cookies.get(admitted.pendingEmailSignInCookieName).length
  )
})

test("Given a refused send When its challenge is checked Then no code verifies it and the address is not charged", async () => {
  // The local dev code verifies any sent challenge, so it is the strongest
  // guess there is; a held challenge refuses even that.
  process.env.CUSTOMER_DEV_OTP_CODE = "424242"
  const mod = await loadModule()
  mod.state.admission = { message: "rate limit exceeded" }
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  const held = pendingCookie(mod)

  for (const code of ["424242", "000000", "123456"]) {
    assert.deepEqual(
      await mod.checkEmailSignInChallenge({ code, purpose: "join" }),
      { status: "invalid_code" }
    )
  }
  assert.equal(
    mod.state.buckets.has(`email-sign-in:consumed:${held.challengeId}`),
    false
  )
  const charged = new Set(
    mod.state.limits.map((limit) => limit.key.split(":").slice(0, 3).join(":"))
  )
  assert.deepEqual([...charged].sort(), [
    "email-sign-in:verify:challenge",
    "email-sign-in:verify:device",
    "email-sign-in:verify:ip",
  ])
  // Guesses against it still count towards the challenge's own limit.
  assert.equal(
    mod.state.buckets.get(`email-sign-in:verify:challenge:${held.challengeId}`),
    3
  )
})

test("Given a refused resend of a code already sent When checked Then the emailed code still works", async () => {
  const mod = await loadModule()
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  const code = mod.state.sends[0].code
  await withClockAhead(61, async () => {
    mod.state.admission = { message: "rate limit exceeded" }
    const again = await mod.startEmailSignInChallenge({
      email: "guest@example.com",
      purpose: "join",
    })
    assert.equal(again.status, "code_sent")
    assert.equal(pendingCookie(mod).delivery, "sent")
    assert.equal(
      (await mod.checkEmailSignInChallenge({ code, purpose: "join" })).status,
      "verified"
    )
  })
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

test("Given a failed send When the guest retries at once Then it is never reported as a code on its way", async () => {
  const mod = await loadModule()
  mod.state.sendError = new Error("Resend send failed (503)")
  const first = await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  assert.equal(first.status, "delivery_failed")
  assert.equal(pendingCookie(mod).delivery, "fail")

  // Within the resend window: the same honest answer, and no second send
  // for the recipient cooldown to refuse.
  mod.state.sendError = null
  const retry = await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  assert.equal(retry.status, "delivery_failed")
  assert.equal(retry.resendAvailableAt, first.resendAvailableAt)
  assert.equal(mod.state.rpcCalls.length, 1)
  assert.equal(mod.state.sends.length, 1)

  // Once it may be resent, the retry goes back through admission and sends.
  await withClockAhead(61, async () => {
    const later = await mod.startEmailSignInChallenge({
      email: "guest@example.com",
      purpose: "join",
    })
    assert.equal(later.status, "code_sent")
    assert.equal(mod.state.rpcCalls.length, 2)
    assert.equal(mod.state.sends.length, 2)
    assert.equal(pendingCookie(mod).delivery, "sent")
  })
})

test("Given a phone code pending When the email fallback's first send fails Then the phone code is kept, and only a code on its way replaces it", async () => {
  const mod = await loadModule()
  mod.state.sendError = new Error("Resend send failed (503)")
  const failed = await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  assert.equal(failed.status, "delivery_failed")
  assert.equal(pendingCookie(mod).delivery, "fail")
  // No email is on its way, so "Use my phone number instead" still has the
  // phone code to return to.
  assert.ok(!mod.state.cleared.includes("phone"))

  // A refused send reads as sent (D8), so it replaces the phone code too.
  const refused = await loadModule()
  refused.state.admission = { message: "rate limit exceeded" }
  await refused.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  assert.ok(refused.state.cleared.includes("phone"))

  // Once a code is on its way, one sign-in stays live per browser.
  await withClockAhead(61, async () => {
    mod.state.sendError = null
    const sent = await mod.startEmailSignInChallenge({
      email: "guest@example.com",
      purpose: "join",
    })
    assert.equal(sent.status, "code_sent")
    assert.ok(mod.state.cleared.includes("phone"))
  })
})

test("Given a code already delivered When a resend fails Then that earlier code keeps working and is not called delayed", async () => {
  const mod = await loadModule()
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  const earlier = pendingCookie(mod)
  const sentCookie = mod.state.cookies.get(mod.pendingEmailSignInCookieName)
  const code = mod.state.sends[0].code

  await withClockAhead(61, async () => {
    mod.state.sendError = new Error("network")
    const resend = await mod.startEmailSignInChallenge({
      email: "guest@example.com",
      purpose: "join",
    })
    // The failed attempt is reported in place, with a renewed cooldown.
    assert.equal(resend.status, "delivery_failed")
    const kept = pendingCookie(mod)
    assert.equal(resend.resendAvailableAt, kept.resendAvailableAt)
    assert.ok(kept.resendAvailableAt > earlier.resendAvailableAt)
    assert.equal(kept.challengeId, earlier.challengeId)
    // Code A arrived, so a refresh must not say "Not sent yet" (the join
    // loader marks only `fail` as delayed).
    assert.equal(kept.delivery, "sent")
    assert.equal(
      mod.state.cookies.get(mod.pendingEmailSignInCookieName).length,
      sentCookie.length
    )
    assert.equal(
      (await mod.checkEmailSignInChallenge({ code, purpose: "join" })).status,
      "verified"
    )
  })
})

test("Given a refused send When the resend after it fails Then the page still reads as sent and a late email works", async () => {
  const mod = await loadModule()
  mod.state.admission = { message: "rate limit exceeded" }
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  assert.equal(pendingCookie(mod).delivery, "held")

  await withClockAhead(61, async () => {
    mod.state.admission = null
    mod.state.sendError = new Error("network")
    const resend = await mod.startEmailSignInChallenge({
      email: "guest@example.com",
      purpose: "join",
    })
    assert.equal(resend.status, "delivery_failed")
    // Exactly what a failed resend after a delivered code keeps (D8).
    assert.equal(pendingCookie(mod).delivery, "sent")
    assert.equal(
      (
        await mod.checkEmailSignInChallenge({
          code: mod.state.sends[0].code,
          purpose: "join",
        })
      ).status,
      "verified"
    )
  })
})

test("Given a verified-email handoff When it is spent Then only the first use succeeds", async () => {
  const mod = await loadModule()
  const handoff = await mod.setVerifiedEmailHandoff({
    email: "guest@example.com",
    emailHmac: "a".repeat(64),
    merchantSlug: "old-crown",
    qrId: null,
  })
  assert.match(handoff.handoffId, /^[0-9a-f-]{36}$/)
  assert.equal(await mod.consumeVerifiedEmailHandoff(handoff), true)
  assert.equal(await mod.consumeVerifiedEmailHandoff(handoff), false)
  const other = await mod.setVerifiedEmailHandoff({
    email: "guest@example.com",
    emailHmac: "a".repeat(64),
    merchantSlug: "old-crown",
    qrId: null,
  })
  assert.notEqual(other.handoffId, handoff.handoffId)
  assert.equal(await mod.consumeVerifiedEmailHandoff(other), true)
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
    "email-sign-in:verify:ip",
  ])
  const ip = mod.state.limits.find((limit) =>
    limit.key.startsWith("email-sign-in:verify:ip:")
  )
  assert.equal(ip.key, "email-sign-in:verify:ip:203.0.113.9")
  assert.equal(ip.limit, mod.EMAIL_SIGN_IN_IP_GUESS_LIMIT)
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

test("Given a matched code When the sign-in after it fails and the code is kept Then the same code works once more and the spent cookie stays refused", async () => {
  const mod = await loadModule()
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  const original = pendingCookie(mod)
  const spentCookie = mod.state.cookies.get(mod.pendingEmailSignInCookieName)
  const code = mod.state.sends[0].code

  const verified = await mod.checkEmailSignInChallenge({
    code,
    purpose: "join",
  })
  assert.equal(verified.status, "verified")
  // Spent and cleared unless the caller keeps it.
  assert.equal(mod.state.cookies.has(mod.pendingEmailSignInCookieName), false)

  await mod.keepEmailSignInForRetry(verified)
  const kept = pendingCookie(mod)
  assert.notEqual(kept.challengeId, original.challengeId)
  assert.equal(kept.expiresAt, original.expiresAt)
  assert.equal(kept.email, original.email)
  assert.equal(kept.purpose, "join")
  // No code is ever stored, only its digest under the new challenge.
  assert.equal(Object.values(verified.retryChallenge).includes(code), false)
  assert.equal(
    emailSignInCodeHmac({
      secret: SECRET,
      purpose: "join",
      challengeId: kept.challengeId,
      email: kept.email,
      code,
    }),
    kept.codeHmac
  )

  // A copy of the spent cookie is still refused.
  const keptCookie = mod.state.cookies.get(mod.pendingEmailSignInCookieName)
  mod.state.cookies.set(mod.pendingEmailSignInCookieName, spentCookie)
  assert.deepEqual(
    await mod.checkEmailSignInChallenge({ code, purpose: "join" }),
    { status: "expired" }
  )

  // The kept challenge verifies the same code once, then it is spent too.
  mod.state.cookies.set(mod.pendingEmailSignInCookieName, keptCookie)
  const retried = await mod.checkEmailSignInChallenge({ code, purpose: "join" })
  assert.equal(retried.status, "verified")
  assert.equal(
    mod.state.buckets.get(`email-sign-in:consumed:${kept.challengeId}`),
    1
  )
  mod.state.cookies.set(mod.pendingEmailSignInCookieName, keptCookie)
  assert.deepEqual(
    await mod.checkEmailSignInChallenge({ code, purpose: "join" }),
    { status: "expired" }
  )
})

test("Given a first send that failed When its late code matches but the sign-in fails Then the restored code is not called delayed", async () => {
  const mod = await loadModule()
  mod.state.sendError = new Error("network")
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  assert.equal(pendingCookie(mod).delivery, "fail")
  const failedCookie = mod.state.cookies.get(mod.pendingEmailSignInCookieName)

  // The email arrived late and its code matched, proving delivery.
  const code = mod.state.sends[0].code
  const verified = await mod.checkEmailSignInChallenge({
    code,
    purpose: "join",
  })
  assert.equal(verified.status, "verified")
  assert.equal(verified.retryChallenge.delivery, "sent")

  await mod.keepEmailSignInForRetry(verified)
  assert.equal(pendingCookie(mod).delivery, "sent")
  assert.equal(
    mod.state.cookies.get(mod.pendingEmailSignInCookieName).length,
    failedCookie.length
  )
  assert.equal(
    (await mod.checkEmailSignInChallenge({ code, purpose: "join" })).status,
    "verified"
  )
})

test("Given a kept code When its challenge has expired Then nothing is restored", async () => {
  const mod = await loadModule()
  await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "join",
  })
  const verified = await mod.checkEmailSignInChallenge({
    code: mod.state.sends[0].code,
    purpose: "join",
  })
  await withClockAhead(11 * 60, async () => {
    await mod.keepEmailSignInForRetry(verified)
  })
  assert.equal(mod.state.cookies.has(mod.pendingEmailSignInCookieName), false)
})

test("Given a spent handoff When it is re-issued Then only the new ID is usable, with the same binding and expiry", async () => {
  const mod = await loadModule()
  const spent = await mod.setVerifiedEmailHandoff({
    email: "guest@example.com",
    emailHmac: "a".repeat(64),
    merchantSlug: "old-crown",
    qrId: "venue-qr",
  })
  assert.equal(await mod.consumeVerifiedEmailHandoff(spent), true)

  const reissued = await mod.reissueVerifiedEmailHandoff(spent)
  assert.notEqual(reissued.handoffId, spent.handoffId)
  assert.deepEqual(
    { ...reissued, handoffId: spent.handoffId },
    spent,
    "binding, issue time and expiry are unchanged"
  )
  const read = await mod.readVerifiedEmailHandoff({
    merchantSlug: "old-crown",
    qrId: "venue-qr",
  })
  assert.equal(read.handoffId, reissued.handoffId)

  assert.equal(await mod.consumeVerifiedEmailHandoff(spent), false)
  assert.equal(await mod.consumeVerifiedEmailHandoff(reissued), true)
  assert.equal(await mod.consumeVerifiedEmailHandoff(reissued), false)

  await withClockAhead(11 * 60, async () => {
    assert.equal(await mod.reissueVerifiedEmailHandoff(reissued), null)
  })
})

test("Given email identity is not configured When a challenge starts Then the guest gets the could-not-send answer, not an error (QA BUG-016)", async () => {
  delete process.env.CUSTOMER_EMAIL_HMAC_SECRET
  const mod = await loadModule()
  const result = await mod.startEmailSignInChallenge({
    email: "guest@example.com",
    purpose: "wallet",
  })
  assert.equal(result.status, "delivery_failed")
  assert.equal(result.maskedEmail, "g***@example.com")
  assert.equal(mod.state.rpcCalls.length, 0)
  assert.deepEqual(mod.state.sends, [])
  assert.equal(mod.state.cookies.size, 0)
  assert.deepEqual(mod.state.logs, [
    {
      level: "warn",
      message: "customer_email_sign_in_unavailable",
      context: { purpose: "wallet", category: "not_configured" },
    },
  ])
})
