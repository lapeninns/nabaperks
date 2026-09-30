import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import React, { createElement, isValidElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * "Send me reminders by phone" with reminders off: ticking it must reveal the
 * "Send them by" choice straight away, starting from the standing channel, so
 * the channel the guest sees is the one the form submits, never a hidden stale
 * value. The real fields component renders; only `useState` is driven by the
 * test so a tick can be replayed without a browser.
 */
const require = createRequire(import.meta.url)
let hookState
const patchedReact = {
  ...React,
  useState(initial) {
    if (hookState === undefined) hookState = initial
    return [hookState, (next) => (hookState = next)]
  },
}

const bundle = await build({
  entryPoints: ["components/customer/phone-messaging-settings.tsx"],
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
          () => ({ path: "profile-actions", namespace: "stub" })
        )
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents:
            "export async function updateHomePhoneMessagingAction() { return {} }",
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
const { PhoneMessagingFields } = compiled.exports

function findCheckbox(node) {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findCheckbox(child)
      if (found) return found
    }
    return null
  }
  if (!isValidElement(node)) return null
  if (node.type === "input" && node.props.type === "checkbox") return node
  return findCheckbox(node.props.children)
}

function view(preferences) {
  const props = { preferences, disabled: false }
  const tree = PhoneMessagingFields(props)
  return {
    checkbox: findCheckbox(tree),
    html: renderToStaticMarkup(createElement(PhoneMessagingFields, props)),
  }
}

for (const preferredPhoneChannel of ["sms", "whatsapp"]) {
  test(`Given reminders are off by ${preferredPhoneChannel} When the guest ticks the box Then the channel choice appears at once with the standing channel selected`, () => {
    hookState = undefined
    const preferences = {
      phoneMessagesEnabled: false,
      preferredPhoneChannel,
      whatsappUnavailableAt: null,
    }

    const off = view(preferences)
    assert.equal(off.checkbox.props.checked, false)
    assert.doesNotMatch(off.html, /<select/)
    assert.match(
      off.html,
      new RegExp(
        `type="hidden" name="preferredPhoneChannel" value="${preferredPhoneChannel}"`
      )
    )

    off.checkbox.props.onChange({ currentTarget: { checked: true } })

    const on = view(preferences)
    assert.equal(on.checkbox.props.checked, true)
    assert.match(on.html, /Send them by/)
    assert.match(on.html, /<select[^>]*name="preferredPhoneChannel"/)
    assert.match(
      on.html,
      new RegExp(`<option value="${preferredPhoneChannel}" selected="">`)
    )
    // Only the visible choice is submitted.
    assert.doesNotMatch(on.html, /type="hidden" name="preferredPhoneChannel"/)

    // Unticked again: the choice hides and the standing channel is kept.
    on.checkbox.props.onChange({ currentTarget: { checked: false } })
    assert.doesNotMatch(view(preferences).html, /<select/)
  })
}

test("Given reminders are on When the fields render Then the choice shows the saved channel", () => {
  hookState = undefined
  const { checkbox, html } = view({
    phoneMessagesEnabled: true,
    preferredPhoneChannel: "whatsapp",
    whatsappUnavailableAt: null,
  })
  assert.equal(checkbox.props.checked, true)
  assert.match(html, /<option value="whatsapp" selected="">/)
})
