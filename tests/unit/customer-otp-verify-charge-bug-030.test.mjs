import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-030 (38c42a1..2c45031): the phone verify limit (5 per 15 minutes per
 * phone and per request identity) was debited before the provider check and
 * never given back, so the sixth CORRECT code to one number within 15 minutes
 * was refused with "Too many code attempts".
 *
 * Decision (FIX-PLAN Q2): the bucket is checked before verification but only
 * a rejected code is charged. Both verify actions (join and home sign-in) are
 * bundled with the real limiter module (`lib/customer/otp-rate-limit.ts`,
 * `lib/security/rate-limit.ts`); only the Supabase service client is replaced,
 * by an in-memory stand-in for the two buckets and the admission RPCs. The
 * RPCs' SQL semantics are proven against Postgres in
 * tests/db/customer-otp-verify-release-bug-030.test.mjs.
 */
const REAL = new Set([
  "@/lib/customer/otp-rate-limit",
  "@/lib/customer/otp-rate-limit-core",
  "@/lib/security/rate-limit",
  "@/lib/security/rate-limit-core",
  "@/lib/supabase/missing-rpc",
  "@/lib/customer/phone",
  "@/lib/customer/experience/otp-field",
  "@/lib/customer/otp-channel-core",
  "@/lib/customer/phone-code-email-fallback",
  "@/lib/customer/join-observability-contract",
  "@/lib/navigation/customer-join-intent",
  "@/lib/navigation/safe-next-path",
  "@/lib/observability/request-id",
])

const LIMIT = 5
const WINDOW_MS = 15 * 60_000

// An in-memory rate_limit_buckets table with the admission RPCs' semantics:
// admit reserves one attempt on both buckets atomically or refuses, and
// release gives one back to live windows. Any other RPC is "not deployed".
const SUPABASE = `import { state } from "fixture-state";
  function live(key) {
    const row = state.buckets.get(key)
    return row && row.resetAt > Date.now() ? row : null
  }
  export function createSupabaseServiceRoleClient() {
    return {
      async rpc(name, args) {
        state.rpcCalls.push(name)
        if (name === "admit_customer_otp_verify") {
          const keys = [args.p_phone_bucket, args.p_identity_bucket]
          if (keys.some((key) => (live(key)?.count ?? 0) >= ${LIMIT})) {
            return { error: { message: "Rate limit exceeded" } }
          }
          for (const key of keys) {
            const row = live(key)
            if (row) row.count += 1
            else state.buckets.set(key, { count: 1, resetAt: Date.now() + ${WINDOW_MS} })
          }
          return { error: null }
        }
        if (name === "release_customer_otp_verify") {
          for (const key of [args.p_phone_bucket, args.p_identity_bucket]) {
            const row = live(key)
            if (row && row.count > 0) row.count -= 1
          }
          return { error: null }
        }
        return {
          error: { code: "PGRST202", message: "Could not find the function public." + name },
        }
      },
    }
  }`

const SPECIAL = {
  "server-only": "",
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }`,
  "next/headers": `export async function headers() {
      return new Headers({ "x-forwarded-for": "198.51.100.7", "user-agent": "unit" })
    }
    export async function cookies() { return { get() {}, set() {}, delete() {} } }`,
  "next/server": "export function after() {}",
  "@/lib/supabase/server": SUPABASE,
  "@/lib/legal/content": 'export const CUSTOMER_LEGAL_VERSION = "test"',
  "@/lib/observability/logger":
    "export const logger = { error() {}, warn() {}, info() {} }",
}

const IMPORT_PATTERN = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g

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

const STATE = `export const state = {
  impl: {}, calls: [], rpcCalls: [], buckets: new Map(),
};`

async function loadVerifyActions() {
  const root = process.cwd()
  const files = [
    path.join(root, "app", "m", "[merchantSlug]", "join", "actions.ts"),
    path.join(root, "app", "home", "actions.ts"),
    path.join(root, "lib", "customer", "otp-rate-limit.ts"),
    path.join(root, "lib", "security", "rate-limit.ts"),
  ]
  const names = importedNames(files)
  const result = await build({
    stdin: {
      contents: `export { verifyCustomerOtpAction } from "./app/m/[merchantSlug]/join/actions.ts";
        export { verifyCustomerLoginOtpAction } from "./app/home/actions.ts";
        export { state } from "fixture-state";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "otp-verify-boundaries",
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
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
  )
}

const PHONE = "+447400900123"

function pending(purpose) {
  return {
    purpose,
    phone: PHONE,
    country: "GB",
    phoneHmac: "a".repeat(64),
    issuedAt: Math.floor(Date.now() / 1000),
  }
}

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

/** Runs one action and reports "signed_in" on its redirect, or its errors. */
async function attempt(promise) {
  try {
    const state = await promise
    return { outcome: "answered", errors: state?.errors ?? {} }
  } catch (error) {
    if (error?.message === "NEXT_REDIRECT") return { outcome: "signed_in" }
    throw error
  }
}

function joinStubs(state, verification) {
  Object.assign(state.impl, {
    getPendingPhoneVerification: pending("join"),
    checkCustomerPhoneVerification: verification,
    getOrCreateCustomerByVerifiedPhone: {
      customer: { id: "customer-1" },
      created: false,
    },
    establishCustomerSessionAfterVerifiedPhone: "authenticated",
    getMerchantJoinContext: { available: true, merchant: { id: "m-1" } },
  })
}

function loginStubs(state, verification) {
  Object.assign(state.impl, {
    getPendingPhoneVerification: pending("wallet"),
    checkCustomerPhoneVerification: verification,
    findCustomerByVerifiedPhone: { id: "customer-1" },
    establishCustomerSessionAfterVerifiedPhone: "authenticated",
  })
}

const joinVerify = (actions, otp) =>
  attempt(
    actions.verifyCustomerOtpAction(
      {},
      form({ merchantSlug: "old-crown", qrId: "venue-qr", otp })
    )
  )

const loginVerify = (actions, otp) =>
  attempt(
    actions.verifyCustomerLoginOtpAction({}, form({ otp, next: "/home" }))
  )

const TOO_MANY = /too many code attempts/i

test("Given six correct codes in a row When each is confirmed on the join page Then every one signs in", async () => {
  const actions = await loadVerifyActions()
  joinStubs(actions.state, { status: "approved" })

  const outcomes = []
  for (let n = 0; n < 6; n += 1) {
    outcomes.push((await joinVerify(actions, "123456")).outcome)
  }

  assert.deepEqual(outcomes, Array(6).fill("signed_in"))
})

test("Given six correct codes in a row When each is confirmed at sign-in Then every one signs in", async () => {
  const actions = await loadVerifyActions()
  loginStubs(actions.state, { status: "approved" })

  const outcomes = []
  for (let n = 0; n < 6; n += 1) {
    outcomes.push((await loginVerify(actions, "123456")).outcome)
  }

  assert.deepEqual(outcomes, Array(6).fill("signed_in"))
})

test("Given five wrong codes When the correct code follows Then the number stays locked", async () => {
  for (const [verify, stubs] of [
    [joinVerify, joinStubs],
    [loginVerify, loginStubs],
  ]) {
    const actions = await loadVerifyActions()
    stubs(actions.state, { status: "rejected" })

    for (let n = 0; n < 5; n += 1) {
      const wrong = await verify(actions, "000000")
      assert.equal(wrong.outcome, "answered")
      assert.match(
        wrong.errors.otp ?? wrong.errors.form,
        /that code was not accepted/i
      )
    }

    actions.state.impl.checkCustomerPhoneVerification = { status: "approved" }
    actions.state.calls.length = 0
    const correct = await verify(actions, "123456")
    assert.equal(correct.outcome, "answered")
    assert.match(correct.errors.form, TOO_MANY)
    assert.equal(
      actions.state.calls.includes("checkCustomerPhoneVerification"),
      false,
      "an exhausted number is refused before the provider is asked"
    )
  }
})

test("Given four wrong codes When correct codes follow Then each still signs in and the fifth wrong code locks", async () => {
  const actions = await loadVerifyActions()
  const { state } = actions
  joinStubs(state, { status: "rejected" })
  for (let n = 0; n < 4; n += 1) await joinVerify(actions, "000000")

  state.impl.checkCustomerPhoneVerification = { status: "approved" }
  for (let n = 0; n < 3; n += 1) {
    assert.equal((await joinVerify(actions, "123456")).outcome, "signed_in")
  }

  state.impl.checkCustomerPhoneVerification = { status: "rejected" }
  const fifthWrong = await joinVerify(actions, "000000")
  assert.match(fifthWrong.errors.otp, /that code was not accepted/i)

  state.impl.checkCustomerPhoneVerification = { status: "approved" }
  assert.match((await joinVerify(actions, "123456")).errors.form, TOO_MANY)
})

test("Given the provider cannot check codes When that repeats Then the attempts still count", async () => {
  const actions = await loadVerifyActions()
  loginStubs(actions.state, { status: "unavailable" })

  for (let n = 0; n < 5; n += 1) {
    assert.match(
      (await loginVerify(actions, "123456")).errors.form,
      /couldn't check that code/i
    )
  }
  assert.match((await loginVerify(actions, "123456")).errors.form, TOO_MANY)
})
