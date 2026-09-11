import assert from "node:assert/strict"
import { test } from "node:test"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
import {
  captureBrowserConfiguration,
  browserConfiguration,
} from "../../scripts/ci/browser-configuration.mjs"
import { compareTargetedEvidence } from "../../scripts/ci/compare-targeted-evidence.mjs"
import { browserPolicy } from "../../scripts/ci/impact-browser-evidence.mjs"
import { inventoryFromPlaywright } from "../../scripts/ci/browser-parity.mjs"
import { git } from "../../scripts/ci/impact-git.mjs"
import { candidateBrowserEnvironment } from "../../scripts/ci/impact-browser-environment.mjs"
import { qualifyDocumentation } from "../../scripts/ci/documentation-evidence.mjs"
import { fullPlan } from "../../scripts/ci/impact-plan-contract.mjs"
import {
  BROWSER_PROJECTS,
  VISUAL_PROJECTS,
  selectedPages,
} from "../../scripts/ci/run-targeted-checks.mjs"

const projects = [...BROWSER_PROJECTS]
const resolved = (patch = {}) => ({
  projects: projects.map((name) => ({
    name,
    use: {
      browserName: "chromium",
      viewport: { width: 1280, height: 720 },
      contextOptions: { reducedMotion: "reduce" },
      ...patch,
    },
  })),
})

test("resolved browser evidence includes all use options and rejects non-data settings", () => {
  const baseline = captureBrowserConfiguration(resolved())
  for (const patch of [
    { browserName: "webkit" },
    { viewport: null },
    { channel: "chromium" },
    { userAgent: "mobile device" },
    { deviceScaleFactor: 3 },
    { isMobile: true },
    { hasTouch: true },
    { contextOptions: { reducedMotion: "no-preference" } },
    { launchOptions: { args: ["--force-color-profile=srgb"] } },
    { locale: "fr-FR" },
    { colorScheme: "dark" },
  ])
    assert.notDeepEqual(captureBrowserConfiguration(resolved(patch)), baseline)
  const reordered = resolved()
  for (const project of reordered.projects)
    project.use.viewport = { height: 720, width: 1280 }
  assert.deepEqual(captureBrowserConfiguration(reordered), baseline)
  assert.throws(() =>
    captureBrowserConfiguration(resolved({ custom: () => true }))
  )
  assert.throws(() => browserConfiguration({ config: { projects } }), /missing/)
})

test("the real Playwright JSON reporter retains resolved settings on listing and execution", (t) => {
  const root = mkdtempSync(join(tmpdir(), "browser-configuration-reporter-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const require = createRequire(import.meta.url)
  const playwright = createRequire(require.resolve("@playwright/test")).resolve(
    "playwright"
  )
  const reporter = fileURLToPath(
    new URL(
      "../../scripts/ci/browser-configuration-reporter.mjs",
      import.meta.url
    )
  )
  writeFileSync(
    join(root, "sample.spec.js"),
    `const { test } = require(${JSON.stringify(require.resolve("@playwright/test"))}); test('configuration fixture', () => {});`
  )
  writeFileSync(
    join(root, "playwright.config.cjs"),
    `module.exports = {
    testDir: __dirname, workers: 1, forbidOnly: true, failOnFlakyTests: true,
    use: { extraHTTPHeaders: { authorization: 'private-fixture-value' } },
    projects: ${JSON.stringify(projects)}.map(name => ({ name, use: {
      browserName: 'chromium', viewport: { width: process.env.SELECTION_COMPARISON === 'true' ? 800 : 1280, height: 720 }
    }}))
  };`
  )
  const run = (id, list, comparison) => {
    const output = join(root, `${id}.json`)
    const result = spawnSync(
      process.execPath,
      [
        join(dirname(playwright), "cli.js"),
        "test",
        "--config",
        join(root, "playwright.config.cjs"),
        `--reporter=json,${reporter}`,
        ...(list ? ["--list"] : []),
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 30_000,
        env: {
          ...process.env,
          CI: "1",
          SELECTION_COMPARISON: comparison,
          PLAYWRIGHT_JSON_OUTPUT_NAME: output,
        },
      }
    )
    assert.equal(result.status, 0, result.stderr)
    const text = readFileSync(output, "utf8")
    assert.ok(!text.includes("private-fixture-value"))
    const report = JSON.parse(text)
    assert.ok(
      !Object.hasOwn(report.config.projects[0], "use"),
      "Playwright omits use from its ordinary JSON projection"
    )
    return browserConfiguration(report)
  }
  const listing = run("listed", true, "false")
  assert.deepEqual(run("runtime", false, "false"), listing)
  assert.notDeepEqual(run("changed-viewport", false, "true"), listing)
})

test("complete qualification rejects mismatched or missing browser configuration evidence", (t) => {
  const root = mkdtempSync(join(tmpdir(), "browser-configuration-comparison-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const path of [
    "config/ci-impact-policy.json",
    ".github/workflows/ci.yml",
  ]) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(
      join(root, path),
      readFileSync(new URL(`../../${path}`, import.meta.url))
    )
  }
  const options = { cwd: root }
  git(["init", "-q"], options)
  git(["add", "--all"], options)
  git(
    [
      "-c",
      "user.name=Fixture",
      "-c",
      "user.email=ci@example.test",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-qm",
      "fixture",
    ],
    options
  )
  const sha = git(["rev-parse", "HEAD"], options).trim()
  const environment = candidateBrowserEnvironment(sha, options)
  const configuration = captureBrowserConfiguration(resolved())
  const config = {
    workers: 1,
    forbidOnly: true,
    failOnFlakyTests: true,
    version: "1.62.1",
    updateSnapshots: "missing",
    webServer: { reuseExistingServer: false, command: "fixture-server" },
    projects: projects.map((name) => ({
      name,
      retries: 1,
      repeatEach: 1,
      timeout: 180_000,
      testMatch: ["**/*.spec.ts"],
      testIgnore: [],
    })),
    metadata: { nabaperksBrowserConfiguration: configuration },
  }
  const plan = fullPlan(
    {
      repository: "lapeninns/nabaperks",
      event: "pull_request",
      headSha: sha,
      baseSha: sha,
      candidateSha: sha,
    },
    "Configuration fixture",
    true
  )
  const report = (project, names) => ({
    config,
    suites: [
      {
        title: "fixture",
        specs: names.map((title) => ({
          title,
          file: "fixture.spec.ts",
          tests: [
            {
              projectName: project,
              status: "expected",
              results: [{ status: "passed" }],
            },
          ],
        })),
      },
    ],
  })
  const write = (path, value) => {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(value))
  }
  const pageNames = selectedPages(plan).map(({ route }) => route)
  for (const [tier, tierProjects, count] of [
    ["e2e", projects, 32],
    ["a11y", VISUAL_PROJECTS, 4],
    ["visual", VISUAL_PROJECTS, 4],
  ])
    for (const project of tierProjects)
      for (let i = 1; i <= count; i++)
        write(
          join(
            root,
            `full-${tier}`,
            project,
            String(i),
            tier === "e2e" ? `runtime/${i}-of-32.json` : `full-${tier}.json`
          ),
          report(project, i === 1 ? pageNames : [`filler-${i}`])
        )
  const files = []
  for (const [suite, members] of [
    ["browser", projects],
    ["visual", VISUAL_PROJECTS],
  ])
    for (const project of members) {
      const manifest = {
        schema: "nabaperks.targeted-browser.v1",
        identity: plan.identity,
        suite,
        project,
        pages: selectedPages(plan),
        platform: "linux",
        architecture: "x64",
        browserPolicy: browserPolicy({ config }),
        browserConfiguration: configuration,
        browserEnvironment: environment,
        tests: inventoryFromPlaywright(report(project, pageNames)),
        executions: [true, false].map((listOnly) => ({
          listOnly,
          status: 0,
          signal: null,
          cleanupVerified: true,
          unexpectedSurvivors: false,
        })),
      }
      const path = join(root, "targeted", suite, project, "selection.json")
      write(path, manifest)
      files.push({ path, manifest })
    }
  write(join(root, "documentation/documentation.json"), {
    schema: "nabaperks.documentation-evidence.v1",
    identity: plan.identity,
    files: [],
    checks: { formatting: "not-required", localLinks: "not-required" },
    corpus: qualifyDocumentation(),
  })
  const needs = Object.fromEntries(
    [
      "selection",
      "e2e",
      "a11y",
      "visual",
      "documentation",
      "targeted-browser",
      "targeted-visual",
    ].map((name) => [name, { result: "success" }])
  )
  needs.selection.outputs = { plan: JSON.stringify(plan) }
  assert.equal(
    compareTargetedEvidence(root, plan, needs, options).qualification,
    "passed"
  )
  const { path, manifest } = files[0]
  write(path, {
    ...manifest,
    browserConfiguration: captureBrowserConfiguration(
      resolved({ viewport: null })
    ),
  })
  assert.throws(
    () => compareTargetedEvidence(root, plan, needs, options),
    /browser settings differ/
  )
  write(path, { ...manifest, browserConfiguration: undefined })
  assert.throws(
    () => compareTargetedEvidence(root, plan, needs, options),
    /browser settings differ/
  )
  write(path, manifest)
  write(join(root, "full-a11y", "chromium", "2", "full-a11y.json"), {
    ...report("chromium", ["filler-2"]),
    config: { ...config, metadata: {} },
  })
  assert.throws(
    () => compareTargetedEvidence(root, plan, needs, options),
    /configuration is missing/
  )
})
