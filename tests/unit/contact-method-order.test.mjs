import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

const bundle = await build({
  entryPoints: ["components/customer/contact-method-order.tsx"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["react", "react-dom", "next"],
  mainFields: ["module", "main"],
  jsx: "automatic",
  alias: { "@": "." },
})
const compiled = { exports: {} }
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  createRequire(import.meta.url),
  compiled,
  compiled.exports
)
const {
  ContactMethodOrder,
  ContactStepLink,
  LAST_CONTACT_METHOD_KEY,
  leadContactMethod,
  rememberContactMethodOnSubmit,
  restoreContactMethodAfterAnswer,
  restoreContactMethodAfterNoWallet,
} = compiled.exports

/** A browser-shaped local store for the client-only helpers. */
function withStore(initial, run) {
  const store = new Map(
    initial === null ? [] : [[LAST_CONTACT_METHOD_KEY, initial]]
  )
  const previousWindow = globalThis.window
  globalThis.window = {
    localStorage: {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key),
    },
    addEventListener() {},
    removeEventListener() {},
  }
  try {
    run(() => store.get(LAST_CONTACT_METHOD_KEY) ?? null)
  } finally {
    globalThis.window = previousWindow
  }
}

test("Given the documented key When the store is read Then it is the one the cookie notice lists", () => {
  assert.equal(LAST_CONTACT_METHOD_KEY, "nabaperks.last-contact-method")
})

test("Given a remembered method When the screen may be reordered Then the device's method leads", () => {
  assert.equal(leadContactMethod("phone", "email", true), "phone")
  assert.equal(leadContactMethod("email", "phone", true), "email")
})

test("Given the address asked for a method When the device remembers another Then the request wins", () => {
  assert.equal(leadContactMethod("phone", "email", false), "email")
  assert.equal(leadContactMethod("email", "phone", false), "phone")
})

test("Given nothing or junk is stored When the lead is chosen Then the server default holds", () => {
  for (const stored of [null, "", "sms", "EMAIL", "whatsapp"]) {
    assert.equal(leadContactMethod(stored, "email", true), "email")
    assert.equal(leadContactMethod(stored, "phone", true), "phone")
  }
})

test("Given a server render When both screens are offered Then the mode default renders, so hydration agrees", () => {
  const html = renderToStaticMarkup(
    createElement(ContactMethodOrder, {
      defaultMethod: "email",
      email: createElement("p", null, "email screen"),
      phone: createElement("p", null, "phone screen"),
    })
  )
  assert.equal(html, "<p>email screen</p>")
})

test("Given a server render of the welcome link When the default is phone Then it links the phone step", () => {
  const html = renderToStaticMarkup(
    createElement(
      ContactStepLink,
      {
        defaultMethod: "phone",
        overridable: true,
        phoneHref: "/m/old-crown/join?qr=q&step=phone",
        emailHref: "/m/old-crown/join?qr=q&step=email",
        className: "w-full",
      },
      "Claim my first stamp"
    )
  )
  assert.match(html, /href="\/m\/old-crown\/join\?qr=q&amp;step=phone"/)
  assert.match(html, /class="w-full"/)
})

test("Given mode existing (phone default) When this device last confirmed by email Then email leads", () => {
  // D12 as decided for this PR: the device's last confirmed method reorders
  // the contact screens in both modes; the mode only sets the default.
  assert.equal(leadContactMethod("email", "phone", true), "email")
  assert.equal(leadContactMethod(null, "phone", true), "phone")
})

test("Given a code check that answers in place When it settles Then the stored method is put back", () => {
  withStore("phone", (stored) => {
    rememberContactMethodOnSubmit("email")
    assert.equal(stored(), "email")
    restoreContactMethodAfterAnswer()
    assert.equal(stored(), "phone")
  })
  withStore(null, (stored) => {
    rememberContactMethodOnSubmit("phone")
    restoreContactMethodAfterAnswer()
    assert.equal(stored(), null)
  })
})

test("Given an email that opened no wallet When the choice screen opens Then the device keeps its earlier method", () => {
  withStore("phone", (stored) => {
    rememberContactMethodOnSubmit("email")
    restoreContactMethodAfterNoWallet("email")
    assert.equal(stored(), "phone")

    // Starting a wallet with that email is a sign-in by email.
    rememberContactMethodOnSubmit("email")
    assert.equal(stored(), "email")
  })
})

test("Given a phone code check When the email choice screen opens Then it leaves the phone choice alone", () => {
  withStore("email", (stored) => {
    rememberContactMethodOnSubmit("phone")
    // Only a pending email check is undone by the choice screen.
    restoreContactMethodAfterNoWallet("email")
    assert.equal(stored(), "phone")
  })
})

test("Given a check already settled When it settles again Then nothing changes", () => {
  withStore("phone", (stored) => {
    rememberContactMethodOnSubmit("email")
    restoreContactMethodAfterAnswer()
    rememberContactMethodOnSubmit("email")
    restoreContactMethodAfterNoWallet("email")
    restoreContactMethodAfterAnswer()
    restoreContactMethodAfterNoWallet("email")
    assert.equal(stored(), "phone")
  })
})
