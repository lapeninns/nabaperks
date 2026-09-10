import assert from "node:assert/strict"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"
import { parsers } from "prettier/plugins/markdown"
import { runBoundedCommand } from "./run-bounded-command.mjs"
import { inventoryFromPlaywright, compareInventory } from "./browser-parity.mjs"
import { impactPolicy, isDocumentationPath } from "./change-impact.mjs"
import { expectedIdentity, validatePlan } from "./impact-plan-contract.mjs"
import { git } from "./impact-git.mjs"
import { browserPolicy } from "./impact-browser-evidence.mjs"

export const BROWSER_PROJECTS = Object.freeze([
  "chromium",
  "mobile-safari",
  "desktop-firefox",
  "desktop-safari",
])
export const VISUAL_PROJECTS = Object.freeze(["chromium", "mobile-safari"])
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export function selectedPages(plan) {
  if (plan.profile === "public-pages") return plan.pages
  assert.equal(plan.profile, "full")
  assert.equal(
    plan.comparisonRequired,
    true,
    "Full runs only duplicate selected checks during policy qualification"
  )
  return Object.entries(impactPolicy.publicPages).map(([path, page]) => ({
    path,
    ...page,
  }))
}

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
        "--reporter=json",
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
    reports.push(inventoryFromPlaywright(report))
  }
  assert.deepEqual(
    policies[0],
    policies[1],
    "Browser policy changed between inventory and execution"
  )
  validateTargetedRuntime(reports[0], reports[1], selectedPages(plan).length)
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
  }
  writeFileSync(
    join(root, "selection.json"),
    JSON.stringify(evidence, null, 2) + "\n"
  )
  return evidence
}

function markdownLinkTargets(text) {
  // Use the same installed Markdown parser as the required formatter. This
  // handles destinations, escapes and block structure without regex gaps.
  const tree = parsers.markdown.parse(text)
  assert.equal(
    tree?.type,
    "root",
    "Markdown parser returned an unsupported tree"
  )
  const nodes = [tree]
  const targets = []
  while (nodes.length) {
    const node = nodes.pop()
    if (["link", "image", "definition"].includes(node.type))
      targets.push(node.url)
    if (node.children) nodes.push(...node.children)
  }
  return targets
}

export function localMarkdownLinks(paths, { cwd = process.cwd() } = {}) {
  const missing = []
  for (const path of paths) {
    const text = readFileSync(resolve(cwd, path), "utf8")
    const targets = markdownLinkTargets(text)
    for (const destination of targets) {
      const target = destination.split("#")[0]
      if (
        !target ||
        /^[A-Za-z][A-Za-z0-9+.-]*:/.test(target) ||
        target.startsWith("/")
      )
        continue
      const decoded = decodeURIComponent(target)
      if (!existsSync(resolve(cwd, dirname(path), decoded)))
        missing.push(`${path}: ${target}`)
    }
  }
  assert.deepEqual(missing, [], "Documentation has missing local link targets")
  return { files: paths.length, missing }
}

export function runDocumentation(plan, { spawn = spawnSync } = {}) {
  assert.ok(
    plan.profile === "documentation" ||
      (plan.profile === "public-pages" &&
        plan.required.includes("documentation")) ||
      (plan.profile === "full" && plan.comparisonRequired)
  )
  const files = plan.changes
    .filter(
      (change) => change.status !== "D" && isDocumentationPath(change.path)
    )
    .map((change) => change.path)
  const commands = [
    // Public-page fast/quality jobs already run these shared checks. Its
    // documentation job adds only the changed-document formatting/link proof.
    ...(plan.profile === "public-pages"
      ? []
      : [
          ["pnpm", "secrets:check"],
          ["pnpm", "test:contracts"],
          ["pnpm", "docs:check"],
          ["pnpm", "agents:check"],
        ]),
    ...(files.length
      ? [["pnpm", "exec", "prettier", "--check", "--", ...files]]
      : []),
  ]
  for (const [command, ...args] of commands) {
    const result = spawn(command, args, { stdio: "inherit" })
    assert.ok(
      !result.error && !result.signal && result.status === 0,
      `Documentation check failed: ${command} ${args.join(" ")}`
    )
  }
  return localMarkdownLinks(files)
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
      console.log(JSON.stringify(runDocumentation(plan)))
    } else {
      assert.ok(output, "Targeted browser evidence path required")
      await runTargetedBrowser(plan, suite, project, output)
    }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
