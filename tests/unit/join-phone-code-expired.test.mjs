import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * Guest journey J3: once the pending phone code has expired, "Send a new code"
 * carries no number (a resend only ever goes to the pending code's number),
 * so it used to answer "Enter a valid phone number." for a field the guest
 * never saw. Both the resend and a verify against the expired code now send
 * the guest back to the number step with an expiry notice, keeping the scan
 * context (QR and referral). Nothing is sent and no limit is charged.
 *
 * The join actions are bundled with the real join-intent builder, phone
 * parser and OTP helpers; every other boundary is an auto-stub that records
 * its calls.
 */
const REAL = new Set([
  "@/lib/customer/phone",
  "@/lib/customer/experience/otp-field",
  "@/lib/customer/otp-channel-core",
  "@/lib/customer/phone-code-email-fallback",
  "@/lib/customer/join-observability-contract",
  "@/lib/navigation/customer-join-intent",
  "@/lib/observability/request-id",
])

const SPECIAL = {
  "server-only": "",
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }`,
  "next/headers": `export async function headers() {
      return new Headers({ "x-forwarded-for": "198.51.100.7", "user-agent": "unit" })
    }`,
  "next/server": "export function after() {}",
  "@/lib/legal/content": 'export const CUSTOMER_LEGAL_VERSION = "test"',
  "@/lib/observability/logger":
    "export const logger = { error() {}, warn() {}, info() {} }",
  "@/lib/security/rate-limit": `import { state } from "fixture-state";
    export class RateLimitError extends Error {}
    export function customerDeviceHashFromHeaders() { return "device" }
    export function customerRateLimitIdentityFromHeaders() { return "identity" }
    export function trustedClientIp() { return "198.51.100.7" }`,
}

const IMPORT_PATTERN = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g

function importedNames(file) {
  const names = new Map()
  const source = readFileSync(file, "utf8")
  for (const [, list, specifier] of source.matchAll(IMPORT_PATTERN)) {
    const set = names.get(specifier) ?? new Set()
    for (const raw of list.split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0]
      if (name && !name.startsWith("type ")) set.add(name)
    }
    names.set(specifier, set)
  }
  return names
}

function stubModule(specifier, names) {
  if (specifier in SPECIAL) return SPECIAL[specifier]
  const exports = [...names].map(
    (name) => `export async function ${name}(...args) {
      state.calls.push(${JSON.stringify(name)});
      const impl = state.impl[${JSON.stringify(name)}];
      return typeof impl === "function" ? impl(...args) : impl
    }`
  )
  return `import { state } from "fixture-state";\n${exports.join("\n")}`
}

async function loadJoinActions() {
  const root = process.cwd()
  const file = path.join(
    root,
    "app",
    "m",
    "[merchantSlug]",
    "join",
    "actions.ts"
  )
  const names = importedNames(file)
  const result = await build({
    stdin: {
      contents: `export * from "./app/m/[merchantSlug]/join/actions.ts";
        export { state } from "fixture-state";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "join-phone-boundaries",
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
                  ? "export const state = { impl: {}, calls: [] };"
                  : stubModule(id, names.get(id) ?? new Set()),
              resolveDir: root,
            })
          )
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
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

const EXPIRED_HREF =
  "/m/old-crown/join?qr=venue-qr&ref=friend&step=phone&notice=code_expired"

test("Given the pending code has expired When the guest asks for a new code Then they go back to the number step with the expiry notice and nothing is sent", async () => {
  const { requestCustomerIdentityAction, state } = await loadJoinActions()
  state.impl.getPendingPhoneVerification = null

  for (const channel of ["whatsapp", "sms"]) {
    const destination = await redirectOf(
      requestCustomerIdentityAction(
        {},
        form({ resend: "1", channel, qrId: "venue-qr", ref: "friend" })
      )
    )
    assert.equal(destination, EXPIRED_HREF)
  }
  assert.deepEqual(state.calls, [
    "getPendingPhoneVerification",
    "getPendingPhoneVerification",
  ])
})

test("Given the pending code has expired When the guest submits a code Then they go back to the number step with the expiry notice and no limit is charged", async () => {
  const { verifyCustomerOtpAction, state } = await loadJoinActions()
  state.impl.getPendingPhoneVerification = null

  const destination = await redirectOf(
    verifyCustomerOtpAction(
      {},
      form({ otp: "123456", qrId: "venue-qr", ref: "friend" })
    )
  )

  assert.equal(destination, EXPIRED_HREF)
  assert.deepEqual(state.calls, ["getPendingPhoneVerification"])
})

test("Given a live pending code When the guest asks for a new code Then it goes to the pending number and answers in place", async () => {
  const { requestCustomerIdentityAction, state } = await loadJoinActions()
  const issuedAt = Math.floor(Date.now() / 1000)
  Object.assign(state.impl, {
    getPendingPhoneVerification: {
      purpose: "join",
      phone: "+447400900123",
      country: "GB",
      channel: "whatsapp",
      issuedAt,
    },
    getMerchantJoinContext: { available: true, merchant: { id: "m-1" } },
    enforceCustomerOtpSendRateLimit: true,
    startCustomerPhoneVerification: (phone, channel) => {
      state.sentTo = [phone, channel]
      return { status: "sent", channel }
    },
    setPendingPhoneVerification: { issuedAt },
  })

  const answer = await requestCustomerIdentityAction(
    {},
    // A posted number is ignored: a resend only ever goes to the pending one.
    form({ resend: "1", channel: "sms", contact: "07400 000000" })
  )

  assert.deepEqual(state.sentTo, ["+447400900123", "sms"])
  assert.equal(answer.message, "If a new code arrives, use the latest one.")
  assert.equal(answer.fields.phoneOtpSent, true)
  assert.equal(answer.errors, undefined)
})

test("Given a first send with a malformed number When posted Then the number error stays on the number step", async () => {
  const { requestCustomerIdentityAction, state } = await loadJoinActions()
  state.impl.getPendingPhoneVerification = null

  const answer = await requestCustomerIdentityAction(
    {},
    form({ contact: "12", qrId: "venue-qr" })
  )

  assert.ok(answer.errors.contact)
  assert.equal(answer.fields.contact, "12")
})
