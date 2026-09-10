import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

function read(path) {
  return readFileSync(path, "utf8")
}

function readJson(path) {
  return JSON.parse(read(path))
}

/** `value` as a pattern that matches it literally. */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const CONTRACT_PATH = "config/local-ci-contract.json"
const CONTRACT = readJson(CONTRACT_PATH)
const SHADOW_PATH = CONTRACT.bridge.workflow
const BRIDGE_JOB = CONTRACT.bridge.job

/**
 * The text of one job, bounded at both ends.
 *
 * Slicing only from the start would let a job appended after this one carry
 * its own steps into every assertion here, and `indexOf` returning -1 would
 * make a "must contain" assertion fail for the wrong reason. Job bodies are
 * indented four spaces or more, so the first following line indented exactly
 * two spaces ends this job.
 */
function jobSlice(text, path, jobId) {
  const anchor = `\n  ${jobId}:\n`
  const start = text.indexOf(anchor)
  assert.notEqual(start, -1, `${path} must declare a "${jobId}" job`)
  const body = text.slice(start + anchor.length)
  const next = body.search(/\n {2}\S/)
  return anchor + body.slice(0, next === -1 ? body.length : next)
}

/**
 * One step of a job, bounded the same way.
 *
 * The whole point of this file is that the checkout step in particular pins a
 * ref, so the assertions have to be about that step and not about the job text
 * at large: a `ref:` belonging to some later step would satisfy a whole-job
 * match while leaving the checkout on the merge ref.
 */
function stepSlice(job, marker) {
  const start = job.indexOf(`\n      - ${marker}`)
  assert.notEqual(start, -1, `the ${BRIDGE_JOB} job must run ${marker}`)
  const body = job.slice(start + 1)
  const next = body.search(/\n {6}- /)
  // Keep the newline that ends the step's last line, so an assertion can
  // anchor on it and not silently depend on where the next step begins.
  return body.slice(0, next === -1 ? body.length : next + 1)
}

test("the shadow verifier runs from reviewed code, not from the candidate", () => {
  const shadow = read(SHADOW_PATH)
  const job = jobSlice(shadow, SHADOW_PATH, BRIDGE_JOB)
  const checkout = stepSlice(job, "uses: actions/checkout@")

  // Without an explicit ref, actions/checkout takes refs/pull/N/merge on a
  // pull request: the verifier script, the App-identity check it imports and
  // the pinned contract it reads would all come from the change being judged.
  const ref = checkout.match(/\n {10}ref: ([^\n]+)\n/)
  assert.ok(ref, `${SHADOW_PATH} must pin the checkout ref`)
  const expression = ref[1].trim()
  assert.match(expression, /github\.event_name == 'pull_request'/)
  assert.match(expression, /github\.event\.pull_request\.base\.sha/)
  assert.match(expression, /\|\| github\.sha/)
  // The base SHA is already on main; the head and merge refs are not.
  assert.doesNotMatch(expression, /pull_request\.head\.sha/)
  assert.doesNotMatch(expression, /pull_request\.merge_commit_sha/)
  assert.doesNotMatch(expression, /refs\/pull\//)

  // A verifier checkout is a read; it must not carry a usable token onward.
  assert.match(checkout, /\n {10}persist-credentials: false\n/)

  // The observation itself must still name the candidate. Pinning the
  // verifier to the base commit would be worthless if it also moved the
  // observation onto the base commit's proof.
  assert.match(
    job,
    /\n {10}LOCAL_CI_HEAD_SHA: \$\{\{ github\.event_name == 'pull_request' && github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}\n/
  )
  assert.match(job, new RegExp(`node ${escapeRegExp(CONTRACT.bridge.script)}`))

  // Reviewed code is only half of it: the observer still holds no write scope
  // it could use to publish a verdict of its own.
  assert.match(job, /\n {6}contents: read\n/)
  assert.match(job, /\n {6}checks: read\n/)
  assert.doesNotMatch(job, /: write\n/)
})
