import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { assertBrowserMemoryBudget } from "../../ops/local-ci/core/browser-budget.mjs"
import { loadProfile } from "../../ops/local-ci/core/profiles.mjs"
import { lanesFit } from "../../ops/local-ci/core/lane-scheduler.mjs"
import { assertResourceBudgets } from "../../ops/local-ci/agent/container.mjs"
import { limaRollback } from "../support/local-ci-contracts.mjs"

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
const contract = JSON.parse(read("config/local-ci-contract.json"))
const profile = loadProfile("main", contract, read)
const browser = profile.lanes.find(
  (lane) => lane.id === "e2e-mobile-safari-odd"
)

test("all browser profiles reserve memory beyond old space inside the unchanged lane limit", () => {
  assert.deepEqual(
    {
      oldSpace: contract.browserMemory.oldSpaceMb,
      browser: contract.browserMemory.browserReserveMb,
      native: contract.browserMemory.nativeAndToolsReserveMb,
    },
    { oldSpace: 4096, browser: 1536, native: 2560 }
  )
  for (const name of ["pr", "main", "nightly"]) {
    const p = loadProfile(name, contract, read)
    for (const lane of p.lanes.filter((l) => /^(e2e|a11y)-/.test(l.id))) {
      assert.equal(lane.resources.memoryGb, 8)
      assert.doesNotThrow(() => assertBrowserMemoryBudget(lane, contract))
    }
  }
})

test("heap-only or container-only edits cannot consume the reviewed headroom silently", () => {
  const heapDrift = structuredClone(browser)
  heapDrift.env.PLAYWRIGHT_NODE_HEAP_MB = "6144"
  assert.throws(
    () => assertBrowserMemoryBudget(heapDrift, contract),
    /heap differs/
  )
  const smaller = structuredClone(browser)
  smaller.resources.memoryGb = 7
  assert.throws(() => assertBrowserMemoryBudget(smaller, contract), /headroom/)
  for (const value of [0, -1, NaN, "1536", undefined]) {
    const invalid = structuredClone(contract)
    invalid.browserMemory.browserReserveMb = value
    assert.throws(
      () => assertBrowserMemoryBudget(browser, invalid),
      /positive integer/
    )
  }
})

test("browser workers, Desktop's reserve and other stacks' memory fit as one admission budget", () => {
  assertResourceBudgets(contract)
  const browsers = profile.lanes.filter((l) => l.id.startsWith("e2e-"))
  assert.equal(contract.runtime.kind, "docker-desktop")
  assert.equal(contract.container.memoryGb, 40)
  assert.equal(contract.runtime.reserveMemoryGb, 4)
  assert.equal(contract.runtime.externalMemoryFloorGb, 6)
  assert.equal(contract.runtime.memoryGb, 50)
  // Five 8 GiB browser lanes fill the 40 GiB job budget beside the reserve
  // and the floor; a sixth does not fit.
  assert.equal(lanesFit(browsers.slice(0, 5), contract), true)
  assert.equal(lanesFit(browsers.slice(0, 6), contract), false)
  // Other worktrees' containers holding 20 GiB leave room for three.
  assert.equal(
    lanesFit(browsers.slice(0, 3), contract, { externalMemoryGb: 20 }),
    true
  )
  assert.equal(
    lanesFit(browsers.slice(0, 4), contract, { externalMemoryGb: 20 }),
    false
  )
  // A low or failed sample never admits more than the floor allows.
  assert.equal(
    lanesFit(browsers.slice(0, 6), contract, { externalMemoryGb: 0 }),
    false
  )
  const overcommitted = structuredClone(contract)
  overcommitted.runtime.reserveMemoryGb = 5
  assert.throws(() => assertResourceBudgets(overcommitted), /reserves/)
})

test("the Lima rollback keeps its daemon and VM reserve arithmetic", () => {
  const lima = limaRollback(contract)
  assertResourceBudgets(lima)
  const browsers = profile.lanes.filter((l) => l.id.startsWith("e2e-"))
  const db = profile.lanes.find((l) => l.id === "db")
  assert.equal(lanesFit(browsers.slice(0, 4), lima), true)
  assert.equal(lanesFit([...browsers.slice(0, 3), db], lima), true)
  assert.equal(lanesFit([...browsers.slice(0, 4), db], lima), false)
  const overcommitted = structuredClone(lima)
  overcommitted.container.daemon.memoryGb = 7
  assert.throws(() => assertResourceBudgets(overcommitted), /reserves/)
  assert.equal(lanesFit([...browsers.slice(0, 3), db], overcommitted), false)
})
