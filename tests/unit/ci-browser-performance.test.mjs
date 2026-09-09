import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { packShards } from "../../scripts/ci/run-browser-pack.mjs"
import { browserPackRequests } from "../../scripts/ci/browser-pack.mjs"
import { browserArguments } from "../../scripts/ci/browser-workload.mjs"
import { workloads } from "../../scripts/ci/run-workload.mjs"
import {
  BROWSER_IMAGE_VERSION,
  verifyBrowserImage,
} from "../../scripts/ci/check-browser-image.mjs"

const CI_PATH = ".github/workflows/ci.yml"

/**
 * The complete hosted end-to-end selection, as Playwright partitions it.
 *
 * Packing changed how many jobs pay for checkout, the container pull and
 * browser verification - roughly fifty seconds of setup each, repeated
 * thirty-three times in the measured run. It did not change the denominator,
 * because the denominator is the unit of work: `--shard=n/32` names the same
 * tests whether four packs carry eight of them or eight packs carry four. So
 * this list is the thing that must survive every future regrouping, and every
 * assertion below is measured against it rather than against a job count.
 */
const E2E_SHARDS = Object.freeze(
  Array.from({ length: 32 }, (_, index) => `${index + 1}/32`)
)

/** Packs the workflow fans out over, one job each, after the regrouping. */
const E2E_PACKS = Object.freeze([1, 2, 3, 4])

const E2E_PROJECTS = Object.freeze([
  "chromium",
  "mobile-safari",
  "desktop-firefox",
  "desktop-safari",
])

function readCi() {
  return readFileSync(CI_PATH, "utf8")
}

/**
 * The text of one job in `ci.yml`, bounded at both ends.
 *
 * Slicing only from the start would carry the following job's body - and its
 * comments - into every "must not contain" assertion, which is how a guard
 * quietly stops guarding. Job bodies are indented four spaces or more, so the
 * first following line indented exactly two spaces ends this job.
 */
function jobSlice(text, jobId) {
  const anchor = `\n  ${jobId}:\n`
  const start = text.indexOf(anchor)
  assert.notEqual(start, -1, `${CI_PATH} must declare a "${jobId}" job`)
  const body = text.slice(start + anchor.length)
  const next = body.search(/\n {2}\S/)
  return anchor + body.slice(0, next === -1 ? body.length : next)
}

/** The values one matrix dimension declares, in file order. */
function matrixValues(job, dimension) {
  const match = job.match(new RegExp(`\\n {8}${dimension}: \\[([^\\]]+)\\]\\n`))
  assert.ok(match, `the matrix must declare an inline ${dimension} list`)
  return match[1].split(",").map((value) => value.trim())
}

test("four packs of eight cover every original shard exactly once", () => {
  const shards = E2E_PACKS.map((pack) => packShards(pack)).flat()

  // Set equality is the load-bearing assertion in this file. A length check
  // alone accepts a duplicated shard paired with a dropped one, which is
  // exactly the shape a "harmless" regrouping bug takes: the run still looks
  // full-size, and a slice of the suite silently stops being executed.
  assert.equal(shards.length, E2E_SHARDS.length, "no shard may run twice")
  assert.deepEqual(new Set(shards), new Set(E2E_SHARDS))
  // Ordering is asserted separately so a failure says which of the two
  // properties broke: coverage, or the contiguous grouping packs rely on.
  assert.deepEqual(shards, E2E_SHARDS)

  for (const project of E2E_PROJECTS)
    for (const pack of E2E_PACKS)
      assert.equal(
        browserPackRequests({ project, shards: packShards(pack) }).length,
        8
      )
  for (const invalid of [0, 5, 1.5, "01", "1;exit", undefined])
    assert.throws(() => packShards(invalid))
})

test("the workflow matrices declare exactly the packs and shards the code produces", () => {
  const ci = readCi()

  // A pack list and a packShards range that disagree lose tests without
  // failing anything: the packs the workflow omits are simply never run.
  const e2e = jobSlice(ci, "e2e")
  assert.deepEqual(matrixValues(e2e, "project"), [...E2E_PROJECTS])
  const packs = matrixValues(e2e, "pack")
  assert.deepEqual(
    packs,
    E2E_PACKS.map(String),
    "the e2e matrix must fan out over exactly the packs packShards accepts"
  )
  assert.deepEqual(
    new Set(packs.map((pack) => packShards(pack)).flat()),
    new Set(E2E_SHARDS)
  )

  // Accessibility keeps its denominator in the manifest rather than in the
  // workflow, so the matrix is derived from it rather than restated.
  const a11y = jobSlice(ci, "a11y")
  const definition = workloads.browsers["test:a11y"]
  assert.equal(definition.hostedShards, 4)
  assert.deepEqual(matrixValues(a11y, "project"), definition.projects)
  assert.deepEqual(
    matrixValues(a11y, "shard"),
    Array.from(
      { length: definition.hostedShards },
      (_, index) => `${index + 1}/${definition.hostedShards}`
    )
  )
  // Every declared shard is one the hosted plane will accept: an unqualified
  // shard fails only at run time, after the container has already been paid
  // for, and reads as infrastructure flake rather than as a coverage hole.
  for (const project of definition.projects)
    for (const shard of matrixValues(a11y, "shard"))
      assert.deepEqual(
        browserArguments({
          plane: "hosted",
          suite: "test:a11y",
          project,
          shard,
        }),
        ["test", `--project=${project}`, "--grep", "@a11y", `--shard=${shard}`]
      )
})

test("both browser tiers stay single-worker and neither narrows its selection", () => {
  const ci = readCi()

  for (const jobId of ["e2e", "a11y"]) {
    const job = jobSlice(ci, jobId)
    // Fewer jobs must not become cheaper jobs. Two workers on the dev-server
    // tier is the known 500 flake, and failOnFlakyTests turns any recovery
    // red - so the only lever this change is allowed to pull is job count.
    assert.match(job, /\n {6}PLAYWRIGHT_WORKERS: "1"\n/)
    assert.match(job, /\n {6}PLAYWRIGHT_REGULAR_CHROMIUM: "1"\n/)
    // Selection is declared once, in config/ci-workloads.json. A --grep or
    // --grep-invert spelled into the workflow would be a second source of
    // truth, and the cheapest way to make a slow tier look fast.
    assert.doesNotMatch(job, /--grep/)
  }

  const e2eDefinition = workloads.browsers["test:e2e"]
  const a11yDefinition = workloads.browsers["test:a11y"]
  assert.equal(e2eDefinition.hostedShards, 32)
  assert.equal(e2eDefinition.grepInvert, "@visual")
  assert.equal(e2eDefinition.grep, undefined)
  assert.equal(a11yDefinition.grep, "@a11y")
  assert.equal(a11yDefinition.grepInvert, undefined)
  // The pixel-baseline authority is out of scope for this change.
  assert.equal(workloads.browsers["test:visual"].hostedShards, 4)
})

test("CI concurrency cannot cancel the in-flight run of a previous main commit", () => {
  const ci = readCi()
  const start = ci.indexOf("\nconcurrency:\n")
  assert.notEqual(start, -1, `${CI_PATH} must declare workflow concurrency`)
  const rest = ci.slice(start + 1)
  const end = rest.search(/\n\S/)
  const concurrency = rest.slice(0, end === -1 ? rest.length : end)

  const cancel = concurrency.match(/\n {2}cancel-in-progress: (.+)/)
  assert.ok(cancel, "the concurrency group must declare cancel-in-progress")
  const expression = cancel[1].trim()

  // Fourteen per cent of the minutes in the sampled window were burned by
  // runs cancelled by concurrency. On a push to main that cancellation also
  // costs proof: the previous commit is left with no successful CI run at
  // all. Superseded pull-request pushes are still fair game, so this asserts
  // the expression is conditional rather than asserting a particular value.
  assert.notEqual(
    expression,
    "true",
    "unconditional cancellation abandons the previous main commit mid-run"
  )
  assert.match(
    expression,
    /^\$\{\{ .+ \}\}$/,
    "cancellation must be decided by an expression, not a literal"
  )
  assert.match(
    expression,
    /pull_request|refs\/heads\/main|github\.ref/,
    "the expression must distinguish pull-request pushes from main"
  )
})

test("prepared image verification rejects version drift and missing browsers", () => {
  const valid = {
    version: BROWSER_IMAGE_VERSION,
    browsersPath: "/ms-playwright",
    executables: ["chromium", "firefox", "webkit"].map(
      (browser) => `/ms-playwright/${browser}`
    ),
  }
  assert.doesNotThrow(() => verifyBrowserImage(valid, () => true))
  for (const change of [
    { version: "0.0.0" },
    { browsersPath: "/tmp" },
    { executables: [] },
  ])
    assert.throws(() => verifyBrowserImage({ ...valid, ...change }, () => true))
  assert.throws(() => verifyBrowserImage(valid, () => false))
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8")
  assert.equal(
    workflow.split("options: --init --ipc=host --user 1001").length - 1,
    2
  )
  assert.equal(
    workflow.split(
      `mcr.microsoft.com/playwright:v${BROWSER_IMAGE_VERSION}-noble@sha256:`
    ).length - 1,
    2
  )
})
