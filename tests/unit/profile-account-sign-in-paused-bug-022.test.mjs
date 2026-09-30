import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * QA BUG-022 (38c42a1..2c45031), revised by the guest journey redesign. A card
 * with no confirmed mobile number used to be warned that "Email sign-in is
 * paused", which exposed a rollout setting and implied email was a way in.
 * Phone is the only way in: the account section names it only for a card
 * with a phone, and a card without one is asked to add it in the Contact
 * group ("Add your mobile number so you can sign in on another phone.").
 */

import { readFileSync } from "node:fs"

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

test("Given a card with no mobile number When the account section renders Then it names no sign-in route and exposes no rollout setting", () => {
  const copy = text(render({}))

  assert.doesNotMatch(copy, /Sign back in with/)
  assert.doesNotMatch(copy, /paused|email sign-in|wallet|account security/i)
  assert.match(copy, /\bSign out\b/)
  assert.match(copy, /Sign out on all devices/)
  assert.doesNotMatch(copy, /!|—/)
})

test("Given a card with a mobile number When the account section renders Then it names the mobile number", () => {
  const copy = text(render({ signInWith: "your mobile number" }))

  assert.match(copy, /Sign back in with your mobile number\./)
})

test("Given the profile page When it builds the account section Then email is never passed as a sign-in route and no paused warning is wired", () => {
  const page = readFileSync("app/home/(authed)/profile/page.tsx", "utf8")

  assert.match(
    page,
    /signInWith=\{hasPhone \? "your mobile number" : undefined\}/
  )
  assert.doesNotMatch(page, /emailSignInPaused|customerSignInMethodsLabel/)
})

test("Given a card with no mobile number When Contact renders Then it says why to add one", () => {
  const aboutYou = readFileSync(
    "components/customer/profile-about-you.tsx",
    "utf8"
  )

  assert.match(
    aboutYou,
    /Add your mobile number so you can sign in on another phone\./
  )
  assert.doesNotMatch(
    aboutYou,
    /verified and locked|locked for account security/
  )
})
