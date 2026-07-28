import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const root = process.cwd()

function read(...parts) {
  return readFileSync(join(root, ...parts), "utf8")
}

function smokeFilters(workflow) {
  return [
    ...workflow.matchAll(
      /jq -e --arg revision "\$EXPECTED_REVISION" '([^']+)' <<<"\$body"/g
    ),
  ].map(([, filter]) => filter)
}

function runSmokeFilter(filter, body, revision = "abcdef123456") {
  return spawnSync("jq", ["-e", "--arg", "revision", revision, filter], {
    input: JSON.stringify(body),
    encoding: "utf8",
  })
}

function workflowUrls(workflow) {
  return [...workflow.matchAll(/https:\/\/[^\s"')]+/g)].map(
    ([value]) => new URL(value)
  )
}

function hasProductionProbeUrl(urls, pathname) {
  return urls.some(
    (url) =>
      url.protocol === "https:" &&
      url.hostname === "nabaperks.com" &&
      url.port === "" &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === pathname &&
      url.search === "" &&
      url.hash === ""
  )
}

test("production exposes separate versioned liveness and dependency readiness", () => {
  const health = read("app", "api", "health", "route.ts")
  const readiness = read("app", "api", "readiness", "route.ts")
  const releaseRevision = read("lib", "observability", "release-revision.ts")
  const proxy = read("proxy.ts")

  assert.match(health, /scope: "liveness"/)
  assert.match(health, /releaseRevision\(\{ fallback: VERSION \}\)/)
  assert.match(releaseRevision, /VERCEL_GIT_COMMIT_SHA/)
  assert.match(releaseRevision, /NABAPERKS_BUILD_REVISION/)
  assert.match(releaseRevision, /revision-mismatch/)
  assert.match(releaseRevision, /invalid-revision/)
  assert.match(health, /VERCEL_TARGET_ENV/)
  assert.match(readiness, /status: ready \? "ready" : "not_ready"/)
  assert.match(readiness, /status: ready \? 200 : 503/)
  assert.match(readiness, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(readiness, /PRODUCTION_MONITOR_SECRET_NEXT/)
  assert.match(readiness, /matchesAnyBearerSecret/)
  assert.match(readiness, /checkOperationalReadiness/)
  assert.match(readiness, /process\.env\.STAGING_MODE === "ephemeral"/)
  assert.match(readiness, /targetEnvironment === "staging"/)
  assert.match(readiness, /allowLoopback/)
  assert.match(readiness, /requireCronHealth: targetEnvironment !== "staging"/)
  assert.match(readiness, /signals: operational\.signals/)
  assert.match(proxy, /isOperationalProbePath\(request\.nextUrl\.pathname\)/)
  assert.match(proxy, /customerDevice\?\.isNew/)
  assert.match(proxy, /operationalProbe\s*\?\s*createResponse\(\)/)
})

test("global request-error capture omits raw request and exception detail", () => {
  const instrumentation = read("instrumentation.ts")

  assert.match(instrumentation, /Instrumentation\.onRequestError/)
  assert.match(instrumentation, /context\.routePath/)
  assert.match(instrumentation, /request\.method/)
  assert.match(instrumentation, /sanitizeTelemetryUrl\(context\.routePath\)/)
  assert.match(
    instrumentation,
    /headers: requestId \? \{ \[REQUEST_ID_HEADER\]: requestId \} : \{\}/
  )
  assert.doesNotMatch(instrumentation, /request\.path/)
  assert.doesNotMatch(instrumentation, /err\.message|error\.message|stack/)
})

test("scheduled production smoke validates both JSON probe contracts", () => {
  const workflow = read(".github", "workflows", "production-smoke.yml")
  const probeJob = workflow.match(/\n  probes:\n([\s\S]*?)\n  incident:\n/)?.[1]

  assert.match(workflow, /cron: "7\/15 \* \* \* \*"/)
  assert.match(workflow, /workflow_run:/)
  assert.match(workflow, /workflows: \["Production deployment"\]/)
  assert.match(workflow, /github\.event\.workflow_run\.head_sha/)
  assert.match(workflow, /Wait for the verified revision to reach production/)
  assert.match(workflow, /within five minutes/)
  const urls = workflowUrls(workflow)
  assert.equal(hasProductionProbeUrl(urls, "/api/health"), true)
  assert.equal(hasProductionProbeUrl(urls, "/api/readiness"), true)
  assert.match(workflow, /secrets\.PRODUCTION_MONITOR_SECRET/)
  assert.doesNotMatch(workflow, /GITHUB_SHA/)
  assert.match(workflow, /expected_revision:/)
  assert.match(workflow, /EXPECTED_REVISION:/)
  assert.match(workflow, /\.environment == "production"/)
  assert.match(workflow, /\.targetEnvironment == "production"/)
  assert.match(
    workflow,
    /\$revision == "" or \.revision == \(\$revision\[0:12\]\)/
  )
  assert.match(workflow, /\.service == "nabaperks"/)
  assert.match(workflow, /fromdateiso8601/)
  assert.match(workflow, /\.status == "ok" and \.scope == "liveness"/)
  assert.match(
    workflow,
    /\.status == "ready" and \.scope == "readiness" and \.checks\.database == "ok" and \.checks\.operational == "ok"/
  )
  assert.match(workflow, /check-production-probe-latency\.mjs/)
  assert.match(workflow, /PRODUCTION_SLO_CONFIG: config\/production-slos\.json/)
  assert.ok(probeJob, "production smoke keeps a dedicated probes job")
  assert.match(probeJob, /environment: Monitoring/)
  assert.match(probeJob, /secrets\.PRODUCTION_MONITOR_SECRET/)
  assert.match(workflow, /secrets\.PRODUCTION_ALERT_WEBHOOK_URL/)
  assert.match(workflow, /secrets\.PRODUCTION_ALERT_WEBHOOK_SECRET/)
  assert.match(workflow, /notify-production-alert\.mjs trigger/)
  assert.match(workflow, /notify-production-alert\.mjs resolve/)
  assert.match(
    workflow,
    /Check out alert dispatcher\n\s+if: \$\{\{ always\(\) \}\}/
  )
  assert.match(workflow, /context\.eventName !== "schedule"/)
  assert.match(workflow, /production-smoke-recovery-candidate/)
  assert.match(workflow, /steps\.incident\.outputs\.ready == 'true'/)

  const filters = smokeFilters(workflow)
  assert.equal(filters.length, 2)
  const [healthFilter, readinessFilter] = filters

  const common = {
    service: "nabaperks",
    revision: "abcdef123456",
    environment: "production",
    targetEnvironment: "production",
    time: "2026-07-13T09:26:44.418Z",
  }
  const health = { ...common, status: "ok", scope: "liveness" }
  const readiness = {
    ...common,
    status: "ready",
    scope: "readiness",
    checks: { database: "ok", operational: "ok" },
    signals: {
      notificationQueueAgeMinutes: 0,
      loyaltyInviteQueueAgeMinutes: 0,
      providerDeliveryFailureRate24h: 0,
      cronJobs: Array.from({ length: 6 }, () => ({})),
    },
  }

  assert.equal(runSmokeFilter(healthFilter, health).status, 0)
  assert.equal(runSmokeFilter(readinessFilter, readiness).status, 0)
  assert.equal(
    runSmokeFilter(healthFilter, { ...health, revision: "rollback1234" }, "")
      .status,
    0
  )
  assert.notEqual(
    runSmokeFilter(healthFilter, health, "wrongrev0000").status,
    0
  )
  assert.notEqual(
    runSmokeFilter(healthFilter, { ...health, time: "2026-99-99Tgarbage" })
      .status,
    0
  )
  assert.notEqual(
    runSmokeFilter(readinessFilter, { ...readiness, scope: "liveness" }).status,
    0
  )
  assert.notEqual(
    runSmokeFilter(readinessFilter, {
      ...readiness,
      checks: { ...readiness.checks, operational: "error" },
    }).status,
    0
  )
})

test("operational signals are data-free, durable and wired through every cron", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260723113000_production_operational_signals.sql"
  )
  const cronRoutes = new Map([
    ["notifications", ["notifications"]],
    ["privacy-retention", ["privacy-retention"]],
    ["merchant-digest", ["merchant-digest"]],
    ["birthday-rewards", ["birthday-rewards"]],
    ["referral-bonus-drain", ["referral-bonus-drain"]],
    ["loyalty-invite-drain", ["loyalty-invite-drain"]],
  ])

  assert.match(
    migration,
    /create table if not exists public\.operational_cron_runs/
  )
  assert.match(
    migration,
    /create or replace function public\.record_operational_cron_run/
  )
  assert.match(
    migration,
    /create or replace function public\.production_operational_signals/
  )
  assert.match(migration, /notificationQueueAgeMinutes/)
  assert.match(migration, /loyaltyInviteQueueAgeMinutes/)
  assert.match(migration, /providerDeliveryFailureRate24h/)
  assert.match(
    migration,
    /notification_deliveries_attempted_non_skipped_idx[\s\S]*attempted_at desc[\s\S]*where status <> 'skipped'/
  )
  assert.match(migration, /consecutiveFailures/)
  assert.match(
    migration,
    /revoke all on function public\.production_operational_signals\(\)[\s\S]*from public, anon, authenticated/
  )

  for (const [directory, [job]] of cronRoutes) {
    const route = read("app", "api", "cron", directory, "route.ts")
    assert.match(route, /runObservedCron/)
    assert.match(route, new RegExp(`job: "${job}"`))
  }
})
