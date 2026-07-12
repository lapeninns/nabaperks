import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const root = process.cwd()

function read(...parts) {
  return readFileSync(join(root, ...parts), "utf8")
}

test("production exposes separate versioned liveness and dependency readiness", () => {
  const health = read("app", "api", "health", "route.ts")
  const readiness = read("app", "api", "readiness", "route.ts")

  assert.match(health, /scope: "liveness"/)
  assert.match(health, /VERCEL_GIT_COMMIT_SHA/)
  assert.match(readiness, /status: ready \? "ready" : "not_ready"/)
  assert.match(readiness, /status: ready \? 200 : 503/)
  assert.match(readiness, /SUPABASE_SERVICE_ROLE_KEY/)
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
  assert.match(workflow, /https:\/\/nabaperks\.com\/api\/health/)
  assert.match(workflow, /https:\/\/nabaperks\.com\/api\/readiness/)
  assert.match(workflow, /jq -e '.status == "ok" and .scope == "liveness"'/)
  assert.match(
    workflow,
    /jq -e '.status == "ready" and .checks.database == "ok"'/
  )
})
