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

  assert.match(
    copy,
    /Enter the code we sent to alex@example\.test to verify it\./
  )
  assert.match(copy, /Email code/)
  assert.match(copy, /Email me a new code/)
  assert.doesNotMatch(copy, /Send me a code/)
})
