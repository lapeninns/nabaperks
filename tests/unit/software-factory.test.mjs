import assert from "node:assert/strict"
import { test } from "node:test"
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  symlinkSync,
  mkdirSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  evaluatePullRequest,
  evaluateRelease,
} from "../../ops/factory/state.mjs"
import {
  withJournal,
  reserveRepair,
  readJournal,
} from "../../ops/factory/journal.mjs"
import {
  factoryPolicy as policy,
  collectFactoryStatus,
} from "../../scripts/ci/factory-status.mjs"
import { factoryAction } from "../../scripts/ci/factory-action.mjs"

const SHA = "a".repeat(40),
  MERGE = "b".repeat(40),
  NOW = Date.parse("2026-09-08T14:00:00Z")
function ready() {
  return {
    number: 1,
    url: "https://github.com/lapeninns/nabaperks/pull/1",
    complete: true,
    state: "OPEN",
    isDraft: false,
    headSha: SHA,
    candidateSha: MERGE,
    headRepository: policy.repository,
    headCommittedAt: new Date(NOW).toISOString(),
    reviewDecision: "APPROVED",
    mergeStateStatus: "CLEAN",
    unresolvedThreads: 0,
    repairCycles: 0,
    reviews: [
      {
        id: 1,
        userId: policy.reviewer.userId,
        login: policy.reviewer.login,
        sha: SHA,
        state: "COMMENTED",
      },
    ],
    checks: policy.requiredChecks.map((check, index) => ({
      ...check,
      id: index + 1,
      sha: MERGE,
      status: "completed",
      conclusion: "success",
    })),
  }
}
const state = (pr) => evaluatePullRequest(pr, policy, NOW)

test("current exact evidence asks for a product decision, never auto-merges", () => {
  assert.equal(state(ready()).action, "accept-product-and-authorise-merge")
  assert.equal(
    state({ ...ready(), reviewDecision: "REVIEW_REQUIRED" }).state,
    "approval-needed"
  )
  assert.equal(
    state({ ...ready(), mergeStateStatus: "BEHIND" }).state,
    "merge-blocked"
  )
})

test("missing, wrong-App, old-head and skipped checks cannot report readiness", () => {
  for (const change of [
    undefined,
    { appId: 999 },
    { sha: SHA },
    { conclusion: "skipped" },
    { status: "queued", conclusion: null },
  ]) {
    const pr = ready()
    if (change) Object.assign(pr.checks[0], change)
    else pr.checks.shift()
    assert.notEqual(state(pr).action, "accept-product-and-authorise-merge")
  }
  const pr = ready()
  pr.checks.push({
    ...pr.checks[0],
    id: 99,
    status: "queued",
    conclusion: null,
  })
  assert.equal(state(pr).state, "testing")
})

test("old and impersonated reviewer records never cover the current head", () => {
  for (const change of [
    { sha: MERGE },
    { userId: 999 },
    { login: "someone-else" },
    { state: "DISMISSED" },
  ]) {
    const pr = ready()
    Object.assign(pr.reviews[0], change)
    assert.equal(state(pr).action, "request-current-review")
  }
  const pr = {
    ...ready(),
    reviews: [],
    reviewRequestedAt: new Date(NOW - 21 * 60_000).toISOString(),
  }
  assert.equal(state(pr).state, "review-stalled")
})

test("repairs are bounded across pushes and external code is never admitted", () => {
  const pr = { ...ready(), unresolvedThreads: 1 }
  assert.equal(state(pr).state, "fixing")
  assert.equal(state({ ...pr, repairCycles: 2 }).action, "decide-next-step")
  assert.equal(
    state({ ...pr, headRepository: "outsider/nabaperks" }).action,
    "use-hosted-review"
  )
  assert.equal(state({ ...pr, complete: false }).state, "unknown")
})

test("old release waiting for approval asks for inspection, never blind approval or cancellation", () => {
  const run = {
    id: 1,
    sha: SHA,
    status: "waiting",
    createdAt: new Date(NOW - 60_000).toISOString(),
    complete: true,
    environments: [{ name: "Production", reviewers: ["owner"] }],
  }
  assert.equal(
    evaluateRelease(run, MERGE, policy, NOW).action,
    "inspect-before-cancelling"
  )
  assert.equal(
    evaluateRelease(run, SHA, policy, NOW).state,
    "release-approval-needed"
  )
  assert.equal(
    evaluateRelease(
      { ...run, status: "completed", conclusion: "success", environments: [] },
      SHA,
      policy,
      NOW
    ).action,
    "verify-live-journey"
  )
})

test("journal reserves repair before work and persists the cap across head changes", () => {
  const directory = realpathSync(
    mkdtempSync(join(tmpdir(), "factory-journal-"))
  )
  try {
    withJournal(directory, (journal, save) => {
      reserveRepair(journal, {
        number: 1,
        sha: SHA,
        maxRepairCycles: 2,
        now: new Date(NOW).toISOString(),
      })
      save()
      assert.throws(() => withJournal(directory, () => {}), /locked/)
    })
    withJournal(directory, (journal, save) => {
      assert.equal(journal.pullRequests[1].repairCycles, 1)
      assert.throws(
        () =>
          reserveRepair(journal, { number: 1, sha: MERGE, maxRepairCycles: 2 }),
        /already active/
      )
      delete journal.pullRequests[1].activeRepair
      reserveRepair(journal, { number: 1, sha: MERGE, maxRepairCycles: 2 })
      delete journal.pullRequests[1].activeRepair
      assert.throws(
        () =>
          reserveRepair(journal, { number: 1, sha: SHA, maxRepairCycles: 2 }),
        /budget/
      )
      save()
    })
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

function readFixture(args) {
  if (args[0] === "pr")
    return {
      number: 1,
      headRefOid: SHA,
      state: "OPEN",
      isDraft: false,
      reviewDecision: "REVIEW_REQUIRED",
      mergeStateStatus: "BLOCKED",
    }
  const path = args.find((arg) => arg.startsWith("repos/"))
  if (args.includes("graphql"))
    return [
      {
        data: {
          repository: {
            pullRequest: {
              reviewThreads: { nodes: [], pageInfo: { hasNextPage: false } },
            },
          },
        },
      },
    ]
  if (
    path?.endsWith("/reviews?per_page=100") ||
    path?.endsWith("/comments?per_page=100")
  )
    return [[]]
  if (path?.includes("/check-runs?"))
    return [
      {
        check_runs: ready().checks.map((check) => ({
          ...check,
          app: { id: check.appId },
          head_sha: check.sha,
        })),
      },
    ]
  if (path?.includes(`/commits/${SHA}`))
    return { commit: { committer: { date: new Date(NOW).toISOString() } } }
  if (args.includes("--jq")) return { sha: SHA, merge: MERGE }
  return {
    head: { sha: SHA, repo: { full_name: policy.repository } },
    merge_commit_sha: MERGE,
  }
}

test("review submission is once per exact head and stores intent before remote write", () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "factory-review-")))
  let calls = 0
  try {
    const request = {
      action: "request-review",
      number: 1,
      sha: SHA,
      directory,
      read: readFixture,
      now: new Date(NOW).toISOString(),
      post: (_command, args, options) => {
        calls++
        assert.equal(args.at(-1), "-")
        assert.match(JSON.parse(options.input).body, /^@codex review/)
        assert.equal(
          JSON.parse(readFileSync(join(directory, "state.json"), "utf8"))
            .pullRequests[1].reviews[SHA].outcome,
          "uncertain"
        )
        return { status: 0, stdout: '{"id":123}' }
      },
    }
    assert.equal(factoryAction(request).commentId, 123)
    assert.throws(() => factoryAction(request), /already has/)
    assert.equal(calls, 1)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("uncertain writes and a changed candidate cannot produce duplicate requests", () => {
  const directory = realpathSync(
    mkdtempSync(join(tmpdir(), "factory-uncertain-"))
  )
  try {
    const request = {
      action: "request-review",
      number: 1,
      sha: SHA,
      directory,
      read: readFixture,
      now: new Date(NOW).toISOString(),
      post: () => ({ status: null, signal: "SIGTERM" }),
    }
    assert.throws(() => factoryAction({ ...request, sha: MERGE }), /changed/)
    assert.throws(() => factoryAction(request), /uncertain/)
    assert.throws(() => factoryAction(request), /already has/)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test("merge conflicts and absent candidates precede waiting for missing checks", () => {
  for (const change of [
    { mergeStateStatus: "DIRTY" },
    { mergeStateStatus: "BEHIND" },
    { candidateSha: null },
  ])
    assert.equal(
      state({ ...ready(), checks: [], ...change }).state,
      "merge-blocked"
    )
  assert.equal(
    state({ ...ready(), checks: [], mergeStateStatus: "BLOCKED" }).state,
    "testing"
  )
})

test("release snapshot rejects a changed or unavailable main revision", () => {
  function fixture(finalSha) {
    let mainReads = 0
    return (args) => {
      const path = args.find((arg) => arg.startsWith("repos/"))
      if (path?.endsWith("/commits/main"))
        return { sha: ++mainReads === 1 ? SHA : finalSha }
      if (path?.includes("/pulls?")) return [[]]
      if (path?.includes("status=")) return [{ workflow_runs: [] }]
      if (path?.endsWith("runs?per_page=1")) return { workflow_runs: [] }
      throw new Error("Unexpected fixture read")
    }
  }
  assert.equal(collectFactoryStatus({ read: fixture(SHA) }).mainSha, SHA)
  for (const changed of [MERGE, undefined])
    assert.throws(
      () => collectFactoryStatus({ read: fixture(changed) }),
      /Base branch changed/
    )
})

test("both journal callers reject symlinks and non-files while regular reads persist", () => {
  const directory = realpathSync(mkdtempSync(join(tmpdir(), "factory-file-")))
  const path = join(directory, "state.json")
  const value = { version: 1, pullRequests: { 284: { repairCycles: 1 } } }
  try {
    assert.deepEqual(readJournal(directory), { version: 1, pullRequests: {} })
    writeFileSync(join(directory, "target.json"), JSON.stringify(value))
    symlinkSync(join(directory, "target.json"), path)
    assert.throws(() => readJournal(directory))
    assert.throws(() => withJournal(directory, () => {}))
    rmSync(path)
    mkdirSync(path)
    assert.throws(() => readJournal(directory), /Invalid factory journal file/)
    rmSync(path, { recursive: true })
    writeFileSync(path, JSON.stringify(value))
    assert.deepEqual(readJournal(directory), value)
    withJournal(directory, (journal) => assert.deepEqual(journal, value))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
