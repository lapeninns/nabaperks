import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  compareAffectedOutcomes,
  browserPolicy,
} from "../../scripts/ci/impact-browser-evidence.mjs"
import {
  targetedArguments,
  validateTargetedRuntime,
  runDocumentation,
  localMarkdownLinks,
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

test("mixed page and documentation validation adds formatting and links without duplicating its baseline", () => {
  const commands = []
  const path = "docs/operations/change-aware-ci.md"
  const result = runDocumentation(
    {
      profile: "public-pages",
      required: ["documentation"],
      changes: [{ path, status: "M" }],
    },
    {
      spawn(command, args) {
        commands.push([command, ...args])
        return { status: 0 }
      },
    }
  )
  assert.deepEqual(commands, [
    ["pnpm", "exec", "prettier", "--check", "--", path],
  ])
  assert.deepEqual(result, { files: 1, missing: [] })
  assert.throws(() =>
    runDocumentation({ profile: "public-pages", required: [], changes: [] })
  )
})

test("local link validation rejects missing inline and reference targets", () => {
  const cwd = mkdtempSync(join(tmpdir(), "nabaperks-markdown-links-"))
  try {
    for (const markdown of [
      "Read [the runbook](missing.md).",
      "Read [the runbook](<missing file.md>).",
      'Read [the runbook](<missing file.md> "Incident procedure").',
      "Read [the runbook](missing(file).md).",
      "Read [the runbook](missing\\(file\\).md).",
      "> [incident]: missing.md",
      "![Runbook diagram](<missing image.png>)",
      "Read [the runbook][incident].\n\n[incident]: missing.md",
      "Read [incident][].\n\n[incident]: missing.md",
      "Read [incident].\n\n[incident]: missing.md",
      '[incident]: missing.md "Incident procedure"',
      "[incident]: <missing file.md>",
      "[incident]:\n  missing.md#response",
    ]) {
      writeFileSync(join(cwd, "guide.md"), markdown)
      assert.throws(
        () => localMarkdownLinks(["guide.md"], { cwd }),
        /Documentation has missing local link targets/,
        markdown
      )
    }
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test("reference targets support local files, fragments, titles and external URLs", () => {
  const cwd = mkdtempSync(join(tmpdir(), "nabaperks-markdown-links-"))
  try {
    writeFileSync(join(cwd, "incident.md"), "# Incident")
    writeFileSync(join(cwd, "incident procedure.md"), "# Procedure")
    writeFileSync(
      join(cwd, "guide.md"),
      [
        "Read [the runbook](incident.md#response).",
        "Read [the procedure](<incident procedure.md>).",
        'Read [the procedure](<incident procedure.md#response> "Procedure").',
        "Read [the procedure](incident%20procedure.md).",
        '[incident]: incident.md#response "Incident procedure"',
        "[space]: <incident procedure.md>",
        "[encoded]: incident%20procedure.md#response",
        "[next-line]:",
        "  incident.md",
        "[external]: https://example.com/incident",
        "[email]: mailto:support@example.com",
        "[fragment]: #response",
      ].join("\n")
    )
    assert.deepEqual(localMarkdownLinks(["guide.md"], { cwd }), {
      files: 1,
      missing: [],
    })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

test("Markdown code examples are not treated as local link destinations", () => {
  const cwd = mkdtempSync(join(tmpdir(), "nabaperks-markdown-links-"))
  try {
    writeFileSync(
      join(cwd, "guide.md"),
      [
        "Example: `[label](<missing example.md>)`.",
        "",
        "```markdown",
        "[label](missing.md)",
        "[incident]: <missing reference.md>",
        "```",
        "",
        "    [indented](missing.md)",
      ].join("\n")
    )
    assert.deepEqual(localMarkdownLinks(["guide.md"], { cwd }), {
      files: 1,
      missing: [],
    })
  } finally {
    rmSync(cwd, { recursive: true, force: true })
  }
})

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
    "package.json",
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
