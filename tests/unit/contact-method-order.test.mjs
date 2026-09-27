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
} = compiled.exports

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
