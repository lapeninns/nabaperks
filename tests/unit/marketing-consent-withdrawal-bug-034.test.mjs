import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * QA BUG-034 (38c42a1..2c45031), withdrawal rework. New email opt-ins need a
 * verified email, but the pre-fix join and profile wrote `opted_in` email
 * rows for phone wallets with no email or an unconfirmed one. Hiding the
 * Email toggle for every unverified wallet left those customers unable to
 * withdraw. The profile must:
 *  - offer the normal Email toggle with a verified email;
 *  - keep an Email toggle that can only be turned off, with a short
 *    explanation, when the email is unverified but email updates are on;
 *  - hide Email when it is unverified and not opted in.
 *
 * The real server component, client rows and channel rules are rendered;
 * only the session read and the server action module are stubbed. The
 * server-side refusal of an unverified email opt-in, and acceptance of the
 * opt-out, run through the real action in
 * tests/unit/marketing-consent-verified-contact.test.mjs.
 */
const STUBS = {
  "server-only": "",
  "@/lib/customer/consent":
    "export async function getMarketingConsentEligibility() { throw new Error('eligibility is passed literally in these cases') }",
  "@/app/home/(authed)/profile/actions":
    "export async function updateHomeMarketingConsentAction(state) { return state }",
}

const escape = (value) => value.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")
const STUB_FILTER = new RegExp(
  `^(${Object.keys(STUBS).map(escape).join("|")})$`
)

async function loadSection() {
  const result = await build({
    entryPoints: ["components/customer/profile-marketing-consent.tsx"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: ["react", "react-dom", "next/link", "next/image"],
    logLevel: "silent",
    plugins: [
      {
        name: "consent-section-boundaries",
        setup(build) {
          build.onResolve({ filter: STUB_FILTER }, ({ path }) => ({
            path,
            namespace: "stub",
          }))
          build.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({
            contents: STUBS[path],
            loader: "js",
          }))
        },
      },
    ],
  })
  const compiled = { exports: {} }
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    createRequire(import.meta.url),
    compiled,
    compiled.exports
  )
  return compiled.exports.CustomerProfileMarketing
}

const CustomerProfileMarketing = await loadSection()

const PHONE_WALLET = { hasVerifiedPhone: true, membershipCount: 1 }

async function render({ consents, hasVerifiedEmail, hasVerifiedPhone }) {
  const element = await CustomerProfileMarketing({
    consents,
    hasPhone: true,
    eligibility: {
      ...PHONE_WALLET,
      ...(hasVerifiedPhone === undefined ? {} : { hasVerifiedPhone }),
      hasVerifiedEmail,
    },
  })
  const html = renderToStaticMarkup(element)
  const text = html
    .replace(/<script>[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
  const toggles = [
    ...html.matchAll(
      /<span class="sr-only">Receive ([A-Za-z]+) updates<\/span><input type="checkbox"([^>]*)\/>/g
    ),
  ].map(([, label, attributes]) => ({
    label,
    checked: /\bchecked=""/.test(attributes),
  }))
  return { text, toggles }
}

const WITHDRAW_ONLY_EMAIL = /can only turn email updates off/

test("Given a verified email When the profile lists marketing toggles Then Email is a normal toggle", async () => {
  const { text, toggles } = await render({
    consents: [{ channel: "email", optedIn: true }],
    hasVerifiedEmail: true,
  })
  assert.deepEqual(toggles, [
    { label: "Email", checked: true },
    { label: "SMS", checked: false },
    { label: "WhatsApp", checked: false },
  ])
  assert.doesNotMatch(text, WITHDRAW_ONLY_EMAIL)
})

test("Given an unverified email with email updates on When the profile renders Then the customer can still turn Email off and is told why they cannot turn it on", async () => {
  for (const consents of [
    [{ channel: "email", optedIn: true }],
    [
      { channel: "email", optedIn: true },
      { channel: "sms", optedIn: true },
    ],
  ]) {
    const { text, toggles } = await render({
      consents,
      hasVerifiedEmail: false,
    })
    assert.deepEqual(
      toggles.find((toggle) => toggle.label === "Email"),
      { label: "Email", checked: true }
    )
    assert.match(text, WITHDRAW_ONLY_EMAIL)
    assert.match(text, /Confirm an email address to turn them on again\./)
    assert.doesNotMatch(text, /!/)
  }
})

test("Given an unverified email without email updates on When the profile renders Then Email is not offered", async () => {
  for (const consents of [[], [{ channel: "email", optedIn: false }]]) {
    const { text, toggles } = await render({
      consents,
      hasVerifiedEmail: false,
    })
    assert.deepEqual(
      toggles.map((toggle) => toggle.label),
      ["SMS", "WhatsApp"]
    )
    assert.doesNotMatch(text, WITHDRAW_ONLY_EMAIL)
  }
})

test("Given an unverified phone with text updates on and no email When the profile renders Then text can still be turned off", async () => {
  const { text, toggles } = await render({
    consents: [{ channel: "sms", optedIn: true }],
    hasVerifiedEmail: false,
    hasVerifiedPhone: false,
  })
  assert.deepEqual(toggles, [{ label: "SMS", checked: true }])
  assert.match(text, /can only turn text and WhatsApp updates off/)
  assert.doesNotMatch(
    text,
    /Confirm your email or add a phone number to choose updates/
  )
})

test("Given unverified contacts and no standing opt-in When the profile renders Then it explains how to choose updates", async () => {
  const { text, toggles } = await render({
    consents: [{ channel: "email", optedIn: false }],
    hasVerifiedEmail: false,
    hasVerifiedPhone: false,
  })
  assert.deepEqual(toggles, [])
  assert.match(
    text,
    /Confirm your email or add a phone number to choose updates from your venues\./
  )
})
