import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  loadContract,
  validateContract,
} from "../../ops/local-ci/core/contract.mjs"
import {
  BridgeError,
  MAX_RERUNS_PER_SHA,
  bridgeTimeoutMs,
  decideBridgeAction,
  describeBridgeState,
} from "../../ops/local-ci/core/bridge.mjs"
import {
  resolveRequestedSha,
  runLocalProofCheck,
} from "../../scripts/check-local-ci-proof.mjs"

/**
 * local CI — what the hosted bridge job does next.
 *
 * `local-proof` runs on GitHub-hosted infrastructure and polls for a check run
 * published by a plane GitHub cannot see, so every interesting failure lives
 * at that join: the Mac is asleep, the head SHA moved, or something published
 * a check with the right name and the wrong provenance. The decision is a pure
 * function of the check run, the requested SHA and two timestamps.
 */

const CONTRACT_TEXT = readFileSync(
  fileURLToPath(
    new URL("../../config/local-ci-contract.json", import.meta.url)
  ),
  "utf8"
)

const contract = loadContract(() => CONTRACT_TEXT)

const REQUESTED_SHA = "d".repeat(40)
const OTHER_SHA = "e".repeat(40)
const STARTED_AT = Date.parse("2026-09-04T09:00:00.000Z")
const TIMEOUT_MS = contract.bridge.timeoutMinutes * 60_000

const checkRun = (overrides = {}) => ({
  id: 77,
  name: contract.checkName,
  head_sha: REQUESTED_SHA,
  status: "completed",
  conclusion: "success",
  app: { id: contract.githubApp.appId, slug: "nabaperks-local-ci" },
  ...overrides,
})

const decide = (overrides = {}) =>
  decideBridgeAction({
    checkRun: null,
    requestedSha: REQUESTED_SHA,
    startedAt: STARTED_AT,
    now: STARTED_AT,
    contract,
    ...overrides,
  })

test("bridge timeout: waiting before the ceiling, rejecting after it", () => {
  assert.equal(contract.bridge.timeoutMinutes, 120)
  assert.equal(bridgeTimeoutMs(contract), TIMEOUT_MS)

  for (const elapsedMs of [0, 60_000, TIMEOUT_MS - 60_000, TIMEOUT_MS - 1]) {
    const decision = decide({ now: STARTED_AT + elapsedMs })
    assert.equal(decision.action, "wait", `at ${elapsedMs}ms`)
    assert.match(decision.reason, /never reported|check run for/)
  }

  for (const elapsedMs of [TIMEOUT_MS, TIMEOUT_MS + 60_000]) {
    const decision = decide({ now: STARTED_AT + elapsedMs })
    assert.equal(decision.action, "reject", `at ${elapsedMs}ms`)
    assert.match(decision.reason, /the local plane never reported/)
  }
})

test("bridge timeout: an in-progress run is waited on, then rejected at the ceiling", () => {
  const running = checkRun({ status: "in_progress", conclusion: null })
  assert.equal(
    decide({ checkRun: running, now: STARTED_AT + 60_000 }).action,
    "wait"
  )
  const timedOut = decide({ checkRun: running, now: STARTED_AT + TIMEOUT_MS })
  assert.equal(timedOut.action, "reject")
  assert.match(timedOut.reason, /still .*in_progress.* after the 120-minute/)
})

test("the bridge accepts only a completed, successful check that is provably ours", () => {
  const accepted = decide({
    checkRun: checkRun(),
    now: STARTED_AT + 30 * 60_000,
  })
  assert.deepEqual(Object.keys(accepted).sort(), ["action", "reason"])
  assert.equal(accepted.action, "accept")

  for (const conclusion of ["failure", "cancelled", "timed_out", "neutral"]) {
    const decision = decide({ checkRun: checkRun({ conclusion }) })
    assert.equal(decision.action, "reject", conclusion)
    assert.match(decision.reason, /only "success" is accepted/)
  }
})

test("an impostor check is rejected immediately, long before the timeout", () => {
  // Waiting cannot turn a check published by the wrong App into ours.
  for (const overrides of [
    { app: { id: 15368, slug: "github-actions" } },
    { app: null },
    { name: "Local CI proof" },
  ]) {
    const decision = decide({
      checkRun: checkRun(overrides),
      now: STARTED_AT + 60_000,
    })
    assert.equal(decision.action, "reject")
    assert.match(decision.reason, /check run identity refused/)
  }
})

test("a check for a different commit is waited on, because ours may still arrive", () => {
  const older = checkRun({ head_sha: OTHER_SHA })
  const waiting = decide({ checkRun: older, now: STARTED_AT + 60_000 })
  assert.equal(waiting.action, "wait")
  assert.match(waiting.reason, /different commit/)

  const expired = decide({ checkRun: older, now: STARTED_AT + TIMEOUT_MS })
  assert.equal(expired.action, "reject")
  assert.match(expired.reason, /check run identity refused/)
})

test("automatic rerun: a timed-out bridge plus a later successful check for this SHA reruns once", () => {
  const rerun = decide({
    checkRun: checkRun(),
    now: STARTED_AT + 5 * 60_000,
    previousOutcome: "timed_out",
    rerunAttempts: 0,
  })
  assert.equal(rerun.action, "rerun")
  assert.match(rerun.reason, /re-running the timed-out job once/)

  // Only once per SHA: the bridge cannot tell "the rerun has not started yet"
  // from "the rerun is eligible again", so the count is the guard.
  const second = decide({
    checkRun: checkRun(),
    now: STARTED_AT + 5 * 60_000,
    previousOutcome: "timed_out",
    rerunAttempts: MAX_RERUNS_PER_SHA,
  })
  assert.equal(second.action, "reject")
  assert.match(second.reason, /rerun\(s\) have already been attempted/)
  assert.match(second.reason, /re-run the workflow by hand/)
})

test("automatic rerun: the SHA has to match, and the check has to be green", () => {
  // A green check for a different commit is not evidence about this one.
  const otherCommit = decide({
    checkRun: checkRun({ head_sha: OTHER_SHA }),
    now: STARTED_AT + 5 * 60_000,
    previousOutcome: "timed_out",
  })
  assert.notEqual(otherCommit.action, "rerun")

  const red = decide({
    checkRun: checkRun({ conclusion: "failure" }),
    now: STARTED_AT + 5 * 60_000,
    previousOutcome: "timed_out",
  })
  assert.equal(red.action, "reject")

  // And a first look at a green check is an acceptance, not a rerun.
  assert.equal(decide({ checkRun: checkRun() }).action, "accept")
  assert.equal(
    decide({ checkRun: checkRun(), previousOutcome: "rejected" }).action,
    "accept"
  )
})

test("automatic rerun: refused when the contract does not authorise the Actions write", () => {
  const raw = JSON.parse(CONTRACT_TEXT)
  const noRerun = validateContract({
    ...raw,
    githubApp: { ...raw.githubApp, allowedActionsWriteOperations: [] },
  })
  const decision = decideBridgeAction({
    checkRun: checkRun(),
    requestedSha: REQUESTED_SHA,
    startedAt: STARTED_AT,
    now: STARTED_AT + 5 * 60_000,
    contract: noRerun,
    previousOutcome: "timed_out",
  })
  assert.equal(decision.action, "reject")
  assert.match(decision.reason, /not permitted to call "rerun-failed-jobs"/)
})

test("describeBridgeState shows the arithmetic behind the decision", () => {
  const state = describeBridgeState({
    checkRun: null,
    requestedSha: REQUESTED_SHA.toUpperCase(),
    startedAt: STARTED_AT,
    now: STARTED_AT + 90 * 60_000,
    contract,
  })
  assert.equal(state.action, "wait")
  assert.equal(state.elapsedMinutes, 90)
  assert.equal(state.timeoutMinutes, 120)
  assert.equal(state.timedOut, false)
  assert.equal(state.requestedSha, REQUESTED_SHA)
})

test("the bridge refuses inputs that would make its answer meaningless", () => {
  assert.throws(
    () => decide({ requestedSha: "not-a-sha" }),
    (error) => error instanceof BridgeError && error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => decide({ now: STARTED_AT - 1000 }),
    (error) => {
      assert.match(error.message, /clock cannot run backwards/)
      return true
    }
  )
  assert.throws(
    () => decide({ previousOutcome: "gave_up" }),
    (error) => error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => decide({ rerunAttempts: -1 }),
    (error) => error.code === "INVALID_INPUT"
  )
  assert.throws(
    () => bridgeTimeoutMs({ bridge: { timeoutMinutes: 0 } }),
    (error) => error.code === "INVALID_CONTRACT"
  )
})

test("timestamps may arrive as Dates, ISO strings or epoch milliseconds", () => {
  const asNumbers = decide({ now: STARTED_AT + TIMEOUT_MS })
  const asDates = decide({
    startedAt: new Date(STARTED_AT),
    now: new Date(STARTED_AT + TIMEOUT_MS),
  })
  const asStrings = decide({
    startedAt: new Date(STARTED_AT).toISOString(),
    now: new Date(STARTED_AT + TIMEOUT_MS).toISOString(),
  })
  assert.deepEqual(asDates, asNumbers)
  assert.deepEqual(asStrings, asNumbers)
})

/**
 * local CI — the hosted poller itself, and the one thing it can never do.
 *
 * The tests above pin the rule; these drive `scripts/check-local-ci-proof.mjs`,
 * the only production caller of it, with the clock, the API, the sleep and the
 * environment injected. That matters for the rerun path in particular: the
 * rule can return "rerun", and the poller structurally never asks for one.
 */

const CHECK_RUNS_PATH = `/repos/lapeninns/nabaperks/commits/${REQUESTED_SHA}/check-runs?check_name=${encodeURIComponent(contract.checkName)}&per_page=100`

const POLLER_ENV = Object.freeze({
  LOCAL_CI_MODE: "shadow",
  GITHUB_REPOSITORY: "lapeninns/nabaperks",
  GITHUB_TOKEN: "unit-test-token",
  GITHUB_EVENT_NAME: "pull_request",
  GITHUB_SHA: "f".repeat(40),
  LOCAL_CI_HEAD_SHA: REQUESTED_SHA,
})

test("observe-once reports current state with one fetch and no polling sleeps", async () => {
  for (const runs of [
    [],
    [checkRun({ status: "in_progress", conclusion: null })],
    [checkRun()],
    [checkRun({ conclusion: "failure" })],
    [checkRun({ conclusion: "timed_out" })],
    [checkRun({ app: { id: 15368, slug: "github-actions" } })],
  ]) {
    const result = await pollFor({
      responses: [runs],
      env: { LOCAL_CI_OBSERVE_ONCE: "true" },
    })
    assert.equal(result.code, 0)
    assert.equal(result.urls.length, 1)
    assert.deepEqual(result.sleeps, [])
    assert.match(
      result.logs.at(-1),
      /consult the App check for eventual local validation/
    )
    assert.ok(result.logs.some((line) => line.startsWith("observation (")))
    assert.ok(!result.logs.some((line) => line.startsWith("accepted:")))
  }
})

test("observe-once cannot soften an enforcing or inconsistent contract", async () => {
  for (const overrides of [
    { shadowMode: { ...contract.shadowMode, enabled: false } },
    { shadowMode: {} },
    { bridge: { ...contract.bridge, enforcement: "blocking" } },
    { bridge: { ...contract.bridge, requiredCheck: true } },
    { bridge: { ...contract.bridge, dependents: ["release-gate"] } },
  ]) {
    await assert.rejects(
      runLocalProofCheck({
        env: { ...POLLER_ENV, LOCAL_CI_OBSERVE_ONCE: "true" },
        contract: { ...contract, ...overrides },
        fetchImpl: () => assert.fail("must reject before calling the provider"),
        sleep: () => assert.fail("must never sleep"),
      }),
      /observe-once requires a non-required advisory shadow contract/
    )
  }
})

/**
 * The contract as cutover step 3 leaves it: the App provisioned, the bridge
 * blocking, shadow mode off. `validateContract` refuses a blocking bridge
 * while any App id is still a null sentinel, so the three have to move
 * together — which is the invariant, not a fixture convenience.
 */
const ENFORCING_CONTRACT = validateContract({
  ...JSON.parse(CONTRACT_TEXT),
  githubApp: {
    ...JSON.parse(CONTRACT_TEXT).githubApp,
    appId: 1234567,
    installationId: 7654321,
    repositoryId: 424242,
  },
  bridge: { ...JSON.parse(CONTRACT_TEXT).bridge, enforcement: "blocking" },
  shadowMode: { ...JSON.parse(CONTRACT_TEXT).shadowMode, enabled: false },
})

/**
 * Drive the poller offline. `responses` is one array of check runs per poll
 * (the last is reused), `offsets` are milliseconds past STARTED_AT returned by
 * successive `now()` calls — the first is the job's start, then one per poll.
 */
async function pollFor(options = {}) {
  const {
    responses = [[]],
    offsets = [0, 0],
    env = {},
    contract: active = contract,
  } = options
  const urls = []
  const logs = []
  const sleeps = []
  let clockCalls = 0
  let fetchCalls = 0

  const code = await runLocalProofCheck({
    env: { ...POLLER_ENV, ...env },
    contract: active,
    fetchImpl: async (url) => {
      urls.push(url)
      const runs = responses[Math.min(fetchCalls++, responses.length - 1)]
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ check_runs: runs }),
      }
    },
    now: () => STARTED_AT + offsets[Math.min(clockCalls++, offsets.length - 1)],
    sleep: async (ms) => {
      sleeps.push(ms)
    },
    log: (message) => logs.push(message),
  })
  return { code, urls, logs, sleeps }
}

test("the poller reads exactly one check-runs URL, under the API root", async () => {
  const { code, urls, logs } = await pollFor({ responses: [[checkRun()]] })
  assert.equal(code, 0)
  assert.deepEqual(urls, [`https://api.github.com${CHECK_RUNS_PATH}`])
  assert.match(logs.at(-1), /^accepted: the local plane reported success/)
})

test("the poller waits between polls and accepts the proof when it lands", async () => {
  const { code, urls, sleeps, logs } = await pollFor({
    responses: [[], [checkRun()]],
    offsets: [0, 60_000, 120_000],
  })
  assert.equal(code, 0)
  assert.equal(urls.length, 2)
  assert.deepEqual(sleeps, [contract.bridge.pollIntervalSeconds * 1000])
  assert.match(logs.at(-1), /^accepted:/)
})

test("the poller refuses a check published by another App, shadow mode or not", async () => {
  const impostor = [checkRun({ app: { id: 15368, slug: "github-actions" } })]

  const shadowed = await pollFor({ responses: [impostor] })
  assert.equal(shadowed.code, 0, "shadow mode records the verdict and exits 0")
  assert.match(shadowed.logs.at(-2), /^rejected: check run identity refused/)
  assert.match(shadowed.logs.at(-1), /shadowMode\.enabled is true/)

  const enforcing = await pollFor({
    responses: [impostor],
    contract: ENFORCING_CONTRACT,
  })
  assert.equal(enforcing.code, 1, "an enforcing bridge fails on an impostor")
  assert.match(enforcing.logs.at(-1), /^rejected: check run identity refused/)
})

test("the poller rejects at the ceiling when the local plane never reports", async () => {
  const { code, logs, sleeps } = await pollFor({
    responses: [[]],
    offsets: [0, TIMEOUT_MS],
  })
  assert.equal(code, 0, "shadow mode still exits 0")
  assert.deepEqual(sleeps, [], "a timed-out poll does not sleep again")
  assert.match(logs.at(-2), /the local plane never reported/)

  const enforcing = await pollFor({
    responses: [[]],
    offsets: [0, TIMEOUT_MS],
    contract: ENFORCING_CONTRACT,
  })
  assert.equal(enforcing.code, 1)
})

test("the hosted poller is never the rerunner, so it never asks to be", async () => {
  // The rule's own precondition: "rerun" is returned only to a caller that
  // recorded an earlier timed-out attempt. This poller records none - it holds
  // `checks: read` and no Actions scope, and a running job cannot re-run the
  // workflow run it is part of - so no check run and no clock can produce one.
  const shapes = [
    null,
    checkRun(),
    checkRun({ conclusion: "failure" }),
    checkRun({ status: "in_progress", conclusion: null }),
    checkRun({ head_sha: OTHER_SHA }),
    checkRun({ app: null }),
    checkRun({ app: { id: 15368, slug: "github-actions" } }),
    checkRun({ name: "Local CI proof" }),
  ]
  for (const shape of shapes) {
    for (const elapsedMs of [0, 60_000, TIMEOUT_MS - 1, TIMEOUT_MS + 60_000]) {
      const decision = decideBridgeAction({
        checkRun: shape,
        requestedSha: REQUESTED_SHA,
        startedAt: STARTED_AT,
        now: STARTED_AT + elapsedMs,
        contract,
        previousOutcome: null,
        rerunAttempts: 0,
      })
      assert.notEqual(
        decision.action,
        "rerun",
        `${shape?.conclusion ?? shape?.status ?? "no check run"} at ${elapsedMs}ms`
      )
    }
  }

  // End to end: a green proof found after the ceiling has already passed is an
  // acceptance by this job, not a request to re-run anything.
  const late = await pollFor({
    responses: [[checkRun()]],
    offsets: [0, TIMEOUT_MS + 60_000],
  })
  assert.equal(late.code, 0)
  assert.match(late.logs.at(-1), /^accepted:/)
  for (const line of late.logs) assert.doesNotMatch(line, /rerun/i)
})

test("the poller refuses to build a request the environment could redirect", async () => {
  // `GITHUB_API_URL` is legitimately configurable - GitHub Enterprise Server
  // is a different host - so the guarantee is not "api.github.com" but "no
  // interpolated value can move the request off the root this job was given,
  // and no root that would publish the credential is accepted at all".
  for (const env of [
    { GITHUB_REPOSITORY: "lapeninns/.." },
    { GITHUB_REPOSITORY: "https://evil.example/lapeninns/nabaperks" },
    { GITHUB_API_URL: "http://api.github.com" },
    { GITHUB_API_URL: "https://api.github.com?to=evil.example" },
  ]) {
    const urls = []
    await assert.rejects(
      runLocalProofCheck({
        env: { ...POLLER_ENV, ...env },
        contract,
        fetchImpl: async (url) => {
          urls.push(url)
          throw new Error("the request must never be sent")
        },
        now: () => STARTED_AT,
        sleep: async () => {},
        log: () => {},
      }),
      (error) => {
        assert.match(error.message, /repository|api base url/i)
        return true
      },
      JSON.stringify(env)
    )
    assert.deepEqual(urls, [], `${JSON.stringify(env)} must not reach fetch`)
  }
})

test("the poller checks its own wiring before it waits two hours for nothing", async () => {
  assert.equal(
    resolveRequestedSha({
      GITHUB_EVENT_NAME: "push",
      GITHUB_SHA: REQUESTED_SHA.toUpperCase(),
      LOCAL_CI_HEAD_SHA: REQUESTED_SHA.toUpperCase(),
    }),
    REQUESTED_SHA
  )

  const cases = [
    [{ LOCAL_CI_HEAD_SHA: "" }, /must be a 40-character commit SHA/],
    [
      { LOCAL_CI_HEAD_SHA: POLLER_ENV.GITHUB_SHA },
      /wired to the wrong expression/,
    ],
    [
      { GITHUB_EVENT_NAME: "push", GITHUB_SHA: OTHER_SHA },
      /on push the bridge must poll GITHUB_SHA/,
    ],
  ]
  for (const [env, pattern] of cases) {
    const urls = []
    await assert.rejects(
      runLocalProofCheck({
        env: { ...POLLER_ENV, ...env },
        contract,
        fetchImpl: async (url) => {
          urls.push(url)
          throw new Error("the request must never be sent")
        },
        now: () => STARTED_AT,
        sleep: async () => {},
        log: () => {},
      }),
      (error) => {
        assert.match(error.message, pattern)
        return true
      }
    )
    assert.deepEqual(urls, [])
  }
})

test("the poller is inert until the plane is provisioned, and refuses a missing token", async () => {
  const dormant = await pollFor({ env: { LOCAL_CI_MODE: "" } })
  assert.equal(dormant.code, 0)
  assert.deepEqual(dormant.urls, [])
  assert.match(dormant.logs.at(-1), /LOCAL_CI_MODE is unset/)

  await assert.rejects(
    runLocalProofCheck({
      env: { ...POLLER_ENV, GITHUB_TOKEN: "" },
      contract,
      fetchImpl: async () => {
        throw new Error("the request must never be sent")
      },
      now: () => STARTED_AT,
      sleep: async () => {},
      log: () => {},
    }),
    /GITHUB_TOKEN is required to read check runs/
  )
})
