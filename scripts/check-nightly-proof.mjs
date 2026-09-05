/**
 * The nightly freshness monitor for the local CI plane.
 *
 * The advisory `local-proof` bridge in `.github/workflows/ci.yml` only ever
 * reports on commits that someone actually pushed. That leaves a blind spot
 * the whole cutover depends on closing: a Mac that is asleep, a VM that never
 * came back after a reboot, or an agent that died three days ago all look
 * exactly like "nobody has opened a pull request lately". This script closes
 * it by asserting, on a schedule and independently of any push, that the local
 * plane published a *successful* `nightlyProof.checkName` run for the default
 * branch within `nightlyProof.maxAgeHours` (36) - one 24-hour cadence plus a
 * 12-hour recovery window, so one missed night warns and two consecutive
 * misses fail.
 *
 * Structure mirrors `scripts/check-local-ci-proof.mjs`: the verdict is a pure
 * function of a check run, an instant and the contract, and everything impure
 * - the clock, the API, the environment, the exit code - is injected with a
 * default, so the whole decision surface is unit-testable offline.
 *
 * ENFORCEMENT. At cutover step 1 this monitor is advisory and deliberately
 * toothless, because no machine is provisioned yet: an enforcing verifier
 * would fire a guaranteed false alarm every single day until the agent exists.
 * It neither pages nor opens an incident issue. The advisory decision is read
 * from `nightlyProof.enforcement` in config/local-ci-contract.json at run time
 * rather than hardcoded here, so cutover step 3 promotes it by changing that
 * one string to "blocking" - see docs/operations/local-ci-cutover.md, which is
 * also where the incident-issue path is added.
 */

import { appendFileSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

import {
  LocalCiError,
  describeValue,
  loadContract,
  toEpochMs,
} from "../ops/local-ci/core/contract.mjs"

export class NightlyProofError extends LocalCiError {}

/** Every verdict `decideNightlyProof` can return. Only "fresh" is passing. */
export const NIGHTLY_PROOF_STATES = Object.freeze([
  "fresh",
  "missing",
  "incomplete",
  "failed",
  "stale",
])

/**
 * How many commits back from the branch head to look for a nightly proof.
 *
 * The walk is not optional. The local plane proves whatever commit was the
 * head of main when its nightly run started; by the time this monitor runs,
 * main has usually moved on. Asking only about today's head would report
 * "missing" every day the repository saw a merge, which is the exact
 * false-alarm failure this monitor is supposed to avoid.
 */
export const DEFAULT_COMMITS_TO_SCAN = 20

/** The branch a nightly proof is expected on when the caller names none. */
export const DEFAULT_REF = "main"

const COMMIT_SHA = /^[0-9a-fA-F]{40}$/
const HOUR_MS = 3_600_000

function requireContract(contract, caller) {
  if (typeof contract !== "object" || contract === null) {
    throw new NightlyProofError(
      "INVALID_CONTRACT",
      `${caller} requires the validated contract (received ${describeValue(contract)})`
    )
  }
  const nightly = contract.nightlyProof
  if (typeof nightly !== "object" || nightly === null) {
    throw new NightlyProofError(
      "INVALID_CONTRACT",
      `${caller}: contract.nightlyProof is missing; validate the contract first`
    )
  }
  return nightly
}

/** The staleness ceiling in hours, taken from the contract and validated. */
export function nightlyProofMaxAgeHours(contract) {
  const nightly = requireContract(contract, "nightlyProofMaxAgeHours")
  const hours = nightly.maxAgeHours
  if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) {
    throw new NightlyProofError(
      "INVALID_CONTRACT",
      `contract.nightlyProof.maxAgeHours must be a positive finite number (received ${describeValue(hours)})`
    )
  }
  return hours
}

/**
 * The check-run name a nightly proof must carry. `nightlyProof.checkName` is
 * the specific field; `nightlyCheckName` at the top level is the same string
 * and is accepted as a fallback so one of the two going missing degrades to a
 * clear refusal rather than a silent match against `undefined`.
 */
export function nightlyProofCheckName(contract) {
  const nightly = requireContract(contract, "nightlyProofCheckName")
  const name =
    typeof nightly.checkName === "string" && nightly.checkName.trim() !== ""
      ? nightly.checkName
      : contract.nightlyCheckName
  if (typeof name !== "string" || name.trim() === "") {
    throw new NightlyProofError(
      "INVALID_CONTRACT",
      `contract.nightlyProof.checkName must be a non-empty string (received ${describeValue(nightly.checkName)})`
    )
  }
  return name
}

/**
 * The newest of a set of check runs, by completion time.
 *
 * `completed_at` is the honest ordering key for a finished run; `started_at`
 * is the fallback for a run that has not finished, which
 * `decideNightlyProof` then rejects as incomplete rather than silently
 * treating as proof.
 */
export function newestCheckRun(runs) {
  if (!Array.isArray(runs) || runs.length === 0) return null
  const instant = (run) =>
    Date.parse(run?.completed_at || run?.started_at || "") || 0
  return runs.reduce((newest, candidate) =>
    instant(candidate) >= instant(newest) ? candidate : newest
  )
}

/**
 * The verdict, as a pure function of the check run, the instant and the
 * contract. No clock, no network, no environment.
 *
 * The freshness boundary is strict: a proof is fresh only while its age is
 * *less than* `maxAgeHours`, so a proof that is exactly 36 hours old is
 * already stale. A `completed_at` in the future - GitHub's clock and the
 * runner's can disagree by seconds - is clamped to an age of zero rather than
 * producing a nonsensical negative age.
 */
export function decideNightlyProof(input) {
  if (typeof input !== "object" || input === null) {
    throw new NightlyProofError(
      "INVALID_INPUT",
      `decideNightlyProof requires an options object (received ${describeValue(input)})`
    )
  }
  const { checkRun = null, now, contract } = input
  const maxAgeHours = nightlyProofMaxAgeHours(contract)
  const checkName = nightlyProofCheckName(contract)
  const nowMs = toEpochMs(now, "now")

  const verdict = (state, ok, reason, extra = {}) =>
    Object.freeze({
      state,
      ok,
      reason,
      checkName,
      maxAgeHours,
      ageHours: null,
      completedAt: null,
      conclusion: null,
      headSha: null,
      ...extra,
    })

  if (checkRun === null || checkRun === undefined) {
    return verdict(
      "missing",
      false,
      `no ${JSON.stringify(checkName)} check run was found; the local plane has published no nightly proof, which is what a sleeping Mac, a stopped VM or a dead agent all look like`
    )
  }
  if (typeof checkRun !== "object") {
    throw new NightlyProofError(
      "INVALID_INPUT",
      `checkRun must be an object or null (received ${describeValue(checkRun)})`
    )
  }

  const headSha =
    typeof checkRun.head_sha === "string" && COMMIT_SHA.test(checkRun.head_sha)
      ? checkRun.head_sha.toLowerCase()
      : null

  // A check with the wrong name is not this plane's proof at all. Reporting it
  // as "missing" is the honest verdict: nothing here proves the local agent
  // ran, so the monitor must not be satisfied by it.
  if (checkRun.name !== checkName) {
    return verdict(
      "missing",
      false,
      `the newest candidate check run is named ${describeValue(checkRun.name)}, not ${JSON.stringify(checkName)}, so it is not a nightly proof from this plane`,
      { headSha }
    )
  }

  if (checkRun.status !== "completed") {
    return verdict(
      "incomplete",
      false,
      `the newest ${JSON.stringify(checkName)} run on ${headSha ?? "an unknown commit"} is still ${describeValue(checkRun.status)}; an unfinished run is not proof that the nightly suite passed`,
      { headSha }
    )
  }

  const conclusion = checkRun.conclusion ?? null
  if (conclusion !== "success") {
    return verdict(
      "failed",
      false,
      `the newest ${JSON.stringify(checkName)} run on ${headSha ?? "an unknown commit"} concluded ${describeValue(conclusion)}, not "success"`,
      { conclusion, headSha, completedAt: checkRun.completed_at ?? null }
    )
  }

  const completedAtMs = Date.parse(checkRun.completed_at || "")
  if (!Number.isFinite(completedAtMs)) {
    return verdict(
      "incomplete",
      false,
      `the newest ${JSON.stringify(checkName)} run on ${headSha ?? "an unknown commit"} reports success but carries no parseable completed_at (${describeValue(checkRun.completed_at)}), so its age cannot be established`,
      { conclusion, headSha }
    )
  }

  const ageHours = Math.max(0, (nowMs - completedAtMs) / HOUR_MS)
  const shared = {
    conclusion,
    headSha,
    completedAt: new Date(completedAtMs).toISOString(),
    ageHours,
  }

  if (ageHours >= maxAgeHours) {
    return verdict(
      "stale",
      false,
      `the newest successful ${JSON.stringify(checkName)} run finished ${ageHours.toFixed(1)} hours ago, past the ${maxAgeHours}-hour ceiling; the local plane has missed at least one nightly cadence`,
      shared
    )
  }

  return verdict(
    "fresh",
    true,
    `a successful ${JSON.stringify(checkName)} run for ${headSha ?? "the default branch"} finished ${ageHours.toFixed(1)} hours ago, inside the ${maxAgeHours}-hour ceiling`,
    shared
  )
}

/**
 * The process exit code for a verdict.
 *
 * The advisory decision is contract data, not a constant in this file: while
 * `nightlyProof.enforcement` is anything other than "blocking" a failing
 * verdict is reported and returns 0. Cutover step 3 changes that one string
 * and this monitor starts failing, with no edit here or to the workflow.
 */
export function nightlyProofExitCode(decision, contract) {
  const nightly = requireContract(contract, "nightlyProofExitCode")
  if (typeof decision !== "object" || decision === null) {
    throw new NightlyProofError(
      "INVALID_INPUT",
      `nightlyProofExitCode requires a decision object (received ${describeValue(decision)})`
    )
  }
  if (nightly.enforcement !== "blocking") return 0
  return decision.ok === true ? 0 : 1
}

/**
 * A `(path) => Promise<json>` GitHub reader. Injected in tests; built from the
 * environment by the CLI. Only ever issues GETs - this monitor observes the
 * proof plane and never writes to it.
 */
export function createGithubFetchJson(options = {}) {
  const {
    token,
    apiRoot = "https://api.github.com",
    fetchImpl = fetch,
  } = options
  if (typeof token !== "string" || token.trim() === "") {
    throw new NightlyProofError(
      "MISSING_TOKEN",
      "a GitHub token is required to read check runs; the workflow passes GITHUB_TOKEN and the job holds checks: read"
    )
  }
  return async function fetchJson(path) {
    const response = await fetchImpl(`${apiRoot}${path}`, {
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "x-github-api-version": "2022-11-28",
      },
    })
    if (!response.ok) {
      throw new NightlyProofError(
        "GITHUB_REQUEST_FAILED",
        `GET ${path} returned ${response.status} ${response.statusText}`
      )
    }
    return response.json()
  }
}

/**
 * Walk back from the branch head until a commit carrying a completed nightly
 * proof is found, and hand back the newest run on that commit.
 *
 * Commits come back newest-first and the plane publishes proofs forward in
 * time, so the first commit carrying a completed proof carries the newest one.
 * The walk stops there, which costs two API calls on a quiet repository and a
 * handful on a busy one.
 */
export async function findNewestNightlyProof(options = {}) {
  const {
    contract,
    repository,
    ref = DEFAULT_REF,
    fetchJson,
    commitsToScan = DEFAULT_COMMITS_TO_SCAN,
  } = options
  const checkName = nightlyProofCheckName(contract)
  if (typeof fetchJson !== "function") {
    throw new NightlyProofError(
      "INVALID_READER",
      `findNewestNightlyProof requires a (path) => Promise<json> reader (received ${describeValue(fetchJson)})`
    )
  }
  if (typeof repository !== "string" || repository.trim() === "") {
    throw new NightlyProofError(
      "INVALID_INPUT",
      `repository must be an "owner/repo" string (received ${describeValue(repository)})`
    )
  }

  const listed = await fetchJson(
    `/repos/${repository}/commits?sha=${encodeURIComponent(ref)}&per_page=${commitsToScan}`
  )
  const shas = (Array.isArray(listed) ? listed : [])
    .map((commit) => commit?.sha)
    .filter((sha) => typeof sha === "string" && COMMIT_SHA.test(sha))

  for (const [index, sha] of shas.entries()) {
    const body = await fetchJson(
      `/repos/${repository}/commits/${sha}/check-runs?check_name=${encodeURIComponent(checkName)}&per_page=100`
    )
    const runs = Array.isArray(body?.check_runs) ? body.check_runs : []
    const completed = runs.filter((run) => run?.status === "completed")
    if (completed.length === 0) continue
    return Object.freeze({
      checkRun: newestCheckRun(completed),
      headSha: sha,
      commitsWalked: index + 1,
      candidateCommits: shas.length,
    })
  }

  return Object.freeze({
    checkRun: null,
    headSha: shas[0] ?? null,
    commitsWalked: shas.length,
    candidateCommits: shas.length,
  })
}

function appendStepSummary(lines, env) {
  const path = env.GITHUB_STEP_SUMMARY
  if (!path) return
  try {
    appendFileSync(path, `${lines.join("\n")}\n`)
  } catch {
    // A summary is a convenience, never a reason to change the verdict.
  }
}

/**
 * The CLI body. Everything impure is a parameter with a default, so a test can
 * drive the whole path - contract, clock, API and environment - with no
 * filesystem and no network. Returns the process exit code.
 */
export async function runNightlyProofCheck(options = {}) {
  const {
    env = process.env,
    now = Date.now(),
    contract = loadContract((path) => readFileSync(path, "utf8")),
    fetchJson,
    commitsToScan = DEFAULT_COMMITS_TO_SCAN,
    log = (message) => process.stdout.write(`nightly-proof: ${message}\n`),
  } = options

  // Symmetry with the bridge poller: until an operator sets LOCAL_CI_MODE
  // there is no local plane anywhere, and a monitor that failed on that would
  // be a guaranteed daily false alarm rather than a signal.
  if ((env.LOCAL_CI_MODE || "").trim() === "") {
    log(
      "the repository variable LOCAL_CI_MODE is unset, so the local plane is dormant and there is no nightly proof to expect yet"
    )
    return 0
  }

  const repository = env.GITHUB_REPOSITORY || contract.repository
  const ref = (env.LOCAL_CI_NIGHTLY_REF || "").trim() || DEFAULT_REF
  const reader =
    fetchJson ??
    createGithubFetchJson({
      token: env.GITHUB_TOKEN,
      apiRoot: env.GITHUB_API_URL || "https://api.github.com",
    })

  const checkName = nightlyProofCheckName(contract)
  log(
    `looking for the newest completed ${JSON.stringify(checkName)} run on the last ${commitsToScan} commits of ${ref} in ${repository}`
  )

  const found = await findNewestNightlyProof({
    contract,
    repository,
    ref,
    fetchJson: reader,
    commitsToScan,
  })
  const decision = decideNightlyProof({
    checkRun: found.checkRun,
    now,
    contract,
  })
  const enforcement = contract.nightlyProof.enforcement ?? "advisory"
  const exitCode = nightlyProofExitCode(decision, contract)

  log(
    `walked ${found.commitsWalked} of ${found.candidateCommits} candidate commits from ${ref}`
  )
  log(`${decision.state}: ${decision.reason}`)

  appendStepSummary(
    [
      "### Local CI nightly proof",
      "",
      `- verdict: \`${decision.state}\``,
      `- branch: \`${ref}\``,
      `- commit: \`${decision.headSha ?? found.headSha ?? "none"}\``,
      `- age: ${decision.ageHours === null ? "unknown" : `${decision.ageHours.toFixed(1)} hours`} of a ${decision.maxAgeHours}-hour ceiling`,
      `- enforcement: \`${enforcement}\``,
      "",
      decision.reason,
      "",
    ],
    env
  )

  if (!decision.ok && exitCode === 0) {
    log(
      `nightlyProof.enforcement is ${JSON.stringify(enforcement)}, so this verdict is recorded and nothing else: it does not page, it does not open an issue, and it does not fail the run. Cutover step 3 sets it to "blocking".`
    )
  }
  return exitCode
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  runNightlyProofCheck().then(
    (code) => {
      process.exitCode = code
    },
    (error) => {
      process.stderr.write(`nightly-proof: ${error.message}\n`)
      process.exitCode = 1
    }
  )
}
