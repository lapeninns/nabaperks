import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given a due backlog When the worker runs Then it drains batches via the drain-plan decisions", () => {
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")

  assert.match(
    worker,
    /from "@\/lib\/notifications\/drain-plan"/,
    "the worker must delegate budget decisions to drain-plan"
  )
  assert.match(worker, /resolveDrainOptions\(/)
  assert.match(worker, /shouldContinueDraining\(/)
  assert.match(worker, /shouldProcessNextEvent\(/)
  assert.match(
    worker,
    /while\s*\(/,
    "the worker must loop over claim batches instead of claiming once"
  )
  assert.match(
    worker,
    /rpc\(\s*"claim_due_notification_events"/,
    "batches must still come from the atomic claim RPC"
  )
  assert.match(
    worker,
    /Math\.min\(\s*options\.batchSize,\s*options\.maxEvents - result\.processed\s*\)/,
    "each claim is clamped to the remaining event budget"
  )
  assert.match(
    worker,
    /releaseClaimedNotificationEvents\(supabase, events\.slice\(index\)\)/,
    "unprocessed claimed events are returned to queued when the per-event budget is spent"
  )
})

test("Given the 15-minute cron tick When it invokes the worker Then it passes the production drain budget", () => {
  const route = readProjectFile(
    "app",
    "api",
    "cron",
    "notifications",
    "route.ts"
  )

  assert.match(
    route,
    /batchSize:\s*100/,
    "the route must claim 100-event batches"
  )
  assert.match(
    route,
    /maxEvents:\s*500/,
    "the route must budget 500 events per invocation"
  )
  assert.match(
    route,
    /timeBudgetMs:\s*240[_]?000/,
    "the route must stop claiming after the 240s soft budget"
  )
  assert.match(
    route,
    /export const maxDuration = 300/,
    "the route must extend its function timeout to fit the drain budget"
  )
})

test("Given producers and the drain loop When one invocation runs Then producers run exactly once", () => {
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")

  const produceCalls =
    worker.match(/await produceDueNotificationEvents\(/g) ?? []
  assert.equal(
    produceCalls.length,
    1,
    "produceDueNotificationEvents must be awaited exactly once per invocation, outside the claim loop"
  )
})
