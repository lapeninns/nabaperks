import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * QA BUG-036 (38c42a1..2c45031). /home/profile said "Enter the code we sent
 * to <address>" for any saved, unverified email, including after the send
 * had failed or the 10-minute code had lapsed, so any code was refused.
 * The page now passes when the pending code for that address was sent (null
 * when none is pending, from the same rule as the home prompt), and without
 * one the card offers to send a code instead of claiming one was sent.
 */

const bundle = await build({
  entryPoints: ["components/customer/profile-about-you.tsx"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["react", "react-dom", "next"],
  mainFields: ["module", "main"],
  jsx: "automatic",
  plugins: [
    {
      // PR #410's WalletLinkNextStep imports the server-only reset action.
      name: "session-reset-action-stub",
      setup(build) {
        build.onResolve(
          { filter: /^@\/app\/home\/session\/reset\/actions$/ },
          () => ({
            path: "session-reset-actions",
            namespace: "reset-stub",
          })
        )
        build.onLoad({ filter: /.*/, namespace: "reset-stub" }, () => ({
          contents: "export async function resetCustomerSessionAction() {}",
        }))
      },
    },
    {
      name: "profile-actions-stub",
      setup(build) {
        build.onResolve(
          { filter: /^@\/app\/home\/\(authed\)\/profile\/actions$/ },
          () => ({
            path: "profile-actions",
            namespace: "stub",
          })
        )
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents:
            "export async function saveHomeProfileAction() { return {} } export async function verifyHomeProfileEmailAction() { return {} } export async function resendHomeProfileEmailAction() { return {} } export async function clearHomeProfileEmailAction() {}",
        }))
      },
    },
  ],
})
const compiled = { exports: {} }
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  createRequire(import.meta.url),
  compiled,
  compiled.exports
)
const { CustomerProfileAboutYou } = compiled.exports

const unverified = {
  phone: "07700 900123",
  fullName: "Alex Guest",
  dateOfBirth: "1990-01-01",
  email: "alex@example.test",
  emailVerified: false,
  emailLocked: false,
  needsEmailVerification: true,
}

const text = (props) =>
  renderToStaticMarkup(createElement(CustomerProfileAboutYou, props))
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")

test("Given an unverified email and no pending code When the profile renders Then it offers to send a code and claims none was sent", () => {
  const copy = text({ profile: unverified, emailCodeSentAt: null })

  assert.doesNotMatch(copy, /code we sent/i)
  assert.doesNotMatch(copy, /Email code/)
  assert.match(copy, /Confirm your email/)
  assert.match(copy, /alex@example\.test/)
  assert.match(copy, /Send me a code/)
  assert.match(copy, /Continue without email/)
  assert.doesNotMatch(copy, /!/)
})

test("Given a code is pending for the saved email When the profile renders Then it asks for that code", () => {
  const copy = text({ profile: unverified, emailCodeSentAt: 1_790_000_000 })

  assert.match(copy, /Enter the code we sent to alex@example\.test\./)
  assert.match(copy, /Your code/)
  assert.match(copy, /Send a new code/)
  assert.doesNotMatch(copy, /Send me a code/)
  // Linking rules are the previous-stamps task's, not this form's.
  assert.doesNotMatch(copy, /wallet|verif/i)
})

test("Given a card with no mobile number When the details summary renders Then Contact says why to add one and shows the email as Confirmed", () => {
  const copy = text({
    profile: {
      phone: null,
      fullName: "Alex Guest",
      dateOfBirth: "1990-01-01",
      email: "alex@example.test",
      emailVerified: true,
      emailLocked: true,
      needsEmailVerification: false,
    },
    emailCodeSentAt: null,
  })

  assert.match(copy, /Your details/)
  assert.match(copy, /Contact/)
  assert.match(copy, /Mobile Not added/)
  assert.match(
    copy,
    /Add your mobile number so you can sign in on another phone\./
  )
  assert.match(copy, /alex@example\.test Confirmed/)
  assert.match(
    copy,
    /To change a confirmed number or email, ask staff at a venue\./
  )
  assert.doesNotMatch(copy, /verified|locked|account security|paused/i)
})

test("Given a card with a confirmed mobile number When the summary renders Then it is shown as Confirmed without the add prompt", () => {
  const copy = text({
    profile: {
      phone: "07700 900123",
      fullName: "Alex Guest",
      dateOfBirth: "1990-01-01",
      email: null,
      emailVerified: false,
      emailLocked: false,
      needsEmailVerification: false,
    },
    emailCodeSentAt: null,
  })

  assert.match(copy, /07700 900123 Confirmed/)
  assert.match(copy, /Email Not added/)
  assert.doesNotMatch(copy, /Add your mobile number/)
})

test("Given a details save When the card picks its next mode Then it reads the structured outcome, never the message copy", async () => {
  const { readFileSync } = await import("node:fs")
  const source = readFileSync(
    "components/customer/profile-about-you.tsx",
    "utf8"
  )

  assert.doesNotMatch(source, /\.test\(saveState\.message\)/)
  assert.match(source, /saveState\.outcome === "email_code_sent"/)
})
