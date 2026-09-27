import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * The "add your email" prompt's server action, with the real shared
 * confirmation step (lib/customer/email-confirmation.ts) and real closed event
 * vocabulary behind it. Storage, the code check and the event sink are stubs.
 */
async function loadActions() {
  const modules = {
    "fixture-state": `export const state = {
      customer: { id: "customer-a", email: null, emailVerifiedAt: null },
      saved: [], sends: [], events: [], revalidated: [],
      sendFailure: null, check: { status: "approved", email: "guest@example.test" },
      mark: { status: "verified" }, alreadyVerified: false,
    };`,
    "server-only": "",
    "next/cache":
      'import { state } from "fixture-state"; export function revalidatePath(path) { state.revalidated.push(path) }',
    "next/server": "export function after() {}",
    "@/lib/rewards/issue-birthday":
      "export function triggerBirthdayIssuanceForCustomer() {}",
    "@/lib/customer/consent":
      "export function isMarketingChannel() {} export function updateCustomerMarketingConsent() {}",
    "@/lib/customer/identity":
      'import { state } from "fixture-state"; export async function getCurrentCustomer() { return state.customer }',
    "@/lib/customer/profile": `import { state } from "fixture-state";
      export const CUSTOMER_EMAIL_CONFLICT_MESSAGE = "This email is already used by another Nabaperks wallet. Sign in with that email, or ask the venue for help.";
      export function clearCustomerEmail() {}
      export function updateCustomerProfile() {}
      export async function markCustomerEmailVerified() { return state.mark }
      export async function setCustomerEmailForVerification(email) {
        if (state.alreadyVerified) return { status: "already_verified" }
        const normalized = email.trim().toLowerCase(); state.saved.push(normalized)
        return { status: "verification_required", email: normalized }
      }`,
    "@/lib/customer/session":
      "export function clearPendingEmailVerification() {}",
    "@/lib/security/rate-limit": "export class RateLimitError extends Error {}",
    "@/lib/supabase/server":
      "export function createSupabaseServiceRoleClient() {}",
    "@/lib/customer/email-verification": `import { state } from "fixture-state"; import { RateLimitError } from "@/lib/security/rate-limit";
      export async function startCustomerEmailVerification(email) {
        if (state.sendFailure === "cooldown") throw new RateLimitError()
        if (state.sendFailure) throw new Error("provider detail")
        state.sends.push(email)
      }
      export async function checkCustomerEmailVerification() { return state.check }`,
    "@/lib/customer/contact-events":
      'import { state } from "fixture-state"; export function recordCustomerContactEvent(event) { state.events.push(event) }',
  }
  const passthrough = new Set([
    "@/lib/customer/contact-event-core",
    "@/lib/customer/email-confirmation",
    "@/lib/customer/profile-fields",
    "@/lib/customer/uk-calendar",
  ])
  const result = await build({
    stdin: {
      contents:
        'export { emailPromptAction, verifyHomeProfileEmailAction } from "./app/home/(authed)/profile/actions.ts"; export { state } from "fixture-state";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "email-prompt-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/lib\/)/ },
            ({ path }) => {
              if (passthrough.has(path)) {
                return {
                  path: `${process.cwd()}/${path.slice(2)}.ts`,
                }
              }
              return { path, namespace: "fixture" }
            }
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

function form(fields) {
  const data = new FormData()
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

test("Given a valid email When the prompt sends a code Then only the email is saved and the start is tracked without the address", async () => {
  const { state, emailPromptAction } = await loadActions()

  const next = await emailPromptAction(
    { step: "email" },
    form({
      intent: "send",
      surface: "stamp_prompt",
      email: "Guest@Example.test",
    })
  )

  assert.deepEqual(next, {
    step: "code",
    email: "guest@example.test",
    message: "Enter the code we sent to your email.",
  })
  assert.deepEqual(state.saved, ["guest@example.test"])
  assert.deepEqual(state.sends, ["guest@example.test"])
  assert.deepEqual(state.events, [
    {
      eventName: "customer_email_verification_started",
      customerId: "customer-a",
      metadata: { method: "email", surface: "stamp_prompt" },
    },
  ])
})

test("Given an invalid email or a forged surface When the prompt submits Then nothing is saved and the surface falls back", async () => {
  const { state, emailPromptAction } = await loadActions()

  const invalid = await emailPromptAction(
    { step: "email" },
    form({ intent: "send", email: "not-an-email" })
  )
  assert.equal(invalid.step, "email")
  assert.equal(invalid.errors.email, "Enter a valid email address.")
  assert.deepEqual(state.saved, [])

  await emailPromptAction(
    { step: "email" },
    form({ intent: "send", surface: "guest@example.test", email: "a@b.test" })
  )
  assert.equal(state.events[0].metadata.surface, "home_prompt")
})

test("Given a send cooldown When the prompt re-sends from the code step Then it stays on the code step with a wait message", async () => {
  const { state, emailPromptAction } = await loadActions()
  state.sendFailure = "cooldown"

  const next = await emailPromptAction(
    { step: "code", email: "guest@example.test" },
    form({ intent: "send", email: "guest@example.test" })
  )

  assert.equal(next.step, "code")
  assert.match(next.errors.form, /wait a minute/)
  assert.deepEqual(state.events, [])
})

test("Given another wallet holds the email When the prompt code is confirmed Then the conflict copy shows and the conflict is tracked", async () => {
  const { state, emailPromptAction } = await loadActions()
  state.mark = { status: "conflict" }

  const next = await emailPromptAction(
    { step: "code", email: "guest@example.test" },
    form({ intent: "verify", surface: "home_prompt", otp: "123456" })
  )

  assert.deepEqual(next, {
    step: "email",
    errors: {
      form: "This email is already used by another Nabaperks wallet. Sign in with that email, or ask the venue for help.",
    },
  })
  assert.deepEqual(state.events, [
    {
      eventName: "customer_contact_conflict",
      customerId: "customer-a",
      metadata: {
        method: "email",
        surface: "home_prompt",
        reason: "email_in_use",
      },
    },
  ])
  assert.deepEqual(state.revalidated, [])
})

test("Given a matching code When the prompt code is confirmed Then the email is verified and tracked", async () => {
  const { state, emailPromptAction } = await loadActions()

  const next = await emailPromptAction(
    { step: "code", email: "guest@example.test" },
    form({ intent: "verify", surface: "home_prompt", otp: "123456" })
  )

  assert.deepEqual(next, {
    step: "verified",
    message: "Your email is confirmed.",
  })
  assert.equal(state.events[0].eventName, "customer_email_verified")
  assert.deepEqual(state.revalidated, ["/home/profile"])
})

test("Given a wrong code When the prompt code is confirmed Then it stays on the code step and nothing is tracked", async () => {
  const { state, emailPromptAction } = await loadActions()
  state.check = { status: "rejected" }

  const next = await emailPromptAction(
    { step: "code", email: "guest@example.test" },
    form({ intent: "verify", otp: "000000" })
  )

  assert.equal(next.step, "code")
  assert.match(next.errors.otp, /didn't match/)
  assert.deepEqual(state.events, [])
})

test("Given another wallet holds the email When the profile editor confirms the code Then it shows the same conflict copy", async () => {
  const { state, verifyHomeProfileEmailAction } = await loadActions()
  state.mark = { status: "conflict" }

  const next = await verifyHomeProfileEmailAction({}, form({ otp: "123456" }))

  assert.match(next.errors.form, /already used by another Nabaperks wallet/)
  assert.equal(state.events[0].metadata.surface, "profile")
})
