import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-030 remainder (38c42a1..2c45031): adding a phone from the profile or
 * the reward gate reserved a verify attempt before the provider check and
 * never gave it back, so the sixth CORRECT attach code to one number within
 * 15 minutes was refused with "Too many code attempts".
 *
 * Decision (FIX-PLAN Q2): only a rejected code is charged. The profile attach
 * action is bundled with the real limiter module (`lib/customer/otp-rate-limit.ts`,
 * `lib/security/rate-limit.ts`); only the Supabase service client is replaced,
 * by the same in-memory stand-in for the buckets and admission RPCs that
 * tests/unit/customer-otp-verify-charge-bug-030.test.mjs uses for join and
 * sign-in. The RPCs' SQL semantics are proven against Postgres in
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
  "next/cache": "export function revalidatePath() {}",
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

async function loadAttachAction() {
  const root = process.cwd()
  const files = [
    path.join(root, "app", "home", "(authed)", "profile", "phone-actions.ts"),
    path.join(root, "lib", "customer", "otp-rate-limit.ts"),
    path.join(root, "lib", "security", "rate-limit.ts"),
  ]
  const names = importedNames(files)
  const result = await build({
    stdin: {
      contents: `export { profilePhoneAction, rewardPhoneAction } from "./app/home/(authed)/profile/phone-actions.ts";
        export { state } from "fixture-state";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "attach-verify-boundaries",
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
const CUSTOMER_ID = "customer-1"

function attachStubs(state, verification) {
  Object.assign(state.impl, {
    getCurrentCustomer: { id: CUSTOMER_ID, phoneLast4: null },
    getPendingPhoneVerification: {
      purpose: "attach",
      customerId: CUSTOMER_ID,
      phone: PHONE,
      country: "GB",
      phoneHmac: "a".repeat(64),
      issuedAt: Math.floor(Date.now() / 1000),
    },
    checkCustomerPhoneVerification: verification,
    attachVerifiedPhoneToCustomer: {
      status: "attached",
      customer: { id: CUSTOMER_ID, phoneLast4: "0123" },
    },
  })
}

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const attachVerify = (actions, otp, action = "profilePhoneAction") =>
  actions[action](
    { step: "code", phone: PHONE },
    form({ intent: "verify", otp })
  )

const TOO_MANY = /too many code attempts/i

test("Given six correct attach codes in a row When each is confirmed on the profile Then every one adds the phone", async () => {
  const actions = await loadAttachAction()
  attachStubs(actions.state, { status: "approved" })

  const steps = []
  for (let n = 0; n < 6; n += 1) {
    const result = await attachVerify(actions, "123456")
    steps.push(result.errors?.form ?? result.step)
  }

  assert.deepEqual(steps, Array(6).fill("attached"))
})

test("Given six correct attach codes When each is confirmed at the reward gate Then every one adds the phone", async () => {
  const actions = await loadAttachAction()
  attachStubs(actions.state, { status: "approved" })

  const steps = []
  for (let n = 0; n < 6; n += 1) {
    const result = await attachVerify(actions, "123456", "rewardPhoneAction")
    steps.push(result.errors?.form ?? result.step)
  }

  assert.deepEqual(steps, Array(6).fill("attached"))
})

test("Given five wrong attach codes When the correct code follows Then the number stays locked", async () => {
  const actions = await loadAttachAction()
  attachStubs(actions.state, { status: "rejected" })

  for (let n = 0; n < 5; n += 1) {
    const wrong = await attachVerify(actions, "000000")
    assert.equal(wrong.step, "code")
    assert.match(wrong.errors.otp, /that code was not accepted/i)
  }

  actions.state.impl.checkCustomerPhoneVerification = { status: "approved" }
  actions.state.calls.length = 0
  const correct = await attachVerify(actions, "123456")
  assert.match(correct.errors.form, TOO_MANY)
  assert.equal(
    actions.state.calls.includes("checkCustomerPhoneVerification"),
    false,
    "an exhausted number is refused before the provider is asked"
  )
  assert.equal(
    actions.state.calls.includes("attachVerifiedPhoneToCustomer"),
    false
  )
})

test("Given the provider cannot check attach codes When that repeats Then the attempts still count", async () => {
  const actions = await loadAttachAction()
  attachStubs(actions.state, { status: "unavailable" })

  for (let n = 0; n < 5; n += 1) {
    assert.match(
      (await attachVerify(actions, "123456")).errors.form,
      /couldn't check that code/i
    )
  }
  assert.match((await attachVerify(actions, "123456")).errors.form, TOO_MANY)
})
