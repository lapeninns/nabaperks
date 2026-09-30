import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * The hosted customer live-DB lane (.github/workflows/customer-live-db.yml,
 * QA BUG-051) must run every @customer-flow live-DB journey with the flags it
 * needs, and fail when a selected journey skips. Without this check a new
 * live spec, or a renamed one, silently drops out of the lane and the lane
 * stays green while proving nothing about it.
 *
 * A spec belongs to the lane when it is a `*-live-db.spec.ts` file tagged
 * @customer-flow, gated by customerReadbackLiveDbSkipReason (CUSTOMER_FLOW_E2E)
 * and not by the admin live-DB gate (that tier runs in production-database.yml).
 * Specs gated to email sign-in mode `existing` run in the second invocation;
 * everything else runs in mode `full`, as in production.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const read = (...parts) => readFileSync(path.join(root, ...parts), "utf8")
const WORKFLOW = path.join(".github", "workflows", "customer-live-db.yml")

function liveCustomerSpecs() {
  const lane = { full: [], existing: [] }
  for (const name of readdirSync(path.join(root, "tests", "e2e")).sort()) {
    if (!name.endsWith("-live-db.spec.ts")) continue
    const source = read("tests", "e2e", name)
    if (!source.includes("@customer-flow")) continue
    if (!source.includes("customerReadbackLiveDbSkipReason")) continue
    if (source.includes("adminLiveDbSkipReason")) continue
    const mode =
      source.match(/customerJoinEmailSkipReason\("(\w+)"\)/)?.[1] ?? "full"
    assert.ok(mode in lane, `${name} needs an email mode the lane runs`)
    lane[mode].push(`tests/e2e/${name}`)
  }
  return lane
}

/** The workflow's steps as text blocks, keyed by step name. */
function workflowSteps() {
  const text = read(WORKFLOW)
  const steps = new Map()
  const chunks = text.split(/\n(?= {6}- )/)
  for (const chunk of chunks) {
    const name = chunk.match(/^ {6}- name: (.+)$/m)?.[1]
    if (name) steps.set(name.trim(), chunk)
  }
  return { text, steps }
}

function step(steps, name) {
  const block = steps.get(name)
  assert.ok(block, `the lane has a step named "${name}"`)
  return block
}

const specsIn = (block) =>
  [...block.matchAll(/tests\/e2e\/[\w-]+\.spec\.ts/g)].map((match) => match[0])

test("the lane runs every @customer-flow live-DB journey in its email mode", () => {
  const expected = liveCustomerSpecs()
  assert.ok(expected.full.length > 0, "live customer specs exist")
  assert.ok(expected.existing.length > 0, "an existing-mode spec exists")
  const { steps } = workflowSteps()

  const full = step(
    steps,
    "Run customer live-DB journeys (email sign-in mode full)"
  )
  const existing = step(
    steps,
    "Run customer live-DB journeys (email sign-in mode existing)"
  )
  assert.deepEqual(specsIn(full).sort(), expected.full.sort())
  assert.deepEqual(specsIn(existing).sort(), expected.existing.sort())

  for (const [block, mode] of [
    [full, "full"],
    [existing, "existing"],
  ]) {
    assert.match(block, /CUSTOMER_FLOW_E2E: "1"/)
    assert.match(block, new RegExp(`CUSTOMER_EMAIL_AUTH_MODE: ${mode}\\n`))
    assert.match(block, /--project=mobile-safari/)
    assert.match(block, /--reporter=list,json/)
    assert.match(block, /PLAYWRIGHT_JSON_OUTPUT_FILE: .*\.json/)
  }
})

test("the lane runs the merchant collection and member readback live specs", () => {
  const { steps } = workflowSteps()
  const merchant = step(
    steps,
    "Run merchant live-DB collection and member readback"
  )
  assert.deepEqual(specsIn(merchant).sort(), [
    "tests/e2e/merchant-customer-readback.spec.ts",
    "tests/e2e/merchant-reward-scan.spec.ts",
  ])
  assert.match(merchant, /ADMIN_LIVE_DB_E2E: "1"/)
  assert.match(merchant, /--grep @admin-live-db/)
  assert.match(merchant, /--project=mobile-safari/)
})

const RUN_AND_CHECK = [
  [
    "Run customer live-DB journeys (email sign-in mode full)",
    "Require every selected mode-full journey to run",
  ],
  [
    "Run customer live-DB journeys (email sign-in mode existing)",
    "Require every selected mode-existing journey to run",
  ],
  [
    "Run merchant live-DB collection and member readback",
    "Require every selected merchant journey to run",
  ],
]

test("a skipped, failed or empty selection fails the lane", () => {
  const { steps } = workflowSteps()
  for (const [runName, checkName] of RUN_AND_CHECK) {
    const run = step(steps, runName)
    const check = step(steps, checkName)
    const report = run.match(/PLAYWRIGHT_JSON_OUTPUT_FILE: (.+)$/m)?.[1]
    assert.ok(report, `${runName} writes a JSON report`)
    assert.ok(
      check.includes(`REPORT: ${report}`),
      "the check reads that report"
    )
    assert.match(check, /if: \$\{\{ !cancelled\(\) \}\}/)
    assert.match(check, /stats\.skipped !== 0/)
    assert.match(check, /stats\.unexpected !== 0/)
    assert.match(check, /stats\.expected > 0/)
  }
})

test("the lane uses an isolated local stack, generated secrets and no repository secrets", () => {
  const { text, steps } = workflowSteps()
  assert.doesNotMatch(text, /\$\{\{\s*secrets\./)
  assert.match(text, /^permissions:\n {2}contents: read\n/m)
  assert.match(
    text,
    /SUPABASE_DB_URL: postgres:\/\/postgres:postgres@127\.0\.0\.1:54322\//
  )
  assert.match(text, /NEXT_PUBLIC_SUPABASE_URL: http:\/\/127\.0\.0\.1:54321\n/)
  assert.match(text, /PLAYWRIGHT_BASE_URL: http:\/\/127\.0\.0\.1:\d+\n/)
  // The live phone fixtures refuse anything but the synthetic Twilio values.
  assert.match(text, /TWILIO_ACCOUNT_SID: ACci\n/)
  const secrets = step(steps, "Generate local-only secrets")
  for (const name of [
    "CUSTOMER_SESSION_SECRET",
    "CUSTOMER_PHONE_HMAC_SECRET",
    "CUSTOMER_EMAIL_HMAC_SECRET",
    "CUSTOMER_EMAIL_ENCRYPTION_KEY",
  ]) {
    assert.match(secrets, new RegExp(`${name} "\\$\\(openssl rand -hex 32\\)"`))
  }
  assert.match(
    step(steps, "Start isolated Supabase and export its local API keys"),
    /supabase start/
  )
  assert.match(text, /- run: pnpm db:seed\n/)
  assert.match(text, /- run: supabase stop --no-backup\n {8}if: always\(\)/)
})

test("the lane stays advisory: it is not a required root or a Release gate input", () => {
  const ci = read(".github", "workflows", "ci.yml")
  assert.doesNotMatch(ci, /customer-live-db/)
  const required = read("scripts", "ci", "verify-required-evidence.mjs")
  assert.doesNotMatch(required, /customer-live-db/)
})
