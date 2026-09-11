import assert from "node:assert/strict"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { runBoundedCommand } from "./run-bounded-command.mjs"
import { inventoryFromPlaywright, compareInventory } from "./browser-parity.mjs"
import {
  selectedPages,
  BROWSER_PROJECTS,
  VISUAL_PROJECTS,
} from "./impact-qualification-scope.mjs"
export {
  selectedPages,
  BROWSER_PROJECTS,
  VISUAL_PROJECTS,
} from "./impact-qualification-scope.mjs"
import { candidateBrowserEnvironment } from "./impact-browser-environment.mjs"
import { runDocumentationEvidence } from "./documentation-evidence.mjs"
export {
  runDocumentation,
  localMarkdownLinks,
} from "./documentation-checks.mjs"
import { expectedIdentity, validatePlan } from "./impact-plan-contract.mjs"
import { git } from "./impact-git.mjs"
import { browserPolicy } from "./impact-browser-evidence.mjs"
import { browserConfiguration } from "./browser-configuration.mjs"

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function targetedArguments(plan, suite, project) {
  const pages = selectedPages(plan)
  assert.ok(pages.length > 0, "Targeted browser selection must not be empty")
  if (suite === "browser") {
    assert.ok(BROWSER_PROJECTS.includes(project), "Unknown browser project")
    return [
      project === "mobile-safari"
        ? "tests/e2e/a11y\\.spec\\.ts$"
        : "tests/e2e/a11y\\.desktop\\.spec\\.ts$",
      `--project=${project}`,
      "--grep",
      `no axe violations: (${pages.map((page) => escapeRegex(page.route)).join("|")})$`,
      "--grep-invert",
      "@visual",
    ]
  }
  assert.equal(suite, "visual", "Unknown targeted suite")
  assert.ok(
    VISUAL_PROJECTS.includes(project),
    "Visual baselines remain on their two hosted projects"
  )
  return [
    "tests/e2e/visual\\.spec\\.ts$",
    `--project=${project}`,
    "--grep",
    `@visual.*Given (${pages.map((page) => escapeRegex(page.visualName)).join("|")}) When it renders`,
  ]
}

export function validateTargetedRuntime(listed, runtime, expectedCount) {
  assert.equal(
    listed.length,
    expectedCount,
    "Targeted inventory differs from the declared page coverage"
  )
  assert.equal(
    compareInventory(listed, runtime).equivalent,
    true,
    "Targeted execution differs from its inventory"
  )
  for (const record of runtime) {
    assert.equal(record.status, "passed", "A required page check did not pass")
    assert.equal(
      record.retries,
      0,
      "A retried page check cannot qualify selection"
    )
    assert.equal(
      record.flaky,
      false,
      "A flaky page check cannot qualify selection"
    )
  }
}

export async function runTargetedBrowser(
  plan,
  suite,
  project,
  output,
  { run = runBoundedCommand, env = process.env } = {}
) {
  assert.ok(
    !existsSync(".env") && !existsSync(".env.local"),
    "Targeted CI requires non-secret fixtures"
  )
  assert.ok(
    !env.PLAYWRIGHT_NEXT_DIST_DIR &&
      env.PLAYWRIGHT_REUSE_EXISTING_SERVER !== "1",
    "Fresh browser servers are required"
  )
  const root = resolve(output)
  assert.ok(!existsSync(root), "Targeted evidence directory must be new")
  mkdirSync(root, { recursive: true })
  const args = targetedArguments(plan, suite, project)
  const reports = []
  const policies = []
  const configurations = []
  const executions = []
  for (const listOnly of [true, false]) {
    const reportPath = join(root, listOnly ? "listed.json" : "runtime.json")
    const started = Date.now()
    const result = await run(
      "pnpm",
      [
        "exec",
        "node",
        "scripts/run-playwright.mjs",
        ...args,
        "--reporter=json,./scripts/ci/browser-configuration-reporter.mjs",
        `--output=${join(root, "results")}`,
        ...(listOnly ? ["--list"] : []),
      ],
      {
        env: {
          ...env,
          CI: "1",
          PLAYWRIGHT_WORKERS: "1",
          PLAYWRIGHT_REGULAR_CHROMIUM: suite === "browser" ? "1" : "",
          PLAYWRIGHT_JSON_OUTPUT_NAME: reportPath,
        },
        stdio: "inherit",
        timeout: 10 * 60_000,
      }
    )
    executions.push({
      listOnly,
      status: result.status,
      signal: result.signal ?? null,
      cleanupVerified: result.cleanupVerified === true,
      unexpectedSurvivors: result.unexpectedSurvivors ?? null,
      durationMs: Date.now() - started,
    })
    writeFileSync(
      join(root, "execution.json"),
      JSON.stringify(executions, null, 2) + "\n"
    )
    assert.ok(
      !result.error &&
        !result.signal &&
        result.status === 0 &&
        result.cleanupVerified === true &&
        !result.unexpectedSurvivors,
      "Targeted browser execution or teardown failed"
    )
    const report = JSON.parse(readFileSync(reportPath, "utf8"))
    policies.push(browserPolicy(report))
    configurations.push(browserConfiguration(report))
    reports.push(inventoryFromPlaywright(report))
  }
  assert.deepEqual(
    policies[0],
    policies[1],
    "Browser policy changed between inventory and execution"
  )
  validateTargetedRuntime(reports[0], reports[1], selectedPages(plan).length)
  assert.deepEqual(
    configurations[0],
    configurations[1],
    "Resolved browser settings changed between inventory and execution"
  )
  const evidence = {
    schema: "nabaperks.targeted-browser.v1",
    identity: plan.identity,
    suite,
    project,
    pages: selectedPages(plan),
    tests: reports[1],
    executions,
    platform: process.platform,
    architecture: process.arch,
    browserPolicy: policies[1],
    browserConfiguration: configurations[1],
    browserEnvironment: candidateBrowserEnvironment(plan.identity.candidateSha),
  }
  writeFileSync(
    join(root, "selection.json"),
    JSON.stringify(evidence, null, 2) + "\n"
  )
  return evidence
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const plan = validatePlan(
      JSON.parse(process.env.CI_IMPACT_PLAN ?? "null"),
      expectedIdentity(process.env)
    )
    assert.equal(
      git(["rev-parse", "HEAD"]).trim(),
      plan.identity.candidateSha,
      "Checks must execute the selected merge candidate"
    )
    const [suite, project, output, ...extra] = process.argv.slice(2)
    assert.equal(extra.length, 0)
    if (suite === "documentation") {
      assert.ok(!project && !output)
      console.log(JSON.stringify(runDocumentationEvidence(plan)))
    } else {
      assert.ok(output, "Targeted browser evidence path required")
      await runTargetedBrowser(plan, suite, project, output)
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
