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
 * PROVENANCE, AND WHY A NAME IS NOT ONE. Anyone with `checks: write` on this
 * repository - another installed GitHub App, or `github-actions` itself from
 * any workflow - can create a check run with any name they like. A monitor
 * that matched `nightlyProof.checkName` and a timestamp would therefore accept
 * a proof this plane never published, and hold the freshness gate green while
 * the Mac has been off for a week; that is the precise failure this file
 * exists to detect. So the same identity rule the bridge applies is applied
 * here, imported from `ops/local-ci/core/app-identity.mjs` rather than
 * restated: two copies of a provenance check are two things to keep in
 * agreement, and the copy that drifted would be the one that accepted an
 * impostor. The request-target guards come from the agent's GitHub client for
 * the same reason - this monitor interpolates a repository name and a ref that
 * came out of the environment into a URL whose request carries a bearer token.
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
  requireRepositoryFullName,
  resolveApiUrl,
} from "../ops/local-ci/agent/github.mjs"
import {
  checkRunIdentityViolations,
  expectedAppSlug,
} from "../ops/local-ci/core/app-identity.mjs"
import {
  LocalCiError,
  describeValue,
  loadContract,
  toEpochMs,
} from "../ops/local-ci/core/contract.mjs"

export class NightlyProofError extends LocalCiError {}

/**
 * Every verdict `decideNightlyProof` can return. Only "fresh" is passing.
 *
 * "unidentified" is deliberately distinct from "missing": nothing was
 * published is an outage, whereas something published a run under this plane's
 * check name that this plane did not publish, which an operator needs to read
 * as such rather than as silence.
 */
export const NIGHTLY_PROOF_STATES = Object.freeze([
  "fresh",
  "missing",
  "unidentified",
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
 * Input is `{ checkRun, requestedSha, now, contract }`. `requestedSha` is the
 * commit the check run was read from and is required whenever `checkRun` is
 * not null: it is the SHA the identity rule compares `head_sha` against, and a
 * caller allowed to omit it would be running an identity check with one of its
 * three clauses silently switched off.
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
  const { checkRun = null, requestedSha = null, now, contract } = input
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
      violations: Object.freeze([]),
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

  if (typeof requestedSha !== "string" || !COMMIT_SHA.test(requestedSha)) {
    throw new NightlyProofError(
      "INVALID_INPUT",
      `decideNightlyProof requires requestedSha, the 40-character commit SHA the check run was read from, whenever a check run is supplied (received ${describeValue(requestedSha)}); without it the head-SHA half of the identity rule cannot be applied`
    )
  }

  // WHO PUBLISHED THIS. The name is the cheapest thing in a check run to
  // forge - any App with `checks: write`, `github-actions` included, can
  // create one - so the whole identity rule runs here: the contract's name,
  // the pinned App (by slug always, and by id once the App has been created
  // and `githubApp.appId` stops being a null sentinel), and the head SHA. A
  // run that fails any clause is not this plane's proof, and reporting it as
  // anything but a refusal would let a stranger's green check hold this gate
  // open while the local agent is dead.
  const violations = checkRunIdentityViolations(checkRun, contract, {
    requestedSha,
    checkName,
  })
  if (violations.length > 0) {
    return verdict(
      "unidentified",
      false,
      `the newest candidate check run on ${headSha ?? requestedSha} was not published by this plane: ${violations.join("; ")}. Only the ${JSON.stringify(expectedAppSlug(contract))} GitHub App may publish a nightly proof, so a matching check name is never enough on its own`,
      { headSha, violations }
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
    // The path carries a repository name and a ref that came out of the
    // environment, and the request carries a bearer token. `resolveApiUrl` is
    // the bridge poller's guard, imported rather than restated: it re-parses
    // the composed URL and refuses anything that leaves the configured API
    // root, so an interpolated value cannot redirect the credential.
    const response = await fetchImpl(resolveApiUrl(apiRoot, path), {
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
 * proof *from this plane* is found, and hand back the newest such run on that
 * commit along with the commit it was read from.
 *
 * Commits come back newest-first and the plane publishes proofs forward in
 * time, so the first commit carrying a completed proof carries the newest one.
 * The walk stops there, which costs two API calls on a quiet repository and a
 * handful on a busy one.
 *
 * Candidates are filtered by the same identity rule the verdict applies, and
 * for a reason the verdict alone cannot cover. The Checks API answers by name,
 * not by publisher, so one commit can carry both this plane's run and a run
 * some other App published under the same name - and `newestCheckRun` would
 * hand back whichever finished last. Filtering here means an impostor can
 * never shadow a genuine proof, whether it sits alongside one or on a newer
 * commit than one. The newest refused candidate is still carried out of the
 * walk when nothing genuine was found anywhere, so the verdict can name what
 * was rejected instead of reporting a bland "missing".
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
  // Validated here rather than at the call site because this is the function
  // that turns the name into a request path; the bridge poller's guard is
  // imported for it so the two planes cannot disagree about what a usable
  // repository name is.
  const { fullName } = requireRepositoryFullName(repository, "the repository")

  const listed = await fetchJson(
    `/repos/${fullName}/commits?sha=${encodeURIComponent(ref)}&per_page=${commitsToScan}`
  )
  const shas = (Array.isArray(listed) ? listed : [])
    .map((commit) => commit?.sha)
    .filter((sha) => typeof sha === "string" && COMMIT_SHA.test(sha))

  let refused = null
  for (const [index, sha] of shas.entries()) {
    const body = await fetchJson(
      `/repos/${fullName}/commits/${sha}/check-runs?check_name=${encodeURIComponent(checkName)}&per_page=100`
    )
    const runs = Array.isArray(body?.check_runs) ? body.check_runs : []
    const completed = runs.filter((run) => run?.status === "completed")
    if (completed.length === 0) continue

    const expected = { requestedSha: sha, checkName }
    const ours = completed.filter(
      (run) => checkRunIdentityViolations(run, contract, expected).length === 0
    )
    if (ours.length > 0) {
      return Object.freeze({
        checkRun: newestCheckRun(ours),
        headSha: sha,
        commitsWalked: index + 1,
        candidateCommits: shas.length,
      })
    }
    refused ??= { checkRun: newestCheckRun(completed), headSha: sha }
  }

  if (refused !== null) {
    return Object.freeze({
      checkRun: refused.checkRun,
      headSha: refused.headSha,
      commitsWalked: shas.length,
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

  // Checked before the first request, like the bridge poller does it: a
  // misconfigured repository name is a wiring error, and failing in seconds
  // with a message that names it beats a token-bearing request to somewhere
  // unintended.
  const { fullName: repository } = requireRepositoryFullName(
    env.GITHUB_REPOSITORY || contract.repository,
    "GITHUB_REPOSITORY"
  )
  const ref = (env.LOCAL_CI_NIGHTLY_REF || "").trim() || DEFAULT_REF
  const reader =
    fetchJson ??
    createGithubFetchJson({
      token: env.GITHUB_TOKEN,
      apiRoot: env.GITHUB_API_URL || "https://api.github.com",
    })

  const checkName = nightlyProofCheckName(contract)
  const appSlug = expectedAppSlug(contract)
  log(
    `looking for the newest completed ${JSON.stringify(checkName)} run on the last ${commitsToScan} commits of ${ref} in ${repository}`
  )
  log(
    `a run counts as proof only if the ${JSON.stringify(appSlug)} GitHub App published it for the commit it was read from`
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
    requestedSha: found.headSha,
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
      `- publisher: \`${appSlug}\` (required)`,
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
