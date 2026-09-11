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
import {
  captureBrowserConfiguration,
  browserConfiguration,
} from "../../scripts/ci/browser-configuration.mjs"
import { compareTargetedEvidence } from "../../scripts/ci/compare-targeted-evidence.mjs"
import { browserPolicy } from "../../scripts/ci/impact-browser-evidence.mjs"
import { inventoryFromPlaywright } from "../../scripts/ci/browser-parity.mjs"
import { digest, git } from "../../scripts/ci/impact-git.mjs"
import { candidateBrowserEnvironment } from "../../scripts/ci/impact-browser-environment.mjs"
import { DOCUMENTATION_CASES } from "../../scripts/ci/documentation-evidence-contract.mjs"
import { fullPlan } from "../../scripts/ci/impact-plan-contract.mjs"
import {
  BROWSER_PROJECTS,
  VISUAL_PROJECTS,
  selectedPages,
} from "../../scripts/ci/impact-qualification-scope.mjs"

const image =
  "mcr.microsoft.com/playwright:v1.62.1-noble@sha256:" + "a".repeat(64)
const workflow =
  "jobs:\n" +
  ["e2e", "a11y", "targeted-browser", "visual", "targeted-visual"]
    .map(
      (name) =>
        `  ${name}:\n    runs-on: ubuntu-latest\n` +
        (name.includes("visual")
          ? ""
          : `    container:\n      image: ${image}\n      options: --init --ipc=host --user 1001\n`)
    )
    .join("")

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
      path.endsWith("ci.yml")
        ? workflow
        : readFileSync(new URL(`../../${path}`, import.meta.url))
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
    corpus: {
      digest: digest(DOCUMENTATION_CASES),
      cases: DOCUMENTATION_CASES.map(({ id, passes }) => ({ id, passes })),
    },
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
  const docsPath = join(root, "documentation/documentation.json")
  const documentation = JSON.parse(readFileSync(docsPath, "utf8"))
  write(docsPath, { ...documentation, corpus: undefined })
  assert.throws(
    () => compareTargetedEvidence(root, plan, needs, options),
    /missing, changed or failed/
  )
  write(docsPath, {
    ...documentation,
    files: [{ path: "README.md", blob: "a".repeat(40) }],
  })
  assert.throws(
    () => compareTargetedEvidence(root, plan, needs, options),
    /candidate file\/blob inventory/
  )
  write(docsPath, documentation)
  const { path, manifest } = files[0]
  write(path, {
    ...manifest,
    browserEnvironment: { ...environment, workflowDigest: "a".repeat(64) },
  })
  assert.throws(
    () => compareTargetedEvidence(root, plan, needs, options),
    /candidate workflow data/
  )
  write(path, manifest)
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
