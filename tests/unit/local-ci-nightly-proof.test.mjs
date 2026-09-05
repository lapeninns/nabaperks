import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  loadContract,
  validateContract,
} from "../../ops/local-ci/core/contract.mjs"
import {
  NIGHTLY_PROOF_STATES,
  NightlyProofError,
  createGithubFetchJson,
  decideNightlyProof,
  findNewestNightlyProof,
  newestCheckRun,
  nightlyProofExitCode,
  runNightlyProofCheck,
} from "../../scripts/check-nightly-proof.mjs"

/**
 * local CI — the nightly freshness monitor.
 *
 * The bridge only reports on commits somebody pushed, so this monitor is the
 * only thing that notices a Mac that went to sleep on Tuesday. Everything it
 * concludes therefore has to survive the question the bridge already answers:
 * who published this check run? Anyone with `checks: write` can create one
 * with any name, and a monitor satisfied by a name and a timestamp would hold
 * the freshness gate green on a stranger's green check.
 */

const CONTRACT_TEXT = readFileSync(
  fileURLToPath(
    new URL("../../config/local-ci-contract.json", import.meta.url)
  ),
  "utf8"
)

// Exercise the pre-provisioning state explicitly, independent of live App IDs.
const sourceContract = loadContract(() => CONTRACT_TEXT)
const contract = validateContract({
  ...sourceContract,
  githubApp: {
    ...sourceContract.githubApp,
    appId: null,
    installationId: null,
    repositoryId: null,
  },
})

/** The contract once the App exists — cutover step 3's shape, not step 1's. */
const PROVISIONED = validateContract({
  ...JSON.parse(CONTRACT_TEXT),
  githubApp: {
    ...JSON.parse(CONTRACT_TEXT).githubApp,
    appId: 1234567,
    installationId: 7654321,
    repositoryId: 424242,
  },
})

const BLOCKING = validateContract({
  ...JSON.parse(CONTRACT_TEXT),
  githubApp: { ...PROVISIONED.githubApp },
  nightlyProof: {
    ...JSON.parse(CONTRACT_TEXT).nightlyProof,
    enforcement: "blocking",
  },
})

const NIGHTLY_NAME = contract.nightlyProof.checkName
const APP_SLUG = "nabaperks-local-ci"
const HEAD_SHA = "a".repeat(40)
const OLDER_SHA = "b".repeat(40)
const NOW = Date.parse("2026-09-05T09:47:00.000Z")
const HOUR = 3_600_000

const proof = (overrides = {}) => ({
  id: 4242,
  name: NIGHTLY_NAME,
  head_sha: HEAD_SHA,
  status: "completed",
  conclusion: "success",
  started_at: new Date(NOW - 6 * HOUR).toISOString(),
  completed_at: new Date(NOW - 5 * HOUR).toISOString(),
  app: { id: 1234567, slug: APP_SLUG },
  ...overrides,
})

const decide = (overrides = {}) =>
  decideNightlyProof({
    checkRun: proof(),
    requestedSha: HEAD_SHA,
    now: NOW,
    contract,
    ...overrides,
  })

/** A `(path) => json` reader over a fixed commit list and per-commit runs. */
function reader(commits, runsBySha = {}) {
  const paths = []
  return {
    paths,
    fetchJson: async (path) => {
      paths.push(path)
      if (!path.includes("/check-runs")) {
        return commits.map((sha) => ({ sha }))
      }
      const sha = path.split("/commits/")[1].split("/")[0]
      return { check_runs: runsBySha[sha] ?? [] }
    },
  }
}

test("a fresh proof this plane published is the only passing verdict", () => {
  const fresh = decide()
  assert.equal(fresh.state, "fresh")
  assert.equal(fresh.ok, true)
  assert.equal(fresh.conclusion, "success")
  assert.equal(fresh.headSha, HEAD_SHA)
  assert.equal(fresh.checkName, NIGHTLY_NAME)
  assert.equal(fresh.maxAgeHours, 36)
  assert.equal(Math.round(fresh.ageHours), 5)
  assert.deepEqual(fresh.violations, [])

  assert.ok(NIGHTLY_PROOF_STATES.includes("unidentified"))
  assert.equal(
    NIGHTLY_PROOF_STATES.filter((state) => state !== "fresh").length,
    NIGHTLY_PROOF_STATES.length - 1
  )
})

test("a check run published by anything else is refused, however green and however recent", () => {
  // The whole point of the gate: another installed App, or `github-actions`
  // itself from any workflow with `checks: write`, can publish a completed
  // successful run under this name. None of them is evidence the local agent
  // ran, so none of them may hold the freshness gate open.
  const impostors = [
    [{ app: { id: 15368, slug: "github-actions" } }, /github-actions/],
    [{ app: { id: 99, slug: "nabaperks-local-ci-staging" } }, /staging/],
    // A check left behind by something that is not a GitHub App at all - a
    // personal access token or a plain commit status - carries no `app`.
    [{ app: null }, /carries no `app` object/],
    [{ app: undefined }, /carries no `app` object/],
    // And a run named for the per-commit bridge check is not the nightly one.
    [{ name: contract.checkName }, /check run name is/],
  ]
  for (const [overrides, pattern] of impostors) {
    const verdict = decide({ checkRun: proof(overrides) })
    assert.equal(verdict.state, "unidentified", JSON.stringify(overrides))
    assert.equal(verdict.ok, false)
    assert.match(verdict.reason, pattern)
    assert.match(verdict.reason, new RegExp(`"${APP_SLUG}" GitHub App`))
    assert.ok(verdict.violations.length > 0)
  }
})

test("the pinned App id is enforced as soon as the App has been created", () => {
  // Until then `githubApp.appId` is a null sentinel and the slug is all there
  // is to check, which is exactly what the bridge does with the same helper.
  assert.equal(contract.githubApp.appId, null)
  assert.equal(
    decide({ checkRun: proof({ app: { slug: APP_SLUG } }) }).state,
    "fresh"
  )

  const wrongId = decideNightlyProof({
    checkRun: proof({ app: { id: 5, slug: APP_SLUG } }),
    requestedSha: HEAD_SHA,
    now: NOW,
    contract: PROVISIONED,
  })
  assert.equal(wrongId.state, "unidentified")
  assert.match(wrongId.reason, /check run app id is .*5.*expected "1234567"/)

  const rightId = decideNightlyProof({
    checkRun: proof(),
    requestedSha: HEAD_SHA,
    now: NOW,
    contract: PROVISIONED,
  })
  assert.equal(rightId.state, "fresh")
})

test("a proof for one commit is not a proof for another, and the check cannot be skipped", () => {
  const wrongCommit = decide({ requestedSha: OLDER_SHA })
  assert.equal(wrongCommit.state, "unidentified")
  assert.match(wrongCommit.reason, /head_sha is/)

  for (const requestedSha of [undefined, null, "", "not-a-sha"]) {
    assert.throws(
      () => decide({ requestedSha }),
      (error) =>
        error instanceof NightlyProofError &&
        error.code === "INVALID_INPUT" &&
        /requestedSha/.test(error.message)
    )
  }
})

test("the states below identity: missing, incomplete, failed, stale, fresh", () => {
  const missing = decide({ checkRun: null })
  assert.equal(missing.state, "missing")
  assert.equal(missing.headSha, null)

  const running = decide({ checkRun: proof({ status: "in_progress" }) })
  assert.equal(running.state, "incomplete")

  const red = decide({ checkRun: proof({ conclusion: "failure" }) })
  assert.equal(red.state, "failed")
  assert.match(red.reason, /not "success"/)

  const undated = decide({ checkRun: proof({ completed_at: "not a date" }) })
  assert.equal(undated.state, "incomplete")
  assert.match(undated.reason, /no parseable completed_at/)

  // Strictly less than the ceiling is fresh; exactly the ceiling is not.
  const at = (hours) =>
    decide({
      checkRun: proof({
        completed_at: new Date(NOW - hours * HOUR).toISOString(),
      }),
    })
  assert.equal(at(35.9).state, "fresh")
  assert.equal(at(36).state, "stale")
  assert.equal(at(48).state, "stale")

  // GitHub's clock and the runner's disagree by seconds; that is not a
  // negative age.
  assert.equal(at(-1).ageHours, 0)
  assert.equal(at(-1).state, "fresh")
})

test("enforcement decides the exit code; the verdict does not change with it", () => {
  const advisory = { nightlyProof: { enforcement: "advisory" } }
  const blocking = { nightlyProof: { enforcement: "blocking" } }
  const stale = decide({
    checkRun: proof({ completed_at: new Date(NOW - 40 * HOUR).toISOString() }),
  })

  assert.equal(nightlyProofExitCode(stale, advisory), 0)
  assert.equal(nightlyProofExitCode(stale, blocking), 1)
  assert.equal(nightlyProofExitCode(decide(), blocking), 0)
})

test("newestCheckRun orders by completion, falling back to the start", () => {
  assert.equal(newestCheckRun([]), null)
  assert.equal(newestCheckRun("not an array"), null)

  const older = proof({
    id: 1,
    completed_at: new Date(NOW - 9 * HOUR).toISOString(),
  })
  const newer = proof({
    id: 2,
    completed_at: new Date(NOW - 2 * HOUR).toISOString(),
  })
  assert.equal(newestCheckRun([older, newer]).id, 2)
  assert.equal(newestCheckRun([newer, older]).id, 2)

  const unfinished = {
    id: 3,
    started_at: new Date(NOW - HOUR).toISOString(),
    completed_at: null,
  }
  assert.equal(newestCheckRun([newer, unfinished]).id, 3)
})

test("an impostor never masks a genuine proof on an older commit", () => {
  // The Checks API answers by name, not by publisher. Stopping the walk at the
  // first commit carrying *any* completed run would let one stray check on
  // today's head hide a perfectly good proof from last night.
  const impostor = proof({
    id: 9,
    head_sha: HEAD_SHA,
    app: { id: 15368, slug: "github-actions" },
  })
  const genuine = proof({ id: 7, head_sha: OLDER_SHA })
  const { fetchJson } = reader([HEAD_SHA, OLDER_SHA], {
    [HEAD_SHA]: [impostor],
    [OLDER_SHA]: [genuine],
  })

  return findNewestNightlyProof({
    contract,
    repository: contract.repository,
    fetchJson,
  }).then((found) => {
    assert.equal(found.checkRun.id, 7)
    assert.equal(found.headSha, OLDER_SHA)
    assert.equal(found.commitsWalked, 2)
    assert.equal(
      decideNightlyProof({
        checkRun: found.checkRun,
        requestedSha: found.headSha,
        now: NOW,
        contract,
      }).state,
      "fresh"
    )
  })
})

test("a newer impostor on the same commit does not outrank the genuine run", async () => {
  const genuine = proof({ id: 7 })
  const impostor = proof({
    id: 9,
    completed_at: new Date(NOW - HOUR).toISOString(),
    app: { id: 15368, slug: "github-actions" },
  })
  const { fetchJson } = reader([HEAD_SHA], { [HEAD_SHA]: [genuine, impostor] })

  const found = await findNewestNightlyProof({
    contract,
    repository: contract.repository,
    fetchJson,
  })
  assert.equal(found.checkRun.id, 7)
})

test("when every candidate is an impostor the verdict names it rather than reporting silence", async () => {
  const impostor = proof({ id: 9, app: { id: 15368, slug: "github-actions" } })
  const { fetchJson } = reader([HEAD_SHA, OLDER_SHA], {
    [HEAD_SHA]: [impostor],
    [OLDER_SHA]: [proof({ id: 8, head_sha: OLDER_SHA, app: null })],
  })

  const found = await findNewestNightlyProof({
    contract,
    repository: contract.repository,
    fetchJson,
  })
  assert.equal(found.checkRun.id, 9)
  assert.equal(found.headSha, HEAD_SHA)
  assert.equal(found.commitsWalked, 2)

  const verdict = decideNightlyProof({
    checkRun: found.checkRun,
    requestedSha: found.headSha,
    now: NOW,
    contract,
  })
  assert.equal(verdict.state, "unidentified")
  assert.equal(verdict.ok, false)
})

test("the walk asks about the repository it was given, and refuses one that could move the request", async () => {
  const { paths, fetchJson } = reader([HEAD_SHA], { [HEAD_SHA]: [proof()] })
  const found = await findNewestNightlyProof({
    contract,
    repository: "lapeninns/nabaperks",
    ref: "main",
    fetchJson,
    commitsToScan: 5,
  })
  assert.equal(found.checkRun.id, 4242)
  assert.deepEqual(paths, [
    "/repos/lapeninns/nabaperks/commits?sha=main&per_page=5",
    `/repos/lapeninns/nabaperks/commits/${HEAD_SHA}/check-runs?check_name=${encodeURIComponent(NIGHTLY_NAME)}&per_page=100`,
  ])

  for (const repository of ["lapeninns/..", "https://evil.example/a/b", ""]) {
    await assert.rejects(
      findNewestNightlyProof({ contract, repository, fetchJson }),
      /repository/i,
      repository
    )
  }
  await assert.rejects(
    findNewestNightlyProof({ contract, repository: "lapeninns/nabaperks" }),
    (error) => error.code === "INVALID_READER"
  )
})

test("the reader will not carry its bearer token off the API root", async () => {
  const calls = []
  const fetchJson = createGithubFetchJson({
    token: "unit-test-token",
    apiRoot: "https://api.github.com",
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ ok: 1 }),
      }
    },
  })

  assert.deepEqual(await fetchJson("/repos/lapeninns/nabaperks/commits"), {
    ok: 1,
  })
  assert.equal(
    calls[0].url,
    "https://api.github.com/repos/lapeninns/nabaperks/commits"
  )
  assert.equal(calls[0].init.headers.authorization, "Bearer unit-test-token")

  for (const path of [
    "https://evil.example/steal",
    "//evil.example/steal",
    "/repos/../../steal",
  ]) {
    await assert.rejects(fetchJson(path), /request path|API root/i, path)
  }
  assert.equal(calls.length, 1, "a refused path is never sent")

  assert.throws(
    () => createGithubFetchJson({ token: "" }),
    (error) => error.code === "MISSING_TOKEN"
  )
})

test("the reader reports a failed request rather than treating it as an absent proof", async () => {
  const fetchJson = createGithubFetchJson({
    token: "unit-test-token",
    fetchImpl: async () => ({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    }),
  })
  await assert.rejects(
    fetchJson("/repos/lapeninns/nabaperks/commits"),
    (error) =>
      error instanceof NightlyProofError &&
      error.code === "GITHUB_REQUEST_FAILED" &&
      /403 Forbidden/.test(error.message)
  )
})

test("the monitor end to end: dormant, advisory, and blocking", async () => {
  const run = async (options = {}) => {
    const logs = []
    const code = await runNightlyProofCheck({
      env: {
        LOCAL_CI_MODE: "shadow",
        GITHUB_REPOSITORY: "lapeninns/nabaperks",
        ...options.env,
      },
      now: NOW,
      contract: options.contract ?? contract,
      fetchJson: options.fetchJson,
      log: (message) => logs.push(message),
    })
    return { code, logs }
  }

  const dormant = await run({
    env: { LOCAL_CI_MODE: "" },
    fetchJson: async () => {
      throw new Error("a dormant plane must not be polled")
    },
  })
  assert.equal(dormant.code, 0)
  assert.match(dormant.logs.at(-1), /LOCAL_CI_MODE is unset/)

  const impostorReader = reader([HEAD_SHA], {
    [HEAD_SHA]: [proof({ app: { id: 15368, slug: "github-actions" } })],
  }).fetchJson

  const advisory = await run({ fetchJson: impostorReader })
  assert.equal(advisory.code, 0, "advisory records the verdict and exits 0")
  assert.ok(advisory.logs.some((line) => line.startsWith("unidentified:")))
  assert.ok(
    advisory.logs.some((line) => line.includes(`"${APP_SLUG}" GitHub App`))
  )
  assert.ok(advisory.logs.some((line) => /does not page/.test(line)))

  const enforced = await run({
    contract: BLOCKING,
    fetchJson: impostorReader,
  })
  assert.equal(enforced.code, 1, "a blocking monitor fails on an impostor")

  const green = await run({
    contract: BLOCKING,
    fetchJson: reader([HEAD_SHA], { [HEAD_SHA]: [proof()] }).fetchJson,
  })
  assert.equal(green.code, 0)
  assert.ok(green.logs.some((line) => line.startsWith("fresh:")))

  await assert.rejects(
    run({
      env: { GITHUB_REPOSITORY: "lapeninns/.." },
      fetchJson: async () => {
        throw new Error("the request must never be sent")
      },
    }),
    /GITHUB_REPOSITORY/
  )
})
