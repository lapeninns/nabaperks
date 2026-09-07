/**
 * The hosted half of the local CI bridge — the poller the `local-proof` job in
 * `.github/workflows/local-ci-shadow.yml` runs.
 *
 * It joins a plane GitHub can see to a plane it cannot: the local agent
 * publishes a check run named `contract.checkName` for a head commit, and this
 * script waits for it, verifies it came from the expected GitHub App and names
 * the expected SHA, and reports the verdict.
 *
 * Every decision is delegated to `ops/local-ci/core/bridge.mjs`, which is a
 * pure function of the check run, the requested SHA and two timestamps. This
 * file owns only the impure parts: reading the environment, calling the API,
 * sleeping between polls, and choosing an exit code. Each of those is a
 * parameter with a default, so a test can drive the whole path — contract,
 * clock, API, environment and sleep — with no network and no waiting.
 *
 * The one exception is the request-target guards, which are imported from the
 * agent's GitHub client rather than restated here. Both planes interpolate a
 * repository name and a SHA that came off disk or out of the environment into
 * a URL whose request carries a bearer token; two copies of that check would
 * be two things to keep in agreement, and the copy that drifted would be the
 * one that leaked the token.
 *
 * Hosted observation is now independent of CI and makes one read. It refuses
 * an enforcing contract and never supplies merge or deployment authority.
 * The polling entrypoint remains available for offline compatibility tests
 * and operator diagnostics; a future cutover requires a trusted verifier.
 */

import { appendFileSync, readFileSync } from "node:fs"
import { setTimeout as sleepFor } from "node:timers/promises"
import { pathToFileURL } from "node:url"

import {
  requireCommitSha,
  requireRepositoryFullName,
  resolveApiUrl,
} from "../ops/local-ci/agent/github.mjs"
import {
  decideBridgeAction,
  describeBridgeState,
} from "../ops/local-ci/core/bridge.mjs"
import {
  loadContract,
  quoteForMessage,
} from "../ops/local-ci/core/contract.mjs"

const COMMIT_SHA = /^[0-9a-fA-F]{40}$/
const DEFAULT_API_ROOT = "https://api.github.com"

/**
 * The head SHA this run must prove, plus the wiring check from the contract's
 * `bridge.headShaRule`. A mismatch here is a workflow wiring error and fails in
 * seconds with a self-describing message, rather than burning the whole
 * `bridge.timeoutMinutes` ceiling waiting for a commit nobody will publish.
 */
export function resolveRequestedSha(env) {
  const requested = (env.LOCAL_CI_HEAD_SHA || "").trim()
  const workflowSha = (env.GITHUB_SHA || "").trim()
  const eventName = env.GITHUB_EVENT_NAME || ""

  if (!COMMIT_SHA.test(requested)) {
    throw new Error(
      `LOCAL_CI_HEAD_SHA must be a 40-character commit SHA (received ${quoteForMessage(requested)}); the job is expected to pass github.event.pull_request.head.sha on pull_request and github.sha on push`
    )
  }
  if (eventName === "pull_request" && requested === workflowSha) {
    throw new Error(
      `on pull_request the bridge must poll the pull request head SHA, which differs from GITHUB_SHA (the merge commit); both are ${requested}, so the job is wired to the wrong expression`
    )
  }
  if (eventName === "push" && workflowSha !== "" && requested !== workflowSha) {
    throw new Error(
      `on push the bridge must poll GITHUB_SHA; LOCAL_CI_HEAD_SHA is ${requested} but GITHUB_SHA is ${workflowSha}`
    )
  }
  // Lowercased here so `requireCommitSha` below - which insists on the exact
  // form GitHub writes - is the single definition of a usable SHA.
  return requested.toLowerCase()
}

/**
 * The newest check run with the contract's name for this commit, or null.
 *
 * `repository` is whatever the job was handed in `GITHUB_REPOSITORY` and `sha`
 * came from the environment too, so both are re-checked here rather than at
 * the call site: this is the function that touches the network, and the
 * request carries a bearer token. A repository name with a `..` segment, or an
 * API root that is not the one this job was configured with, would otherwise
 * hand that token to a different path or a different host. `resolveApiUrl`
 * re-parses the finished URL and refuses anything outside the API root.
 */
export async function fetchCheckRun(options) {
  const { repository, sha, checkName, token, apiRoot, fetchImpl } = options
  const { fullName } = requireRepositoryFullName(repository, "the repository")
  const commit = requireCommitSha(sha, "the head SHA")
  const url = resolveApiUrl(
    apiRoot,
    `/repos/${fullName}/commits/${commit}/check-runs?check_name=${encodeURIComponent(checkName)}&per_page=100`
  )
  const response = await fetchImpl(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  })
  if (!response.ok) {
    throw new Error(
      `GET /repos/${fullName}/commits/${commit}/check-runs returned ${response.status} ${response.statusText}`
    )
  }
  const body = await response.json()
  const runs = Array.isArray(body?.check_runs) ? body.check_runs : []
  if (runs.length === 0) return null
  return runs.reduce((newest, candidate) => {
    const a = Date.parse(newest.started_at || "") || 0
    const b = Date.parse(candidate.started_at || "") || 0
    return b >= a ? candidate : newest
  })
}

function summarise(state, contract, env) {
  const path = env.GITHUB_STEP_SUMMARY
  if (!path) return
  const advisory = contract.shadowMode?.enabled === true
  const lines = [
    "### Local CI proof",
    "",
    `- verdict: \`${state.action}\``,
    `- commit: \`${state.requestedSha}\``,
    `- elapsed: ${state.elapsedMinutes} of ${state.timeoutMinutes} minutes`,
    `- enforcement: \`${contract.bridge.enforcement}\`${advisory ? " (shadow mode — this job cannot affect a merge)" : ""}`,
    "",
    state.reason,
    "",
  ]
  try {
    appendFileSync(path, `${lines.join("\n")}\n`)
  } catch {
    // A missing summary file is never a reason to fail the proof.
  }
}

/**
 * WHY THIS POLLER NEVER REPORTS A PREVIOUS ATTEMPT, AND SO CAN NEVER RERUN.
 *
 * `decideBridgeAction` returns `"rerun"` only to a caller that recorded an
 * earlier timed-out attempt for this SHA *and* can act on the answer. This job
 * is neither, and both halves are structural rather than incidental:
 *
 *   - it holds `contents: read` and `checks: read` and no Actions scope of any
 *     kind, which `tests/contracts/devops-local-ci.test.mjs` asserts against
 *     `.github/workflows/local-ci-shadow.yml` by refusing any `: write` in the job; and
 *   - a job cannot re-run the workflow run it is part of. By the time a late
 *     proof lands, the attempt that timed out has already finished, and there
 *     is no hosted job left running to notice.
 *
 * The Mac-came-back-from-sleep repair therefore belongs to the host agent,
 * which mints an installation token carrying the App's Actions write and
 * issues the single permitted `rerun-failed-jobs` call against the finished
 * run — the arrangement `contract.githubApp.allowedActionsWriteOperations` and
 * docs/operations/local-ci.md section 5.3 already describe. Passing a null
 * outcome and a zero attempt count here is not a placeholder for wiring still
 * to come: it is the statement that this caller is never the rerunner.
 */
const POLLER_PREVIOUS_OUTCOME = null
const POLLER_RERUN_ATTEMPTS = 0

/**
 * The CLI body. Everything impure is a parameter with a default, so a test can
 * drive the whole path offline. Returns the process exit code.
 */
export async function runLocalProofCheck(options = {}) {
  const {
    env = process.env,
    contract = loadContract((path) => readFileSync(path, "utf8")),
    fetchImpl = fetch,
    now = () => Date.now(),
    sleep = (ms) => sleepFor(ms),
    log = (message) => process.stdout.write(`local-proof: ${message}\n`),
  } = options

  const observeOnce = env.LOCAL_CI_OBSERVE_ONCE === "true"
  if (
    observeOnce &&
    (contract.shadowMode?.enabled !== true ||
      contract.bridge.enforcement !== "advisory" ||
      contract.bridge.requiredCheck !== false ||
      contract.bridge.dependents?.length !== 0)
  ) {
    throw new Error(
      "observe-once requires a non-required advisory shadow contract"
    )
  }

  const mode = (env.LOCAL_CI_MODE || "").trim()
  if (mode === "") {
    log(
      "the repository variable LOCAL_CI_MODE is unset, so the local plane is dormant and there is nothing to wait for"
    )
    return 0
  }

  // Checked before the first poll rather than inside it: a misconfigured
  // repository name is a wiring error, and failing in seconds with a message
  // that names it beats a token-bearing request to somewhere unintended.
  const { fullName: repository } = requireRepositoryFullName(
    env.GITHUB_REPOSITORY || contract.repository,
    "GITHUB_REPOSITORY"
  )
  const token = env.GITHUB_TOKEN || ""
  if (token === "") {
    throw new Error("GITHUB_TOKEN is required to read check runs")
  }
  const apiRoot = env.GITHUB_API_URL || DEFAULT_API_ROOT

  const requestedSha = resolveRequestedSha(env)
  const startedAt = now()
  const pollMs = contract.bridge.pollIntervalSeconds * 1000
  log(
    observeOnce
      ? `observing ${JSON.stringify(contract.checkName)} on ${requestedSha} once; this is not a merge verdict`
      : `waiting for the ${JSON.stringify(contract.checkName)} check run on ${requestedSha} (ceiling ${contract.bridge.timeoutMinutes} minutes, polling every ${contract.bridge.pollIntervalSeconds}s)`
  )

  for (;;) {
    const checkRun = await fetchCheckRun({
      repository,
      sha: requestedSha,
      checkName: contract.checkName,
      token,
      apiRoot,
      fetchImpl,
    })
    const observation = {
      checkRun,
      requestedSha,
      startedAt,
      now: now(),
      contract,
      previousOutcome: POLLER_PREVIOUS_OUTCOME,
      rerunAttempts: POLLER_RERUN_ATTEMPTS,
    }
    const state = describeBridgeState(observation)
    const { action } = decideBridgeAction(observation)

    if (observeOnce) {
      summarise(state, contract, env)
      log(`observation (${action}): ${state.reason}`)
      log(
        "observation complete; consult the App check for eventual local validation"
      )
      return 0
    }

    if (action === "wait") {
      log(state.reason)
      await sleep(pollMs)
      continue
    }

    summarise(state, contract, env)

    if (action === "accept") {
      log(`accepted: ${state.reason}`)
      return 0
    }
    if (action === "rerun") {
      // Unreachable while this poller reports no previous attempt, and handled
      // rather than deleted so that an edit which starts feeding it one fails
      // loudly here instead of logging a repair the job has no permission to
      // perform. Deliberately outside the shadow-mode softening below: a
      // caller asking for an Actions write it does not hold is a wiring bug,
      // not a verdict about the local plane.
      throw new Error(
        `the bridge asked for a rerun of ${requestedSha}, which this job cannot issue: local-proof holds no Actions write, and a running job cannot re-run the workflow run it is part of. The single rerun-failed-jobs call belongs to the host agent — see docs/operations/local-ci.md section 5.3`
      )
    }

    log(`rejected: ${state.reason}`)
    if (contract.shadowMode?.enabled === true) {
      log(
        "shadowMode.enabled is true, so this verdict is recorded and nothing else; no merge decision depends on it until cutover step 3"
      )
      return 0
    }
    return 1
  }
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
  runLocalProofCheck().then(
    (code) => {
      process.exitCode = code
    },
    (error) => {
      process.stderr.write(`local-proof: ${error.message}\n`)
      process.exitCode = 1
    }
  )
}
