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
      saved: [], savedSurfaces: [], sends: [], events: [], revalidated: [],
      sendFailure: null, check: { status: "approved", email: "guest@example.test" },
      mark: { status: "verified" }, alreadyVerified: false,
      link: { status: "conflict" }, links: [], notices: [],
      profileUpdates: [],
      profileUpdate: { emailVerificationRequired: false, email: null, emailLocked: false },
    };`,
    "server-only": "",
    "next/cache":
      'import { state } from "fixture-state"; export function revalidatePath(path) { state.revalidated.push(path) }',
    "next/server": "export function after() {}",
    "next/navigation": `export function redirect(url) {
      const error = new Error("NEXT_REDIRECT"); error.url = url; throw error
    }`,
    "@/lib/rewards/issue-birthday":
      "export function triggerBirthdayIssuanceForCustomer() {}",
    "@/lib/customer/consent":
      'export const PHONE_MARKETING_CHANNELS = new Set(["sms", "whatsapp"]); export function isMarketingChannel() {} export function updateCustomerMarketingConsent() {}',
    "@/lib/customer/identity":
      'import { state } from "fixture-state"; export async function getCurrentCustomer() { return state.customer }',
    "@/lib/customer/profile": `import { state } from "fixture-state";
      export class CustomerContactLockedError extends Error {}
      export function clearCustomerEmail() {}
      export async function updateCustomerProfile(input) {
        state.profileUpdates.push(input)
        return state.profileUpdate
      }
      export async function markCustomerEmailVerified() { return state.mark }
      export async function setCustomerEmailForVerification(email, surface) {
        if (state.alreadyVerified) return { status: "already_verified" }
        const normalized = email.trim().toLowerCase(); state.saved.push(normalized)
        state.savedSurfaces.push(surface)
        return { status: "verification_required", email: normalized }
      }`,
    "@/lib/customer/session":
      "export function clearPendingEmailVerification() {}",
    "@/lib/customer/wallet-link":
      'import { state } from "fixture-state"; export async function linkWalletAfterContactVerification(method,contact) { state.links.push({method,contact}); return state.link } export function walletLinkFailureMessage() { return "Sign in again to link your wallets." }',
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
    "@/lib/customer/contact-notice-flash": `import { state } from "fixture-state";
      import { contactNoticeReturn } from "@/lib/customer/previous-stamps";
      export async function setContactNoticeFlash(notice, returnTo) {
        state.notices.push(notice);
        return contactNoticeReturn(returnTo).href
      }`,
    "@/lib/customer/contact-events":
      'import { state } from "fixture-state"; export function recordCustomerContactEvent(event) { state.events.push(event) }',
  }
  const passthrough = new Set([
    "@/lib/customer/contact-event-core",
    "@/lib/customer/email-auth-mode",
    "@/lib/customer/email-confirmation",
    "@/lib/customer/profile-fields",
    "@/lib/customer/uk-calendar",
    "@/lib/customer/previous-stamps",
    "@/lib/navigation/safe-next-path",
  ])
  const result = await build({
    stdin: {
      contents:
        'export { emailPromptAction, previousStampsEmailAction, saveHomeProfileAction, verifyHomeProfileEmailAction } from "./app/home/(authed)/profile/actions.ts"; export { state } from "fixture-state";',
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

async function withEmailAuthMode(mode, run) {
  const previous = process.env.CUSTOMER_EMAIL_AUTH_MODE
  if (mode === undefined) delete process.env.CUSTOMER_EMAIL_AUTH_MODE
  else process.env.CUSTOMER_EMAIL_AUTH_MODE = mode
  try {
    return await run()
  } finally {
    if (previous === undefined) delete process.env.CUSTOMER_EMAIL_AUTH_MODE
    else process.env.CUSTOMER_EMAIL_AUTH_MODE = previous
  }
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
  assert.deepEqual(state.savedSurfaces, ["stamp_prompt"])
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

test("Given an emptied email field When the prompt submits Then it asks for an address and sends nothing", async () => {
  const { state, emailPromptAction } = await loadActions()

  const next = await emailPromptAction(
    { step: "email", email: "saved@example.test" },
    form({ intent: "send", email: "  " })
  )

  assert.equal(next.step, "email")
  assert.equal(next.errors.email, "Enter a valid email address.")
  assert.deepEqual(state.saved, [])
  assert.deepEqual(state.sends, [])
})

test("Given a send cooldown When the prompt re-sends from the code step Then it stays on the code step with a wait message", async () => {
  const { state, emailPromptAction } = await loadActions()
  state.sendFailure = "cooldown"

  const next = await emailPromptAction(
    { step: "code", email: "Guest@example.test" },
    form({ intent: "resend", email: "Guest@example.test" })
  )

  assert.equal(next.step, "code")
  assert.equal(next.email, "guest@example.test")
  assert.match(next.errors.form, /wait a minute/)
  assert.deepEqual(state.events, [])
})

test("Given the email provider fails When the prompt re-sends from the code step Then it returns to the email step because no code is pending", async () => {
  const { state, emailPromptAction } = await loadActions()
  state.sendFailure = "provider"

  const next = await emailPromptAction(
    { step: "code", email: "guest@example.test" },
    form({ intent: "resend", email: "guest@example.test" })
  )

  assert.deepEqual(next, {
    step: "email",
    email: "guest@example.test",
    errors: { form: "We couldn't email a code to that address. Try again." },
  })
  assert.deepEqual(state.events, [])
})

test("Given a code is pending for one address When a different address cannot be sent Then the prompt returns to the email step", async () => {
  const { state, emailPromptAction } = await loadActions()
  state.sendFailure = "cooldown"

  const changed = await emailPromptAction(
    { step: "code", email: "first@example.test" },
    form({ intent: "send", email: "second@example.test" })
  )
  assert.equal(changed.step, "email")
  assert.equal(changed.email, "second@example.test")
  assert.match(changed.errors.form, /wait a minute/)

  // A forged resend for an address other than the pending one gets the same.
  const forged = await emailPromptAction(
    { step: "code", email: "first@example.test" },
    form({ intent: "resend", email: "second@example.test" })
  )
  assert.equal(forged.step, "email")
  assert.deepEqual(state.sends, [])
})

test("Given proven complementary wallets When the email code is confirmed Then the prompt succeeds after linking", async () => {
  const { state, emailPromptAction } = await loadActions()
  state.mark = { status: "conflict" }
  state.link = { status: "linked", customerId: "canonical" }
  const next = await emailPromptAction(
    { step: "code", email: "guest@example.test" },
    form({ intent: "verify", otp: "123456" })
  )
  assert.equal(next.step, "verified")
  assert.equal(next.walletLinked, true)
  assert.match(next.message, /^Your stamps are together now\./)
  assert.deepEqual(state.links, [
    { method: "email", contact: "guest@example.test" },
  ])
  assert.deepEqual(state.events, [])
})

test("Given linked wallets When profile email verification completes Then its confirmation names the merge and refreshes loyalty", async () => {
  const { state, verifyHomeProfileEmailAction } = await loadActions()
  state.mark = { status: "conflict" }
  state.link = { status: "linked", customerId: "canonical" }
  const next = await verifyHomeProfileEmailAction({}, form({ otp: "123456" }))
  assert.equal(next.walletLinked, true)
  assert.match(next.message, /^Your stamps are together now\./)
  assert.doesNotMatch(next.message, /wallet/i)
  assert.deepEqual(state.revalidated, ["/home/profile", "/home", "/reward"])
})

for (const recovery of ["reauthenticate", "requires_review"]) {
  test(`Given linking needs ${recovery} When an email code is confirmed Then both surfaces offer recovery without claiming success`, async () => {
    const { state, emailPromptAction, verifyHomeProfileEmailAction } =
      await loadActions()
    state.mark = { status: "conflict" }
    state.link = { status: recovery }
    const prompt = await emailPromptAction(
      { step: "code", email: "guest@example.test" },
      form({ intent: "verify", otp: "123456" })
    )
    const profile = await verifyHomeProfileEmailAction(
      {},
      form({ otp: "123456" })
    )
    assert.equal(prompt.step, "email")
    for (const result of [prompt, profile]) {
      assert.equal(result.recovery, recovery)
      assert.equal(result.walletLinked, undefined)
      assert.ok(result.errors.form)
    }
    assert.deepEqual(state.revalidated, [])
  })
}

test("Given another wallet holds the email When the prompt code is confirmed Then the conflict copy shows and the conflict is tracked", async () => {
  const { state, emailPromptAction } = await loadActions()
  state.mark = { status: "conflict" }

  const next = await withEmailAuthMode(undefined, () =>
    emailPromptAction(
      { step: "code", email: "guest@example.test" },
      form({ intent: "verify", surface: "home_prompt", otp: "123456" })
    )
  )

  assert.deepEqual(next, {
    step: "email",
    errors: {
      form: "This email is used by another card. Use a different email, or ask staff for help.",
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

test("Given email sign-in is live When a confirmed code conflicts Then the copy still never offers email as a way in", async () => {
  for (const mode of ["existing", "full"]) {
    const { state, emailPromptAction } = await loadActions()
    state.mark = { status: "conflict" }

    const next = await withEmailAuthMode(mode, () =>
      emailPromptAction(
        { step: "code", email: "guest@example.test" },
        form({ intent: "verify", otp: "123456" })
      )
    )

    assert.equal(
      next.errors.form,
      "This email is used by another card. Use a different email, or ask staff for help.",
      mode
    )
    assert.doesNotMatch(next.errors.form, /sign in with that email/i)
  }
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
  assert.match(next.errors.otp, /didn't work/)
  assert.deepEqual(state.events, [])
})

test("Given another wallet holds the email When the profile editor confirms the code Then it shows the same conflict copy", async () => {
  const { state, verifyHomeProfileEmailAction } = await loadActions()
  state.mark = { status: "conflict" }

  const next = await verifyHomeProfileEmailAction({}, form({ otp: "123456" }))

  assert.match(next.errors.form, /used by another card/)
  assert.equal(state.events[0].metadata.surface, "profile")
})

test("Given the previous-stamps task When an email is submitted Then only the email is saved, recorded against the profile", async () => {
  const { state, previousStampsEmailAction } = await loadActions()

  const next = await previousStampsEmailAction(
    { step: "email" },
    form({ intent: "request", email: "Old@Example.test" })
  )

  assert.equal(next.step, "code")
  assert.deepEqual(state.saved, ["old@example.test"])
  assert.deepEqual(state.savedSurfaces, ["profile"])
  assert.equal(state.events[0].metadata.surface, "profile")
})

test("Given the previous-stamps task When the code brings a card together Then it returns to the task with that notice", async () => {
  const { state, previousStampsEmailAction } = await loadActions()
  state.mark = { status: "conflict" }
  state.link = { status: "linked", customerId: "canonical" }

  await assert.rejects(
    previousStampsEmailAction(
      { step: "code", email: "old@example.test" },
      form({ intent: "verify", otp: "123456" })
    ),
    (error) => error.url === "/home/profile#previous-stamps"
  )
  assert.deepEqual(state.notices, ["stamps-together"])
  assert.deepEqual(state.links, [
    { method: "email", contact: "guest@example.test" },
  ])
})

test("Given the previous-stamps task When the code confirms an email no card held Then it says nothing was brought over", async () => {
  const { state, previousStampsEmailAction } = await loadActions()

  await assert.rejects(
    previousStampsEmailAction(
      { step: "code", email: "old@example.test" },
      form({ intent: "verify", otp: "123456" })
    ),
    (error) => error.url === "/home/profile#previous-stamps"
  )
  assert.deepEqual(state.notices, ["nothing-found-email"])
})

test("Given the previous-stamps task When linking is refused Then the task stays and offers recovery without a redirect", async () => {
  const { state, previousStampsEmailAction } = await loadActions()
  state.mark = { status: "conflict" }
  state.link = { status: "requires_review" }

  const next = await previousStampsEmailAction(
    { step: "code", email: "old@example.test" },
    form({ intent: "verify", otp: "123456" })
  )

  assert.equal(next.step, "email")
  assert.equal(next.recovery, "requires_review")
})

test("Given the previous-stamps code step When the guest changes the email Then the address is refilled and nothing is sent", async () => {
  const { state, previousStampsEmailAction } = await loadActions()

  const next = await previousStampsEmailAction(
    { step: "code", email: "old@example.test" },
    form({ intent: "change" })
  )

  assert.deepEqual(next, { step: "email", email: "old@example.test" })
  assert.deepEqual(state.sends, [])
})

test("Given the details editor When a save sends an email code or just saves Then the answer carries a structured outcome, not only copy", async () => {
  const { state, saveHomeProfileAction } = await loadActions()

  const saved = await saveHomeProfileAction(
    {},
    form({ fullName: "Alex Guest", dateOfBirth: "1990-01-01", email: "" })
  )
  assert.equal(saved.outcome, "saved")

  state.profileUpdate = {
    emailVerificationRequired: true,
    email: "new@example.test",
    emailLocked: false,
  }
  const codeSent = await saveHomeProfileAction(
    {},
    form({
      fullName: "Alex Guest",
      dateOfBirth: "1990-01-01",
      email: "new@example.test",
    })
  )
  assert.equal(codeSent.outcome, "email_code_sent")
  assert.deepEqual(state.sends, ["new@example.test"])
})
