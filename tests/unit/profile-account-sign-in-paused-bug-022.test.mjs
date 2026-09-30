import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * QA BUG-022 (38c42a1..2c45031). With `CUSTOMER_EMAIL_AUTH_MODE=off`, a wallet
 * with no verified phone cannot sign back in at all, yet the account section
 * told it to "Sign back in with your email" beside "Log out". The page now
 * passes `emailSignInPaused`, and the section warns before either log-out
 * control and points to adding a phone instead of promising email sign-in.
 */

const bundle = await build({
  entryPoints: ["components/customer/profile-account-section.tsx"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["react", "react-dom", "next"],
  mainFields: ["module", "main"],
  jsx: "automatic",
})
const compiled = { exports: {} }
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  createRequire(import.meta.url),
  compiled,
  compiled.exports
)
const { CustomerProfileAccountSection } = compiled.exports

const render = (props) =>
  renderToStaticMarkup(
    createElement(CustomerProfileAccountSection, {
      memberSinceLabel: "September 2026",
      venueLabel: "1 venue",
      signOutAction: () => {},
      signOutAllAction: () => {},
      ...props,
    })
  )

const text = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")

test("Given email sign-in is paused and the wallet has no phone When the account section renders Then it warns before logging out and points to adding a phone", () => {
  const html = render({ signInWith: "your email", emailSignInPaused: true })
  const copy = text(html)

  assert.doesNotMatch(copy, /Sign back in with your email/)
  const warning = copy.search(/Add a phone number before you log out/)
  assert.ok(warning >= 0, "warning shown")
  assert.match(
    copy,
    /Email sign-in is paused, so you could not sign back in to this account/
  )
  assert.match(copy, /Add a phone number in Your contact details above/)
  // The warning comes before both log-out controls.
  assert.ok(warning < copy.indexOf("Log out on all devices"))
  assert.ok(warning < copy.search(/\bLog out\b/))
  assert.doesNotMatch(copy, /!/)
})

test("Given email sign-in is on When the account section renders Then it names the sign-in route without a warning", () => {
  const copy = text(render({ signInWith: "your email" }))

  assert.match(copy, /Sign back in with your email\./)
  assert.doesNotMatch(copy, /before you log out/)
})

test("Given a wallet with a phone When the account section renders Then the phone sign-in copy is unchanged", () => {
  const copy = text(render({ signInWith: "your phone number" }))

  assert.match(copy, /Sign back in with your phone number\./)
  assert.doesNotMatch(copy, /before you log out/)
})
