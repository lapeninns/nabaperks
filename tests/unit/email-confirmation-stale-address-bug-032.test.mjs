import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-032 (38c42a1..2c45031). One wallet, two devices: device 1 saves X and
 * gets a code, device 2 saves Y and gets a code, then device 1 enters X's
 * code. The confirmation used to write X over Y and mark it verified, so Y
 * could never be confirmed and device 2 was told to "Try again".
 *
 * A code now confirms only the address the profile still holds, unverified,
 * in one guarded write. Anything else is an expired code ("Email me a new
 * code"), and a wallet whose email is already verified is told so.
 */

async function bundle(entry, modules, passthrough = new Set()) {
  const result = await build({
    stdin: { contents: entry, resolveDir: process.cwd() },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "bug-032-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/lib\/)/ },
            ({ path }) =>
              passthrough.has(path)
                ? { path: `${process.cwd()}/${path.slice(2)}.ts` }
                : { path, namespace: "fixture" }
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
            assert.ok(path in modules, `Unrecognised boundary: ${path}`)
            return { contents: modules[path] }
          })
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

// lib/customer/profile.ts against a recording Supabase stub.
function loadProfile() {
  return bundle(
    'export * from "./lib/customer/profile.ts"; export { state } from "fixture-state";',
    {
      "fixture-state": `export const state = {
        customer: { id: "customer-a", email: "y@example.test", emailVerifiedAt: null },
        confirmedRows: [{ id: "customer-a" }],
        queries: [], updates: [], audits: [], afterCalls: 0,
      };`,
      "server-only": "",
      "next/server":
        'import { state } from "fixture-state"; export function after() { state.afterCalls += 1 }',
      "@/lib/customer/phone-verification-state":
        "export async function customerHasVerifiedPhone() { return true }",
      // PR #410's wallet link runs only after a conflict, which these cases
      // never reach; the stub makes an unexpected call visible.
      "@/lib/customer/wallet-link":
        'export async function linkWalletAfterContactVerification() { throw new Error("unexpected wallet link") } export function walletLinkFailureMessage() { return "" }',
      "@/lib/customer/identity":
        'import { state } from "fixture-state"; export async function getCurrentCustomer() { return state.customer }',
      "@/lib/customer/email-pii-core":
        'export function customerEmailHmac(email) { return "hmac:" + email } export function normalizeEmail(email) { return email.trim().toLowerCase().normalize("NFC") }',
      "@/lib/customer/profile-completion":
        "export function profileCompletionFrom(customer) { return customer }",
      "@/lib/customer/reward-invites":
        "export function attachRewardInvitesForCustomer() {}",
      "@/lib/customer/email-audit":
        'import { state } from "fixture-state"; export async function recordCustomerEmailAudit(_client, row) { state.audits.push(row.action) }',
      "@/lib/observability/logger":
        "export const logger = { error() {}, warn() {} }",
      "@/lib/supabase/server": `import { state } from "fixture-state";
        function builder() {
          const ops = []
          const chain = {}
          for (const op of ["select", "update", "eq", "not", "neq", "is", "or", "limit"]) {
            chain[op] = (...args) => { ops.push([op, ...args]); return chain }
          }
          chain.then = (resolve, reject) => {
            if (ops[0][0] === "update") {
              state.updates.push(ops)
              const returning = ops.some(([op]) => op === "select")
              return Promise.resolve({ data: returning ? state.confirmedRows : null, error: null }).then(resolve, reject)
            }
            state.queries.push(ops)
            return Promise.resolve({ data: [], error: null }).then(resolve, reject)
          }
          return chain
        }
        export function createSupabaseServiceRoleClient() {
          return { from(table) { if (table !== "customers") throw new Error(table); return builder() } }
        }`,
    }
  )
}

test("Given the profile now holds a newer address When the older address's code is confirmed Then nothing is written and the code is expired", async () => {
  const profile = await loadProfile()

  const result = await profile.markCustomerEmailVerified(
    "x@example.test",
    "profile"
  )

  assert.deepEqual(result, { status: "expired" })
  assert.deepEqual(profile.state.updates, [])
  assert.deepEqual(profile.state.audits, [])
  assert.equal(profile.state.afterCalls, 0)
})

test("Given the stored address When its code is confirmed Then the write is guarded on that address still being unverified", async () => {
  const profile = await loadProfile()

  const result = await profile.markCustomerEmailVerified(
    " Y@Example.test ",
    "profile"
  )

  assert.deepEqual(result, { status: "verified" })
  const [ops] = profile.state.updates
  assert.equal(ops[0][0], "update")
  assert.equal(ops[0][1].email, "y@example.test")
  assert.deepEqual(ops.slice(1), [
    ["eq", "id", "customer-a"],
    ["eq", "email", "y@example.test"],
    ["is", "email_verified_at", null],
    ["select", "id"],
  ])
  assert.deepEqual(profile.state.audits, ["customer_email_verified"])
})

test("Given the address changes between the read and the write When the guarded write matches no row Then the code is expired, not a silent success", async () => {
  const profile = await loadProfile()
  profile.state.confirmedRows = []

  const result = await profile.markCustomerEmailVerified(
    "y@example.test",
    "home_prompt"
  )

  assert.deepEqual(result, { status: "expired" })
  assert.equal(profile.state.updates.length, 1)
  assert.deepEqual(profile.state.audits, [])
  assert.equal(profile.state.afterCalls, 0)
})

test("Given the profile's email was cleared elsewhere When a pending code is confirmed Then it is expired", async () => {
  const profile = await loadProfile()
  profile.state.customer = {
    id: "customer-a",
    email: null,
    emailVerifiedAt: null,
  }

  assert.deepEqual(await profile.markCustomerEmailVerified("x@example.test"), {
    status: "expired",
  })
  assert.deepEqual(profile.state.updates, [])
})

// The shared confirmation step and its copy, behind the profile action.
function loadActions() {
  return bundle(
    'export { emailPromptAction, verifyHomeProfileEmailAction } from "./app/home/(authed)/profile/actions.ts"; export { state } from "fixture-state";',
    {
      "fixture-state": `export const state = {
        customer: { id: "customer-a", email: "y@example.test", emailVerifiedAt: null },
        check: { status: "approved", email: "x@example.test" },
        mark: { status: "verified" }, markError: null, events: [], revalidated: [],
      };`,
      "server-only": "",
      "next/cache":
        'import { state } from "fixture-state"; export function revalidatePath(path) { state.revalidated.push(path) }',
      "next/server": "export function after() {}",
      "next/navigation": "export function redirect() {}",
      "@/lib/rewards/issue-birthday":
        "export function triggerBirthdayIssuanceForCustomer() {}",
      "@/lib/customer/consent":
        "export function isMarketingChannel() {} export function updateCustomerMarketingConsent() {}",
      // PR #410's wallet link runs only after a conflict, which these cases
      // never reach; the stub makes an unexpected call visible.
      "@/lib/customer/wallet-link":
        'export async function linkWalletAfterContactVerification() { throw new Error("unexpected wallet link") } export function walletLinkFailureMessage() { return "" }',
      "@/lib/customer/identity":
        'import { state } from "fixture-state"; export async function getCurrentCustomer() { return state.customer }',
      "@/lib/customer/profile": `import { state } from "fixture-state";
        export class CustomerContactLockedError extends Error {
          constructor(message = "Verified contact details are locked.") { super(message); this.name = "CustomerContactLockedError" }
        }
        export function clearCustomerEmail() {}
        export function updateCustomerProfile() {}
        export function setCustomerEmailForVerification() {}
        export async function markCustomerEmailVerified() {
          if (state.markError === "locked") throw new CustomerContactLockedError("Verified email is locked.")
          if (state.markError) throw new Error("database unavailable")
          return state.mark
        }`,
      "@/lib/customer/session":
        "export function clearPendingEmailVerification() {}",
      "@/lib/security/rate-limit":
        "export class RateLimitError extends Error {}",
      "@/lib/supabase/server":
        "export function createSupabaseServiceRoleClient() {}",
      "@/lib/customer/email-verification": `import { state } from "fixture-state";
        export async function startCustomerEmailVerification() {}
        export async function checkCustomerEmailVerification() { return state.check }`,
      "@/lib/customer/contact-events":
        'import { state } from "fixture-state"; export function recordCustomerContactEvent(event) { state.events.push(event) }',
    },
    new Set([
      "@/lib/customer/contact-event-core",
      "@/lib/customer/email-auth-mode",
      "@/lib/customer/email-confirmation",
      "@/lib/customer/profile-fields",
      "@/lib/customer/uk-calendar",
      "@/lib/customer/previous-stamps",
      "@/lib/navigation/safe-next-path",
    ])
  )
}

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

test("Given a stale code When device one confirms it Then it is told the code expired and no confirmation is tracked", async () => {
  const actions = await loadActions()
  actions.state.mark = { status: "expired" }

  const profileAnswer = await actions.verifyHomeProfileEmailAction(
    {},
    form({ otp: "123456" })
  )
  const promptAnswer = await actions.emailPromptAction(
    { step: "code", email: "x@example.test" },
    form({ intent: "verify", surface: "home_prompt", otp: "123456" })
  )

  const expired = { otp: "That code has expired. Send a new code." }
  assert.deepEqual(profileAnswer, { errors: expired })
  assert.deepEqual(promptAnswer, {
    step: "code",
    email: "x@example.test",
    errors: expired,
  })
  assert.deepEqual(actions.state.events, [])
  assert.deepEqual(actions.state.revalidated, [])
})

test("Given the wallet's email was verified meanwhile When another code is confirmed Then it says the email is already confirmed, not Try again", async () => {
  const actions = await loadActions()
  actions.state.markError = "locked"

  const answer = await actions.verifyHomeProfileEmailAction(
    {},
    form({ otp: "123456" })
  )

  assert.deepEqual(answer, {
    errors: { form: "Your email is already confirmed." },
  })
  assert.deepEqual(actions.state.events, [])
})

test("Given any other confirmation failure When a code is confirmed Then the retry copy is unchanged", async () => {
  const actions = await loadActions()
  actions.state.markError = "database"

  const answer = await actions.verifyHomeProfileEmailAction(
    {},
    form({ otp: "123456" })
  )

  assert.deepEqual(answer, {
    errors: { form: "We couldn't confirm your email. Try again." },
  })
})
