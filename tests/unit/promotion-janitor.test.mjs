import assert from "node:assert/strict"
import { test } from "node:test"
import {
  EVIDENCE_MAX_AGE_MS,
  JANITOR_STALE_MS,
  PRODUCTION_ENVIRONMENT,
  PROMOTION_WORKFLOW_PATH,
  REJECTION_COMMENT,
  createGithubClient,
  decidePromotion,
  gateEnteredAt,
  renderAnnotations,
  renderSummary,
  runPromotionJanitor,
} from "../../scripts/release/promotion-janitor.mjs"

const NOW = new Date("2026-09-22T12:00:00Z")
const PRODUCTION_ID = 17167874456
const MONITORING_ID = 9001
const RUNS_PATH =
  "/repos/lapeninns/nabaperks/actions/workflows/production-database.yml/runs"

function minutesAgo(minutes) {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString()
}

function promotionRun(id, overrides = {}) {
  return {
    id,
    path: PROMOTION_WORKFLOW_PATH,
    head_branch: "main",
    status: "waiting",
    repository: { full_name: "lapeninns/nabaperks" },
    html_url: `https://github.com/lapeninns/nabaperks/actions/runs/${id}`,
    run_started_at: minutesAgo(200),
    ...overrides,
  }
}

function pending(name, id) {
  return { environment: { id, name }, wait_timer: 0, reviewers: [] }
}

function waitingJobs(minutes, name = "Database promotion") {
  return {
    total_count: 2,
    jobs: [
      {
        id: 1,
        name: "Production database preflight",
        status: "completed",
        started_at: minutesAgo(minutes + 30),
      },
      { id: 2, name, status: "waiting", started_at: minutesAgo(minutes) },
    ],
  }
}

function response(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (body === undefined ? "" : JSON.stringify(body)),
  }
}

// Route table keyed by "METHOD /path". Values are a response spec or a list of
// specs consumed in order (the last one repeats), so re-fetches can differ.
function mockGithub({ runsByStatus = {}, routes = {} } = {}) {
  const calls = []
  const cursors = new Map()
  const fetcher = async (input, init = {}) => {
    const url = new URL(String(input))
    const method = init.method ?? "GET"
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ method, path: url.pathname, search: url.search, body, init })
    if (method === "GET" && url.pathname === RUNS_PATH) {
      const status = url.searchParams.get("status")
      return response(200, { workflow_runs: runsByStatus[status] ?? [] })
    }
    const key = `${method} ${url.pathname}`
    const route = routes[key]
    if (!route) return response(404, { message: `unmocked ${key}` })
    const specs = Array.isArray(route) ? route : [route]
    const index = cursors.get(key) ?? 0
    cursors.set(key, index + 1)
    const spec = specs[Math.min(index, specs.length - 1)]
    return response(spec.status ?? 200, spec.body)
  }
  return { calls, fetcher }
}

function runRoutes(id, { deployments, jobs, reject, cancel }) {
  const base = `/repos/lapeninns/nabaperks/actions/runs/${id}`
  const routes = {
    [`GET ${base}/pending_deployments`]: deployments,
    [`GET ${base}/jobs`]: { body: jobs },
  }
  if (reject) routes[`POST ${base}/pending_deployments`] = reject
  if (cancel) routes[`POST ${base}/cancel`] = cancel
  return routes
}

function writes(calls) {
  return calls.filter(({ method }) => method !== "GET")
}

test("the stale threshold is coupled to the one-hour release evidence expiry", () => {
  assert.equal(EVIDENCE_MAX_AGE_MS, 3_600_000)
  assert.equal(JANITOR_STALE_MS, 75 * 60_000)
  assert.ok(JANITOR_STALE_MS > EVIDENCE_MAX_AGE_MS)
  // One missed 15-minute tick after the threshold must still act within 2h.
  assert.ok(JANITOR_STALE_MS + 15 * 60_000 < 2 * 3_600_000)
  assert.equal(PRODUCTION_ENVIRONMENT, "Production")
  assert.match(REJECTION_COMMENT, /maxAgeMs 3600000/)
  assert.match(REJECTION_COMMENT, /fresh complete outer run/)
})

test("gate entry uses the waiting job start, falling back to the run start", () => {
  const run = promotionRun(1)
  assert.equal(gateEnteredAt(run, waitingJobs(90).jobs), minutesAgo(90))
  assert.equal(gateEnteredAt(run, []), run.run_started_at)
  assert.equal(
    gateEnteredAt(run, [
      { status: "waiting", started_at: null, created_at: minutesAgo(80) },
    ]),
    minutesAgo(80)
  )
})

test("the decision core rejects only Production gates older than the threshold", () => {
  const run = promotionRun(1)
  const stale = decidePromotion({
    run,
    pendingDeployments: [
      pending("Production", PRODUCTION_ID),
      pending("Monitoring", MONITORING_ID),
    ],
    jobs: waitingJobs(90).jobs,
    now: NOW,
  })
  assert.equal(stale.action, "reject")
  assert.deepEqual(stale.environmentIds, [PRODUCTION_ID])
  assert.equal(stale.gateJob, "Database promotion")
  assert.equal(stale.waitedMinutes, 90)

  const boundary = decidePromotion({
    run,
    pendingDeployments: [pending("Production", PRODUCTION_ID)],
    jobs: [{ name: "gate", status: "waiting", started_at: minutesAgo(75) }],
    now: NOW,
  })
  assert.equal(boundary.action, "skip")
  assert.equal(boundary.reason, "within-threshold")

  const unblocked = decidePromotion({
    run,
    pendingDeployments: [],
    jobs: [],
    now: NOW,
  })
  assert.equal(unblocked.action, "skip")
  assert.equal(unblocked.reason, "not-approval-blocked")

  for (const name of ["Monitoring", "production", "Recovery Drill"]) {
    const other = decidePromotion({
      run,
      pendingDeployments: [pending(name, MONITORING_ID)],
      jobs: waitingJobs(500).jobs,
      now: NOW,
    })
    assert.equal(other.action, "skip", name)
    assert.equal(other.reason, "no-production-gate", name)
  }
})

test("a stale Production-gated promotion is rejected with the explanatory comment", async () => {
  const { calls, fetcher } = mockGithub({
    runsByStatus: { waiting: [promotionRun(41)] },
    routes: runRoutes(41, {
      deployments: { body: [pending("Production", PRODUCTION_ID)] },
      jobs: waitingJobs(120),
      reject: { status: 200, body: [] },
    }),
  })

  const report = await runPromotionJanitor({ token: "t", fetcher, now: NOW })

  const posted = writes(calls)
  assert.equal(posted.length, 1)
  assert.equal(
    posted[0].path,
    "/repos/lapeninns/nabaperks/actions/runs/41/pending_deployments"
  )
  assert.deepEqual(posted[0].body, {
    environment_ids: [PRODUCTION_ID],
    state: "rejected",
    comment: REJECTION_COMMENT,
  })
  assert.equal(report.results[0].outcome, "rejected")
  assert.deepEqual(report.errors, [])
  for (const { init } of calls) {
    assert.equal(init.headers["x-github-api-version"], "2026-03-10")
    assert.equal(init.headers.authorization, "Bearer t")
    assert.equal(init.redirect, "error")
  }
})

test("fresh, unblocked and non-Production runs are never written to", async () => {
  const { calls, fetcher } = mockGithub({
    runsByStatus: {
      waiting: [promotionRun(51), promotionRun(52), promotionRun(53)],
      in_progress: [promotionRun(54, { status: "in_progress" })],
    },
    routes: {
      ...runRoutes(51, {
        deployments: { body: [pending("Production", PRODUCTION_ID)] },
        jobs: waitingJobs(30),
      }),
      ...runRoutes(52, { deployments: { body: [] }, jobs: waitingJobs(1) }),
      ...runRoutes(53, {
        deployments: { body: [pending("Monitoring", MONITORING_ID)] },
        jobs: waitingJobs(600),
      }),
      ...runRoutes(54, { deployments: { body: [] }, jobs: waitingJobs(1) }),
    },
  })

  const report = await runPromotionJanitor({ token: "t", fetcher, now: NOW })

  assert.deepEqual(writes(calls), [])
  assert.deepEqual(
    report.results.map(({ runId, reason }) => [runId, reason]),
    [
      [54, "not-approval-blocked"],
      [51, "within-threshold"],
      [52, "not-approval-blocked"],
      [53, "no-production-gate"],
    ]
  )
  // Unblocked runs do not need a jobs read.
  assert.equal(
    calls.some(({ path }) => path.endsWith("/52/jobs")),
    false
  )
})

test("runs from other branches, workflows or repositories are ignored", async () => {
  const { calls, fetcher } = mockGithub({
    runsByStatus: {
      waiting: [
        promotionRun(61, { head_branch: "codex/x" }),
        promotionRun(62, { path: ".github/workflows/production-deploy.yml" }),
        promotionRun(63, { repository: { full_name: "someone/fork" } }),
      ],
    },
  })

  const report = await runPromotionJanitor({ token: "t", fetcher, now: NOW })

  assert.equal(report.checkedRuns, 0)
  assert.deepEqual(
    calls.map(({ path }) => path),
    [RUNS_PATH, RUNS_PATH, RUNS_PATH]
  )
})

test("reject refusals fall back to cancelling the run", async () => {
  for (const status of [403, 404, 422]) {
    const { calls, fetcher } = mockGithub({
      runsByStatus: { waiting: [promotionRun(71)] },
      routes: runRoutes(71, {
        deployments: { body: [pending("Production", PRODUCTION_ID)] },
        jobs: waitingJobs(100),
        reject: { status, body: { message: "not a required reviewer" } },
        cancel: { status: 202, body: {} },
      }),
    })

    const report = await runPromotionJanitor({ token: "t", fetcher, now: NOW })

    assert.deepEqual(
      writes(calls).map(({ path }) => path.split("/").at(-1)),
      ["pending_deployments", "cancel"],
      String(status)
    )
    assert.equal(report.results[0].outcome, "cancelled", String(status))
    assert.equal(report.results[0].rejectStatus, status)
    assert.deepEqual(report.errors, [])
  }
})

test("a 409 from cancel is a benign already-finished outcome", async () => {
  const { fetcher } = mockGithub({
    runsByStatus: { waiting: [promotionRun(81)] },
    routes: runRoutes(81, {
      deployments: { body: [pending("Production", PRODUCTION_ID)] },
      jobs: waitingJobs(100),
      reject: { status: 403, body: {} },
      cancel: { status: 409, body: { message: "Cannot cancel" } },
    }),
  })

  const report = await runPromotionJanitor({ token: "t", fetcher, now: NOW })

  assert.equal(report.results[0].outcome, "already-finished")
  assert.deepEqual(report.errors, [])
})

test("unexpected write failures are reported as errors without escalation", async () => {
  const { calls, fetcher } = mockGithub({
    runsByStatus: { waiting: [promotionRun(82), promotionRun(83)] },
    routes: {
      ...runRoutes(82, {
        deployments: { body: [pending("Production", PRODUCTION_ID)] },
        jobs: waitingJobs(100),
        reject: { status: 500, body: {} },
      }),
      ...runRoutes(83, {
        deployments: { body: [pending("Production", PRODUCTION_ID)] },
        jobs: waitingJobs(100),
        reject: { status: 403, body: {} },
        cancel: { status: 500, body: {} },
      }),
    },
  })

  const report = await runPromotionJanitor({ token: "t", fetcher, now: NOW })

  assert.equal(
    calls.some(({ path }) => path.endsWith("/82/cancel")),
    false
  )
  assert.deepEqual(
    report.results.map(({ outcome }) => outcome),
    ["error", "error"]
  )
  assert.equal(report.errors.length, 2)
})

test("the race guard skips a run whose approval landed before acting", async () => {
  const { calls, fetcher } = mockGithub({
    runsByStatus: { waiting: [promotionRun(91)] },
    routes: runRoutes(91, {
      deployments: [
        { body: [pending("Production", PRODUCTION_ID)] },
        { body: [] },
      ],
      jobs: waitingJobs(100),
    }),
  })

  const report = await runPromotionJanitor({ token: "t", fetcher, now: NOW })

  assert.deepEqual(writes(calls), [])
  assert.equal(report.results[0].action, "skip")
  assert.equal(report.results[0].reason, "approval-landed")
})

test("dry-run reports the decision and performs zero writes", async () => {
  const { calls, fetcher } = mockGithub({
    runsByStatus: { waiting: [promotionRun(101)] },
    routes: runRoutes(101, {
      deployments: { body: [pending("Production", PRODUCTION_ID)] },
      jobs: waitingJobs(240),
    }),
  })

  const report = await runPromotionJanitor({
    token: "t",
    fetcher,
    now: NOW,
    dryRun: true,
  })

  assert.equal(report.dryRun, true)
  assert.ok(calls.length > 0)
  assert.deepEqual(writes(calls), [])
  assert.equal(report.results[0].outcome, "would-reject")
  assert.equal(report.results[0].waitedMinutes, 240)
})

test("the dry-run client refuses every write before any request is sent", async () => {
  const { calls, fetcher } = mockGithub()
  const client = createGithubClient({ token: "t", fetcher, dryRun: true })
  await assert.rejects(
    client.post("/repos/lapeninns/nabaperks/actions/runs/1/cancel"),
    /dry-run/
  )
  assert.deepEqual(calls, [])
})

test("the janitor refuses other repositories and a missing token", async () => {
  const { fetcher } = mockGithub()
  await assert.rejects(
    runPromotionJanitor({ token: "t", repository: "someone/fork", fetcher }),
    /unexpected GitHub repository/
  )
  await assert.rejects(
    runPromotionJanitor({ token: "", fetcher }),
    /GH_TOKEN is required/
  )
})

test("listing failures stop the pass instead of reporting a false clean result", async () => {
  const fetcher = async () => response(503, {})
  await assert.rejects(
    runPromotionJanitor({ token: "t", fetcher, now: NOW }),
    /HTTP 503/
  )
})

test("annotations and the step summary describe every action", () => {
  const report = {
    dryRun: false,
    checkedRuns: 2,
    results: [
      {
        runId: 7,
        runUrl: "https://github.com/lapeninns/nabaperks/actions/runs/7",
        action: "reject",
        outcome: "cancelled",
        gateJob: "Database | promotion",
        waitedMinutes: 95,
        rejectStatus: 403,
      },
      {
        runId: 8,
        runUrl: "https://github.com/lapeninns/nabaperks/actions/runs/8",
        action: "skip",
        reason: "within-threshold",
        gateJob: "Authenticate the deployed baseline",
        waitedMinutes: 10,
      },
    ],
    errors: [],
  }

  const annotations = renderAnnotations(report)
  assert.equal(annotations.length, 1)
  assert.match(annotations[0], /^::warning title=Promotion janitor::/)
  assert.match(annotations[0], /run 7/)

  const summary = renderSummary(report)
  assert.match(summary, /^## Production promotion janitor/)
  assert.match(summary, /\| Run \| Gate job \| Waited \(min\) \| Decision \|/)
  assert.match(summary, /Database \\\| promotion/)
  assert.match(summary, /\| 95 \| cancelled/)

  const clean = renderAnnotations({ ...report, results: [report.results[1]] })
  assert.equal(clean.length, 1)
  assert.match(clean[0], /^::notice title=Promotion janitor::No Production/)
})
