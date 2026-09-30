import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"
import React, { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

/**
 * QA BUG-036 remainder (38c42a1..2c45031). The reward gate's email step said
 * "Enter the code we sent to <address>" for any saved, unverified email, even
 * when no code was pending (a failed send, a lapsed 10-minute code, another
 * browser), so every code was refused. The gate now carries whether a code
 * for the saved address is pending (the home prompt's rule) and, without
 * one, offers to send a code instead of claiming one was sent. A refused
 * confirmation that also withdrew the code keeps its answer on screen.
 */

const actionStates = new Map()
const require = createRequire(import.meta.url)
const patchedReact = {
  ...React,
  // Server rendering cannot run an action, so a test names the state each
  // action returned; the component renders it exactly as after a submit.
  useActionState: (action, initial) => [
    actionStates.get(action.name) ?? initial,
    action,
    false,
  ],
}

const bundle = await build({
  entryPoints: ["components/customer/profile-gate-forms.tsx"],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  external: ["react", "react-dom", "next"],
  mainFields: ["module", "main"],
  jsx: "automatic",
  plugins: [
    {
      name: "gate-actions-stub",
      setup(build) {
        build.onResolve(
          {
            filter:
              /^@\/app\/(reward\/\[rewardId\]\/actions|home\/\(authed\)\/profile\/phone-actions)$/,
          },
          (args) => ({ path: args.path, namespace: "stub" })
        )
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: [
            "export async function saveProfileForRedeemAction() { return {} }",
            "export async function verifyProfileEmailAction() { return {} }",
            "export async function resendProfileEmailAction() { return {} }",
            "export async function rewardPhoneAction() { return {} }",
            "export async function profilePhoneAction() { return {} }",
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
const { CustomerProfileGateForm } = compiled.exports

const emailStepGate = {
  complete: false,
  dateOfBirthVerified: false,
  needsEmailVerification: true,
  fullName: "Alex Guest",
  dateOfBirth: "1990-01-01",
  email: "alex@example.test",
  emailLocked: false,
}

function text(gate, states = {}) {
  actionStates.clear()
  for (const [name, state] of Object.entries(states)) {
    actionStates.set(name, state)
  }
  return renderToStaticMarkup(
    createElement(CustomerProfileGateForm, { rewardId: "reward-1", gate })
  )
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ")
}

test("Given an unverified gate email and no pending code When the reward gate renders Then it offers to send a code and claims none was sent", () => {
  const copy = text({ ...emailStepGate, emailCodePending: false })

  assert.doesNotMatch(copy, /code we sent/i)
  assert.doesNotMatch(copy, /Email code/)
  assert.doesNotMatch(copy, /Confirm email/)
  assert.match(copy, /alex@example\.test is not confirmed yet/)
  assert.match(copy, /Send me a code/)
  assert.doesNotMatch(copy, /!/)
})

test("Given a code is pending for the gate email When the reward gate renders Then it asks for that code", () => {
  const copy = text({ ...emailStepGate, emailCodePending: true })

  assert.match(copy, /Enter the code we sent to alex@example\.test\./)
  assert.match(copy, /Email code/)
  assert.match(copy, /Confirm email/)
  assert.doesNotMatch(copy, /Send me a code/)
})

test("Given a confirmation was refused and the code withdrawn When the reward gate re-renders without a pending code Then the refusal stays on screen", () => {
  const copy = text(
    { ...emailStepGate, emailCodePending: false },
    {
      verifyProfileEmailAction: {
        errors: { form: "We couldn't confirm your email. Try again." },
      },
    }
  )

  assert.match(copy, /Send me a code/)
  assert.match(copy, /Email not confirmed/)
  assert.match(copy, /We couldn't confirm your email\. Try again\./)
})

test("Given the send-a-code request failed When the reward gate renders without a pending code Then it says the code was not sent", () => {
  const copy = text(
    { ...emailStepGate, emailCodePending: false },
    {
      resendProfileEmailAction: {
        errors: {
          form: "We couldn't email a code just now. Try again shortly.",
        },
      },
    }
  )

  assert.match(copy, /Code not sent/)
  assert.match(copy, /We couldn't email a code just now/)
  assert.doesNotMatch(copy, /code we sent/i)
})
