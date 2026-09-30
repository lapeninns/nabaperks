import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * Follow-up to QA BUG-036 (38c42a1..2c45031). Once the profile card showed
 * "Send me a code" without a pending code, it rendered only the code-field
 * error from a confirmation. A confirmation the server refused after the code
 * was approved (for example `confirm_failed`) also withdraws the pending code,
 * so the card re-renders in that no-code state and the refusal vanished.
 */

const actionStates = new Map()
const require = createRequire(import.meta.url)
const patchedReact = {
  ...React,
  useActionState: (action, initial) => [
    actionStates.get(action.name) ?? initial,
    action,
    false,
  ],
}

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
          () => ({ path: "profile-actions", namespace: "stub" })
        )
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: [
            "export async function saveHomeProfileAction() { return {} }",
            "export async function verifyHomeProfileEmailAction() { return {} }",
            "export async function resendHomeProfileEmailAction() { return {} }",
            "export async function clearHomeProfileEmailAction() {}",
          ].join("\n"),
        }))
      },
    },
  ],
})
const compiled = { exports: {} }
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  (id) => (id === "react" ? patchedReact : require(id)),
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

function text(verifyState) {
  actionStates.clear()
  actionStates.set("verifyHomeProfileEmailAction", verifyState)
  return renderToStaticMarkup(
    createElement(CustomerProfileAboutYou, {
      profile: unverified,
      emailCodeSentAt: null,
    })
  )
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
}

test("Given a refused confirmation withdrew the code When the profile card re-renders without a pending code Then the refusal is still shown", () => {
  const copy = text({
    errors: { form: "We couldn't confirm your email. Try again." },
  })

  assert.match(copy, /Send me a code/)
  assert.match(copy, /Email not confirmed/)
  assert.match(copy, /We couldn't confirm your email\. Try again\./)
})

test("Given a code-field error and no pending code When the profile card renders Then that error is still shown", () => {
  const copy = text({
    errors: { otp: "That code has expired. Send a new code." },
  })

  assert.match(copy, /That code has expired\. Send a new code\./)
  assert.doesNotMatch(copy, /Email not confirmed/)
})
