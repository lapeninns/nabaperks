import assert from "node:assert/strict"
import { test } from "node:test"
import {
  compareAffectedOutcomes,
  browserPolicy,
} from "../../scripts/ci/impact-browser-evidence.mjs"
import {
  targetedArguments,
  validateTargetedRuntime,
} from "../../scripts/ci/run-targeted-checks.mjs"
import { fullPlan } from "../../scripts/ci/impact-plan-contract.mjs"
import { needsSelectionComparison } from "../../scripts/ci/plan-checks.mjs"

const record = {
  project: "chromium",
  file: "helpers/a11y-sweep.ts",
  title: ["a11y.desktop.spec.ts", "no axe violations: /about"],
  status: "passed",
  retries: 0,
  flaky: false,
  skipReason: "",
}

test("targeted outcomes must occur exactly once in successful full execution", () => {
  assert.equal(compareAffectedOutcomes([record], [record]).matched, 1)
  for (const patch of [
    { status: "skipped" },
    { status: "failed" },
    { status: undefined },
    { retries: 1 },
    { flaky: true },
    { skipReason: "disabled" },
    { project: "mobile-safari" },
  ]) {
    assert.throws(() =>
      compareAffectedOutcomes([record], [{ ...record, ...patch }])
    )
    assert.throws(() =>
      compareAffectedOutcomes([{ ...record, ...patch }], [record])
    )
  }
  assert.throws(() => compareAffectedOutcomes([], [record]))
  assert.throws(() => compareAffectedOutcomes([record], []))
  assert.throws(() => compareAffectedOutcomes([record, record], [record]))
  assert.throws(() => compareAffectedOutcomes([record], [record, record]))
  validateTargetedRuntime([record], [record], 1)
  assert.throws(() => validateTargetedRuntime([record], [record], 2))
  assert.throws(() =>
    validateTargetedRuntime([record], [{ ...record, title: ["other test"] }], 1)
  )
})

test("qualification preserves all reviewed project policies and fresh servers", () => {
  const config = {
    workers: 1,
    forbidOnly: true,
    failOnFlakyTests: true,
    version: "1.62.1",
    webServer: { reuseExistingServer: false, command: "fixture-server" },
    projects: [
      "chromium",
      "mobile-safari",
      "desktop-firefox",
      "desktop-safari",
    ].map((name) => ({ name, retries: 1, repeatEach: 1 })),
  }
  assert.equal(browserPolicy({ config }).workers, 1)
  for (const patch of [
    { workers: 2 },
    { failOnFlakyTests: false },
    { forbidOnly: false },
    { webServer: { reuseExistingServer: true } },
    { projects: [] },
  ])
    assert.throws(() => browserPolicy({ config: { ...config, ...patch } }))
})

test("qualified page selection keeps existing test identities and unqualified policy changes require comparison", () => {
  const plan = fullPlan({}, "Bootstrap comparison", true)
  assert.match(targetedArguments(plan, "browser", "mobile-safari")[0], /a11y/)
  assert.match(targetedArguments(plan, "browser", "chromium")[0], /desktop/)
  assert.match(
    targetedArguments(plan, "visual", "chromium").join(" "),
    /marketing-about.*marketing-faq.*marketing-how-it-works/
  )
  assert.throws(() => targetedArguments(plan, "visual", "desktop-firefox"))
  for (const path of [
    "scripts/ci/impact-documentation.mjs",
    "config/ci-workloads.json",
    "tests/e2e/helpers/a11y-sweep.ts",
    "scripts/ci/browser-workload.mjs",
    "playwright.config.ts",
    ".github/actions/playwright/action.yml",
  ])
    assert.equal(needsSelectionComparison(path), true, path)
  assert.equal(
    needsSelectionComparison("docs/operations/production-runbook.md"),
    false
  )
})
