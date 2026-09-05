/**
 * The hosted half of the local CI bridge — the poller the `local-proof` job in
 * `.github/workflows/ci.yml` runs.
 *
 * It joins a plane GitHub can see to a plane it cannot: the local agent
 * publishes a check run named `contract.checkName` for a head commit, and this
 * script waits for it, verifies it came from the expected GitHub App and names
 * the expected SHA, and reports the verdict.
 *
 * Every decision is delegated to `ops/local-ci/core/bridge.mjs`, which is a
 * pure function of the check run, the requested SHA and two timestamps. This
 * file owns only the impure parts: reading the environment, calling the API,
 * sleeping between polls, and choosing an exit code.
 *
 * At cutover step 1 the job is advisory in three independent ways, and this
 * script is the third: no job lists `local-proof` in `needs:`, the job carries
 * `continue-on-error: true`, and while `shadowMode.enabled` is true a
 * rejection is reported and then exits 0. Cutover step 3 is what flips
 * `bridge.enforcement` to `"blocking"` and `shadowMode.enabled` to false, in
 * one commit; nothing here needs to change for that to take effect.
 */

import { appendFileSync, readFileSync } from "node:fs"
import { setTimeout as sleep } from "node:timers/promises"

import {
  decideBridgeAction,
  describeBridgeState,
} from "../ops/local-ci/core/bridge.mjs"
import { loadContract } from "../ops/local-ci/core/contract.mjs"

const COMMIT_SHA = /^[0-9a-fA-F]{40}$/
const API_ROOT = process.env.GITHUB_API_URL || "https://api.github.com"

function log(message) {
  process.stdout.write(`local-proof: ${message}\n`)
}

/**
 * The head SHA this run must prove, plus the wiring check from the contract's
 * `bridge.headShaRule`. A mismatch here is a workflow wiring error and fails in
 * seconds with a self-describing message, rather than burning the whole
 * `bridge.timeoutMinutes` ceiling waiting for a commit nobody will publish.
 */
function resolveRequestedSha(env) {
  const requested = (env.LOCAL_CI_HEAD_SHA || "").trim()
  const workflowSha = (env.GITHUB_SHA || "").trim()
  const eventName = env.GITHUB_EVENT_NAME || ""

  if (!COMMIT_SHA.test(requested)) {
    throw new Error(
      `LOCAL_CI_HEAD_SHA must be a 40-character commit SHA (received ${JSON.stringify(requested)}); the job is expected to pass github.event.pull_request.head.sha on pull_request and github.sha on push`
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
  return requested.toLowerCase()
}

/** The newest check run with the contract's name for this commit, or null. */
async function fetchCheckRun(repository, sha, checkName, token) {
  const url = `${API_ROOT}/repos/${repository}/commits/${sha}/check-runs?check_name=${encodeURIComponent(checkName)}&per_page=100`
  const response = await fetch(url, {
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
    },
  })
  if (!response.ok) {
    throw new Error(
      `GET /repos/${repository}/commits/${sha}/check-runs returned ${response.status} ${response.statusText}`
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

function summarise(state, contract) {
  const path = process.env.GITHUB_STEP_SUMMARY
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

async function main() {
  const contract = loadContract((path) => readFileSync(path, "utf8"))
  const mode = (process.env.LOCAL_CI_MODE || "").trim()
  if (mode === "") {
    log(
      "the repository variable LOCAL_CI_MODE is unset, so the local plane is dormant and there is nothing to wait for"
    )
    return 0
  }

  const repository = process.env.GITHUB_REPOSITORY || contract.repository
  const token = process.env.GITHUB_TOKEN || ""
  if (token === "") {
    throw new Error("GITHUB_TOKEN is required to read check runs")
  }

  const requestedSha = resolveRequestedSha(process.env)
  const startedAt = Date.now()
  const pollMs = contract.bridge.pollIntervalSeconds * 1000
  log(
    `waiting for the ${JSON.stringify(contract.checkName)} check run on ${requestedSha} (ceiling ${contract.bridge.timeoutMinutes} minutes, polling every ${contract.bridge.pollIntervalSeconds}s)`
  )

  // The bridge job holds `checks: read` and nothing more. Reruns are the host
  // agent's single Actions-write call, so this poller never issues one and its
  // attempt count is always zero.
  const rerunAttempts = 0
  for (;;) {
    const checkRun = await fetchCheckRun(
      repository,
      requestedSha,
      contract.checkName,
      token
    )
    const state = describeBridgeState({
      checkRun,
      requestedSha,
      startedAt,
      now: Date.now(),
      contract,
      rerunAttempts,
    })
    const { action } = decideBridgeAction({
      checkRun,
      requestedSha,
      startedAt,
      now: Date.now(),
      contract,
      rerunAttempts,
    })

    if (action === "wait") {
      log(state.reason)
      await sleep(pollMs)
      continue
    }

    summarise(state, contract)

    if (action === "accept") {
      log(`accepted: ${state.reason}`)
      return 0
    }
    if (action === "rerun") {
      log(
        `the local plane published a proof after this job had already given up: ${state.reason}. The host agent owns the single rerun-failed-jobs call; this job does not hold Actions write.`
      )
      return contract.shadowMode?.enabled === true ? 0 : 1
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

main().then(
  (code) => {
    process.exitCode = code
  },
  (error) => {
    process.stderr.write(`local-proof: ${error.message}\n`)
    process.exitCode = 1
  }
)
