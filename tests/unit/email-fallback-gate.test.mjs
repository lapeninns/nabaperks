import assert from "node:assert/strict"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * lib/customer/email-fallback.ts: the server's gate on the email fallback,
 * with the cookie jar, the pending phone code and the email sign-in state
 * stubbed. The record cookie's encryption, the 30-second rule and the cookie
 * options are the real ones.
 */
const REAL = [
  "@/lib/customer/email-fallback-core",
  "@/lib/customer/pending-cookie-crypto",
  "@/lib/customer/phone-code-email-fallback",
  "@/lib/http/persistent-cookie-options",
]

const STUBS = {
  "fixture-state": `export const state = {
    jar: new Map(),
    phone: null,
    email: null,
    handoff: null,
    handoffReads: [],
  };`,
  "server-only": "",
  "next/headers": `import { state } from "fixture-state";
    export async function cookies() {
      return {
        get(name) { return state.jar.has(name) ? { name, value: state.jar.get(name) } : undefined },
        set(name, value) { state.jar.set(name, value) },
        delete(name) { state.jar.delete(name) },
      }
    }`,
  "@/lib/customer/session": `import { state } from "fixture-state";
    export async function getPendingPhoneVerification() { return state.phone }`,
  "@/lib/customer/email-sign-in": `import { state } from "fixture-state";
    export async function getPendingEmailSignIn() { return state.email }
    export async function readVerifiedEmailHandoff(input) { state.handoffReads.push(input); return state.handoff }`,
  "@/lib/observability/logger":
    "export const logger = { error() {}, warn() {}, info() {} }",
  "@/lib/security/customer-session-secret":
    'export function requiredCustomerSessionSecret() { return "fixture-session-secret-0123456789" }',
}

async function load() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents:
        'export * from "./lib/customer/email-fallback.ts"; export { state } from "fixture-state";',
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "email-fallback-boundaries",
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

const now = () => Math.floor(Date.now() / 1_000)

test("Given a phone code under 30 seconds old When email is asked for Then the gate stays shut and hands back that code", async () => {
  const gate = await load()
  gate.state.phone = {
    purpose: "wallet",
    phone: "+447700900123",
    issuedAt: now() - 5,
  }

  const result = await gate.walletEmailFallbackGate()

  assert.equal(result.open, false)
  assert.equal(result.phoneCode, gate.state.phone)

  gate.state.phone = { ...gate.state.phone, issuedAt: now() - 31 }
  assert.equal((await gate.walletEmailFallbackGate()).open, true)
})

test("Given a phone code for another flow When email is asked for Then it neither opens email nor is shown", async () => {
  const gate = await load()
  gate.state.phone = {
    purpose: "join",
    phone: "+447700900123",
    issuedAt: now() - 60,
  }

  assert.deepEqual(await gate.walletEmailFallbackGate(), {
    open: false,
    phoneCode: null,
  })
  gate.state.phone = { ...gate.state.phone, purpose: "wallet" }
  assert.deepEqual(
    await gate.joinEmailFallbackGate({ merchantSlug: "old-crown", qrId: "" }),
    { open: false, phoneCode: null }
  )
})

test("Given a failed send or no cards When the flow opened email Then only that flow's gate opens, until a new phone code closes it", async () => {
  const gate = await load()
  assert.equal((await gate.walletEmailFallbackGate()).open, false)

  await gate.openEmailFallback("wallet", "phone_send_failed")
  const [[name, value]] = [...gate.state.jar]
  assert.equal(name, "nabaperks_email_fallback")
  // Encrypted: the record names neither a number nor an address.
  assert.doesNotMatch(value, /wallet|phone_send_failed/)
  assert.equal((await gate.walletEmailFallbackGate()).open, true)
  assert.equal(await gate.emailFallbackOpenedFor("join"), false)

  await gate.closeEmailFallback()
  assert.equal((await gate.walletEmailFallbackGate()).open, false)

  await gate.openEmailFallback("join", "phone_send_failed")
  assert.equal(
    (await gate.joinEmailFallbackGate({ merchantSlug: "old-crown", qrId: "q" }))
      .open,
    true
  )
  assert.equal((await gate.walletEmailFallbackGate()).open, false)
})

test("Given a forged or foreign record When email is asked for Then the gate stays shut", async () => {
  const gate = await load()
  gate.state.jar.set("nabaperks_email_fallback", "v2.forged.value.here")
  assert.equal((await gate.walletEmailFallbackGate()).open, false)
})

test("Given an email sign-in already under way When email is asked for Then the gate is open for that flow", async () => {
  const gate = await load()
  gate.state.email = { purpose: "wallet" }
  assert.equal((await gate.walletEmailFallbackGate()).open, true)
  assert.equal(
    (await gate.joinEmailFallbackGate({ merchantSlug: "old-crown", qrId: "q" }))
      .open,
    false
  )

  // A confirmed-email handoff for this venue and QR keeps the join gate open.
  gate.state.email = null
  gate.state.handoff = { handoffId: "handoff-1" }
  assert.equal(
    (await gate.joinEmailFallbackGate({ merchantSlug: "old-crown", qrId: "" }))
      .open,
    true
  )
  assert.deepEqual(gate.state.handoffReads.at(-1), {
    merchantSlug: "old-crown",
    qrId: null,
  })
})
