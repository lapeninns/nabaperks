import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

// Email sign-in Step 0: the contact and sign-in tracking vocabulary.
const CONTACT_EVENTS = [
  "customer_email_prompt_viewed",
  "customer_email_prompt_dismissed",
  "customer_email_verification_started",
  "customer_email_verified",
  "customer_contact_conflict",
  "customer_login_code_requested",
  "customer_login_code_send_failed",
  "customer_login_verified",
  "customer_login_no_wallet",
  "join_code_send_failed",
]

const VOCABULARY_FILES = new Set([
  path.join(projectRoot, "lib", "analytics", "events.ts"),
  path.join(projectRoot, "lib", "customer", "contact-event-core.ts"),
])

test("Given the contact tracking events When the vocabulary is read Then each is registered in the product event list and the closed contact vocabulary", () => {
  const events = readProjectFile("lib", "analytics", "events.ts")
  const core = readProjectFile("lib", "customer", "contact-event-core.ts")
  for (const name of CONTACT_EVENTS) {
    assert.match(events, new RegExp(`"${name}"`), `events.ts: ${name}`)
    assert.match(core, new RegExp(`"${name}"`), `contact-event-core: ${name}`)
  }
})

test("Given the contact tracking events When the app is scanned Then every event has a real emit site", () => {
  const sources = ["app", "components", "lib"]
    .flatMap((dir) => walk(path.join(projectRoot, dir)))
    .filter((file) => !VOCABULARY_FILES.has(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n")
  for (const name of CONTACT_EVENTS) {
    assert.match(sources, new RegExp(`"${name}"`), `no emit site for ${name}`)
  }
})

test("Given a browser can call the prompt recorder When it is invoked Then only the two prompt events and prompt surfaces are accepted for a signed-in customer", () => {
  const recorder = readProjectFile("lib", "customer", "email-prompt-events.ts")
  assert.match(recorder, /^"use server"/)
  assert.match(recorder, /isClientEmailPromptEvent\(eventName\)/)
  assert.match(recorder, /isEmailPromptSurface\(surface\)/)
  assert.match(recorder, /getCurrentCustomer\(\)/)
  assert.match(recorder, /catch \(error\)/)
})

test("Given server-side contact events When they are recorded Then metadata is reduced to the closed vocabulary and written after the response", () => {
  const recorder = readProjectFile("lib", "customer", "contact-events.ts")
  assert.match(recorder, /contactEventMetadata\(input\.metadata\)/)
  assert.match(recorder, /scheduleAfterResponseAnalytics\(after,/)
})

test("Given the phone sign-in and join send paths When they succeed or fail Then they emit the tracking events", () => {
  const login = readProjectFile("app", "home", "actions.ts")
  for (const name of [
    "customer_login_code_requested",
    "customer_login_code_send_failed",
    "customer_login_verified",
    "customer_login_no_wallet",
  ]) {
    assert.match(login, new RegExp(`"${name}"`), name)
  }
  const join = readProjectFile(
    "app",
    "m",
    "[merchantSlug]",
    "join",
    "actions.ts"
  )
  const sendFailure = join.indexOf('logVerificationSendFailure("join", error)')
  assert.ok(sendFailure > 0)
  assert.match(
    join.slice(sendFailure, sendFailure + 200),
    /recordJoinCodeSendFailed\(/
  )
  assert.match(join, /eventName: "join_code_send_failed"/)
})
