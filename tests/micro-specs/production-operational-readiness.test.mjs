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
  return [...workflow.matchAll(/jq -e --arg revision "\$EXPECTED_REVISION" '([^']+)' <<<"\$body"/g)].map(
    ([, filter]) => filter
  )
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
  const proxy = read("proxy.ts")

  assert.match(health, /scope: "liveness"/)
  assert.match(health, /VERCEL_GIT_COMMIT_SHA/)
  assert.match(readiness, /status: ready \? "ready" : "not_ready"/)
  assert.match(readiness, /status: ready \? 200 : 503/)
  assert.match(readiness, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(proxy, /isOperationalProbePath\(request\.nextUrl\.pathname\)/)
  assert.match(proxy, /customerDevice\?\.isNew/)
  assert.match(proxy, /operationalProbe\s*\?\s*createResponse\(\)/)
})

test("global request-error capture omits raw request and exception detail", () => {
  const instrumentation = read("instrumentation.ts")

  assert.match(instrumentation, /Instrumentation\.onRequestError/)
  assert.match(instrumentation, /context\.routePath/)
  assert.match(instrumentation, /request\.method/)
  assert.doesNotMatch(instrumentation, /request\.path/)
  assert.doesNotMatch(instrumentation, /err\.message|error\.message|stack/)
})

test("scheduled production smoke validates both JSON probe contracts", () => {
  const workflow = read(".github", "workflows", "production-smoke.yml")

  assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/)
  const urls = workflowUrls(workflow)
  assert.equal(hasProductionProbeUrl(urls, "/api/health"), true)
  assert.equal(hasProductionProbeUrl(urls, "/api/readiness"), true)
  assert.match(workflow, /secrets\.PRODUCTION_MONITOR_SECRET/)
  assert.doesNotMatch(workflow, /GITHUB_SHA/)
  assert.match(workflow, /expected_revision:/)
  assert.match(workflow, /EXPECTED_REVISION:/)
  assert.match(workflow, /\.environment == "production"/)
  assert.match(workflow, /\$revision == "" or \.revision == \(\$revision\[0:12\]\)/)
  assert.match(workflow, /\.service == "nabaperks"/)
  assert.match(workflow, /fromdateiso8601/)
  assert.match(workflow, /\.status == "ok" and \.scope == "liveness"/)
  assert.match(
    workflow,
    /\.status == "ready" and \.scope == "readiness" and \.checks\.database == "ok"/
  )

  const filters = smokeFilters(workflow)
  assert.equal(filters.length, 2)
  const [healthFilter, readinessFilter] = filters

  const common = {
    service: "nabaperks",
    revision: "abcdef123456",
    environment: "production",
    time: "2026-07-13T09:26:44.418Z",
  }
  const health = { ...common, status: "ok", scope: "liveness" }
  const readiness = {
    ...common,
    status: "ready",
    scope: "readiness",
    checks: { database: "ok" },
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
    runSmokeFilter(healthFilter, { ...health, time: "2026-99-99Tgarbage" }).status,
    0
  )
  assert.notEqual(
    runSmokeFilter(readinessFilter, { ...readiness, scope: "liveness" }).status,
    0
  )
})
