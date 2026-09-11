import assert from "node:assert/strict"
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs"
import { join, resolve, basename } from "node:path"
import { pathToFileURL } from "node:url"
import { inventoryFromPlaywright } from "./browser-parity.mjs"
import { expectedIdentity, validatePlan } from "./impact-plan-contract.mjs"
import {
  selectedPages,
  BROWSER_PROJECTS,
  VISUAL_PROJECTS,
} from "./run-targeted-checks.mjs"
import {
  browserPolicy,
  compareAffectedOutcomes,
} from "./impact-browser-evidence.mjs"
import { browserConfiguration } from "./browser-configuration.mjs"
import { verifyQualificationScope } from "./impact-qualification-scope.mjs"
import { candidateBrowserEnvironment } from "./impact-browser-environment.mjs"
import { verifyDocumentationEvidence } from "./documentation-evidence.mjs"

function filesUnder(root) {
  const paths = []
  function visit(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      assert.ok(!entry.isSymbolicLink(), "Evidence must not contain symlinks")
      const target = join(path, entry.name)
      if (entry.isDirectory()) visit(target)
      else if (entry.isFile()) paths.push(target)
    }
  }
  visit(root)
  assert.ok(paths.length < 10_000, "Evidence exceeds the comparison bound")
  return paths
}

export function readFullReports(root, tier) {
  const files = filesUnder(root).filter((path) =>
    tier === "e2e"
      ? path.split(/[\\/]/).includes("runtime") &&
        /^\d+-of-32\.json$/.test(basename(path))
      : basename(path) === `full-${tier}.json`
  )
  assert.equal(
    files.length,
    tier === "e2e" ? 128 : 8,
    "Full tier reports are missing or duplicated"
  )
  const tests = []
  let policy
  let configuration
  for (const path of files) {
    const report = JSON.parse(readFileSync(path, "utf8"))
    const current = browserPolicy(report)
    if (policy)
      assert.deepEqual(
        current,
        policy,
        "Full tier execution policy differs between reports"
      )
    policy = current
    const resolved = browserConfiguration(report)
    if (configuration)
      assert.deepEqual(
        resolved,
        configuration,
        "Full tier browser settings differ between reports"
      )
    configuration = resolved
    tests.push(...inventoryFromPlaywright(report))
  }
  return { tests, policy, configuration, reports: files.length }
}

export function compareTargetedEvidence(root, plan, needs, options) {
  assert.equal(plan.profile, "full", "Selection qualification needs a full run")
  assert.equal(plan.comparisonRequired, true)
  const expectedJobs = [
    "selection",
    "e2e",
    "a11y",
    "visual",
    "documentation",
    "targeted-browser",
    "targeted-visual",
  ]
  assert.deepEqual(Object.keys(needs).sort(), expectedJobs.sort())
  for (const name of expectedJobs)
    assert.equal(needs[name]?.result, "success", `${name} did not pass`)
  assert.deepEqual(
    JSON.parse(needs.selection.outputs.plan),
    plan,
    "Comparison uses a different selection plan"
  )
  verifyQualificationScope(plan, options)
  const browserEnvironment = candidateBrowserEnvironment(
    plan.identity.candidateSha,
    options
  )
  const documentation = verifyDocumentationEvidence(
    JSON.parse(
      readFileSync(join(root, "documentation", "documentation.json"), "utf8")
    ),
    plan,
    options
  )
  const full = Object.fromEntries(
    ["e2e", "a11y", "visual"].map((tier) => [
      tier,
      readFullReports(join(root, `full-${tier}`), tier),
    ])
  )
  const manifests = filesUnder(join(root, "targeted"))
    .filter((path) => basename(path) === "selection.json")
    .map((path) => JSON.parse(readFileSync(path, "utf8")))
  const expectedPairs = [
    ...BROWSER_PROJECTS.map((project) => `browser/${project}`),
    ...VISUAL_PROJECTS.map((project) => `visual/${project}`),
  ].sort()
  assert.deepEqual(
    manifests.map((entry) => `${entry.suite}/${entry.project}`).sort(),
    expectedPairs,
    "Every targeted browser and visual project must be present once"
  )
  const results = []
  for (const manifest of manifests) {
    assert.equal(manifest.schema, "nabaperks.targeted-browser.v1")
    assert.deepEqual(
      manifest.identity,
      plan.identity,
      "Targeted evidence names another revision"
    )
    assert.deepEqual(
      manifest.pages,
      selectedPages(plan),
      "Targeted page coverage differs from the policy"
    )
    assert.deepEqual(
      manifest.browserEnvironment,
      browserEnvironment,
      "Targeted browser environment differs from candidate workflow data"
    )
    assert.equal(manifest.platform, "linux")
    assert.equal(
      manifest.architecture,
      "x64",
      "Visual qualification requires the canonical hosted architecture"
    )
    assert.equal(manifest.tests.length, selectedPages(plan).length)
    assert.equal(manifest.executions.length, 2)
    for (const [index, execution] of manifest.executions.entries()) {
      assert.equal(execution.listOnly, index === 0)
      assert.equal(execution.status, 0)
      assert.equal(execution.signal, null)
      assert.equal(execution.cleanupVerified, true)
      assert.equal(execution.unexpectedSurvivors, false)
    }
    const tier = manifest.suite === "browser" ? full.e2e : full.visual
    assert.deepEqual(
      manifest.browserPolicy,
      tier.policy,
      "Targeted and full execution policies differ"
    )
    assert.deepEqual(
      manifest.browserConfiguration,
      tier.configuration,
      "Targeted and full browser settings differ"
    )
    const result = compareAffectedOutcomes(tier.tests, manifest.tests)
    if (
      manifest.suite === "browser" &&
      VISUAL_PROJECTS.includes(manifest.project)
    ) {
      assert.deepEqual(manifest.browserPolicy, full.a11y.policy)
      assert.deepEqual(manifest.browserConfiguration, full.a11y.configuration)
      compareAffectedOutcomes(full.a11y.tests, manifest.tests)
    }
    results.push({
      suite: manifest.suite,
      project: manifest.project,
      ...result,
    })
  }
  return {
    schema: "nabaperks.ci-selection-comparison.v1",
    identity: plan.identity,
    qualification: "passed",
    pages: selectedPages(plan),
    browserEnvironment,
    documentation,
    results,
    fullReports: Object.fromEntries(
      Object.entries(full).map(([tier, value]) => [tier, value.reports])
    ),
    limitations:
      "Outcome parity on these reviewed pages; not proof for unqualified files or future policy changes.",
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    assert.equal(process.argv.length, 3)
    const root = resolve(process.argv[2])
    const plan = validatePlan(
      JSON.parse(process.env.CI_IMPACT_PLAN ?? "null"),
      expectedIdentity(process.env)
    )
    const result = compareTargetedEvidence(
      root,
      plan,
      JSON.parse(process.env.CI_COMPARISON_NEEDS ?? "null"),
      { cwd: process.env.CI_COMPARISON_CANDIDATE_TREE }
    )
    writeFileSync(
      join(root, "selection-comparison.json"),
      JSON.stringify(result, null, 2) + "\n"
    )
    console.log(JSON.stringify(result, null, 2))
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `### Targeted/full comparison\n\nAll ${result.results.length} browser/project combinations matched their full-run test identities and outcomes on the same candidate.\n\n${result.limitations}\n`
      )
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
