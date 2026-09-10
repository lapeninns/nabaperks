import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { assertBrowserMemoryBudget } from "../../ops/local-ci/core/browser-budget.mjs"
import { loadProfile } from "../../ops/local-ci/core/profiles.mjs"
import { lanesFit } from "../../ops/local-ci/core/lane-scheduler.mjs"
import { assertResourceBudgets } from "../../ops/local-ci/agent/container.mjs"

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")
const contract = JSON.parse(read("config/local-ci-contract.json"))
const profile = loadProfile("main", contract, read)
const browser = profile.lanes.find((lane) => lane.id === "e2e-mobile-safari")

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

test("browser workers, daemon and VM reserve fit as one admission budget", () => {
  assertResourceBudgets(contract)
  const browsers = profile.lanes.filter((l) => l.id.startsWith("e2e-"))
  const db = profile.lanes.find((l) => l.id === "db")
  assert.equal(contract.container.memoryGb, 32)
  assert.equal(contract.container.daemon.memoryGb, 6)
  assert.equal(contract.vm.reserveMemoryGb, 2)
  assert.equal(contract.vm.memoryGb, 40)
  assert.equal(lanesFit(browsers, contract), true)
  assert.equal(lanesFit([...browsers.slice(0, 3), db], contract), true)
  assert.equal(lanesFit([...browsers, db], contract), false)
  const overcommitted = structuredClone(contract)
  overcommitted.container.daemon.memoryGb = 7
  assert.throws(() => assertResourceBudgets(overcommitted), /reserves/)
  assert.equal(lanesFit([...browsers.slice(0, 3), db], overcommitted), false)
})
