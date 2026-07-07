import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const kitRoot = path.join(projectRoot, "ai-governance-starter-kit")

// Temp-repo governance checks must be hermetic: an ambient
// GOVERNANCE_CHANGED_FILES or GOVERNANCE_REPROVING_SPECS (e.g. injected by a
// governance:advance run whose test gate spawned this suite) would otherwise
// leak this repo's invocation context into the sandbox.
const hermeticEnv = { ...process.env }
delete hermeticEnv.GOVERNANCE_CHANGED_FILES
delete hermeticEnv.GOVERNANCE_REPROVING_SPECS

test("Given the starter kit When files are inspected Then the Factory skill and templates exist", () => {
  for (const file of [
    ".factory/skills/ai-governance-starter-kit/SKILL.md",
    "ai-governance-starter-kit/install-ai-governance.mjs",
    "ai-governance-starter-kit/templates/AGENTS.md.template",
    "ai-governance-starter-kit/templates/micro-specs/README.md",
    "ai-governance-starter-kit/templates/scripts/check-governance.mjs",
    "ai-governance-starter-kit/templates/scripts/run-governance-gates.mjs",
  ]) {
    assert.equal(existsSync(path.join(projectRoot, file)), true, `${file} exists`)
  }
})

test("Given a package repo When the installer runs Then governance is installed and validates", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-"))

  try {
    writePackageJson(targetRoot)

    execFileSync("node", [path.join(kitRoot, "install-ai-governance.mjs"), targetRoot], {
      stdio: "pipe",
    })

    const packageJson = JSON.parse(readFileSync(path.join(targetRoot, "package.json"), "utf8"))
    assert.equal(packageJson.scripts["governance:check"], "node scripts/check-governance.mjs")
    assert.equal(packageJson.scripts["governance:run-gates"], "node scripts/run-governance-gates.mjs")
    assert.equal(existsSync(path.join(targetRoot, "AGENTS.md")), true)

    const output = execFileSync("node", ["scripts/check-governance.mjs"], {
      cwd: targetRoot,
      encoding: "utf8",
      env: hermeticEnv,
    })
    assert.match(output, /Governance check passed/)
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

test("Given a fresh install When the installed test suite runs Then the kit-flavor tests pass in situ", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-insitu-"))

  try {
    writePackageJson(targetRoot)
    execFileSync("node", [path.join(kitRoot, "install-ai-governance.mjs"), targetRoot], {
      stdio: "pipe",
    })

    // Enumerate the installed test files explicitly (no shell globbing, no
    // reliance on the runner's directory discovery). A non-zero exit throws.
    const testFiles = readdirSync(path.join(targetRoot, "tests/micro-specs"))
      .filter((name) => name.endsWith(".test.mjs"))
      .map((name) => path.join("tests/micro-specs", name))
    assert.ok(testFiles.length >= 3, "the installer plants the kit test suite")
    // NODE_TEST_CONTEXT must not leak: this suite itself runs under node's
    // test runner, and an inherited context makes the nested `node --test`
    // act as a silent runner child instead of a standalone run.
    const childEnv = { ...hermeticEnv }
    delete childEnv.NODE_TEST_CONTEXT
    const output = execFileSync("node", ["--test", ...testFiles], {
      cwd: targetRoot,
      encoding: "utf8",
      env: childEnv,
    })
    assert.match(output, /\bfail 0\b/, "the installed suite reports zero failures")
    assert.doesNotMatch(output, /\bpass 0\b/, "the installed suite actually ran tests")
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

test("Given preview mode When the installer runs Then no files are written and readiness is reported", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-preview-"))

  try {
    writePackageJson(targetRoot)
    const before = readFileSync(path.join(targetRoot, "package.json"), "utf8")
    const output = execFileSync(
      "node",
      [path.join(kitRoot, "install-ai-governance.mjs"), "--preview", targetRoot],
      {
        encoding: "utf8",
      }
    )

    assert.match(output, /AI Governance Starter Kit preview/)
    assert.match(output, /Stack profile:/)
    assert.match(output, /Plan: \d+ write/)
    assert.equal(readFileSync(path.join(targetRoot, "package.json"), "utf8"), before)
    assert.equal(existsSync(path.join(targetRoot, "AGENTS.md")), false)
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

test("Given custom governance scripts When installing without force Then scripts are preserved", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-custom-"))

  try {
    writePackageJson(targetRoot, {
      scripts: {
        "governance:check": "node custom-check.mjs",
        "governance:run-gates": "node custom-gates.mjs",
        build: "node --version",
        lint: "node --version",
        test: "node --test tests/micro-specs/*.test.mjs",
        typecheck: "node --version",
      },
    })

    execFileSync("node", [path.join(kitRoot, "install-ai-governance.mjs"), targetRoot], {
      stdio: "pipe",
    })

    const packageJson = JSON.parse(readFileSync(path.join(targetRoot, "package.json"), "utf8"))
    assert.equal(packageJson.scripts["governance:check"], "node custom-check.mjs")
    assert.equal(packageJson.scripts["governance:run-gates"], "node custom-gates.mjs")
    assert.equal(packageJson.scripts["test:micro-specs"], "node --test tests/micro-specs/*.test.mjs")
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

test("Given Next Supabase Stripe markers When preview runs Then the stack profile is detected", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-stack-"))

  try {
    writePackageJson(targetRoot, {
      dependencies: {
        "@supabase/supabase-js": "latest",
        next: "latest",
        react: "latest",
        stripe: "latest",
      },
      devDependencies: {
        "@playwright/test": "latest",
      },
    })

    const output = execFileSync(
      "node",
      [path.join(kitRoot, "install-ai-governance.mjs"), "--preview", targetRoot],
      {
        encoding: "utf8",
      }
    )

    assert.match(output, /next-js-react-supabase-stripe-playwright/)
    assert.match(output, /Next\.js, React, Supabase, Stripe, Playwright/)
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

test("Given existing CI with governance When installing Then the starter workflow is skipped", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-ci-"))

  try {
    writePackageJson(targetRoot)
    mkdirSync(path.join(targetRoot, ".github", "workflows"), { recursive: true })
    writeFileSync(
      path.join(targetRoot, ".github", "workflows", "ci.yml"),
      "name: CI\njobs:\n  test:\n    steps:\n      - run: pnpm governance:check\n"
    )

    const output = execFileSync(
      "node",
      [path.join(kitRoot, "install-ai-governance.mjs"), targetRoot],
      {
        encoding: "utf8",
      }
    )

    assert.match(output, /existing CI already runs governance/)
    assert.equal(existsSync(path.join(targetRoot, ".github", "workflows", "ai-governance.yml")), false)
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

test("Given invalid package JSON When preview runs Then a clean blocker is reported", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-invalid-"))

  try {
    writeFileSync(path.join(targetRoot, "package.json"), "{ invalid")
    const output = execFileSync(
      "node",
      [path.join(kitRoot, "install-ai-governance.mjs"), "--preview", targetRoot],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }
    ).toString()

    assert.match(output, /Blockers:/)
    assert.match(output, /package\.json could not be parsed/)
    assert.equal(existsSync(path.join(targetRoot, "AGENTS.md")), false)
  } catch (error) {
    const stdout = error.stdout?.toString() ?? ""
    assert.match(stdout, /Blockers:/)
    assert.match(stdout, /package\.json could not be parsed/)
    assert.equal(existsSync(path.join(targetRoot, "AGENTS.md")), false)
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

test("Given a high-risk spec without durable proof When validated Then governance fails", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-teeth-"))

  try {
    writePackageJson(targetRoot, {
      scripts: {
        build: "node --version",
        lint: "node --version",
        test: "node --test tests/micro-specs/*.test.mjs",
        typecheck: "node --version",
        "test:db": "node --version",
      },
    })

    execFileSync("node", [path.join(kitRoot, "install-ai-governance.mjs"), targetRoot], {
      stdio: "pipe",
    })

    // A billing spec that declares no durable-proof gate even though test:db exists.
    writeFileSync(
      path.join(targetRoot, "micro-specs", "billing-no-proof.md"),
      [
        "---",
        "spec_id: MS-billing-no-proof",
        "status: active",
        "risk_class: billing",
        "owner: test",
        "last_reviewed: 2026-07-01",
        "allowed_blast_radius:",
        "  - lib/**",
        "implementation_surfaces:",
        "  - lib/x.ts",
        "related_tests:",
        "  - tests/unit/x.test.mjs",
        "verification_gates:",
        "  - pnpm governance:check",
        "  - pnpm test",
        "  - pnpm lint",
        "  - pnpm typecheck",
        "  - pnpm build",
        "required_playwright_projects: []",
        "evidence_required:",
        "  - readback",
        "approved_exceptions: []",
        "---",
        "# Billing without durable proof",
        "",
      ].join("\n")
    )

    let output = ""
    let failed = false
    try {
      execFileSync("node", ["scripts/check-governance.mjs"], {
        cwd: targetRoot,
        encoding: "utf8",
        env: hermeticEnv,
      })
    } catch (error) {
      failed = true
      output = `${error.stdout ?? ""}${error.stderr ?? ""}`
    }

    assert.equal(failed, true, "billing spec without durable proof must fail governance")
    assert.match(output, /durable-proof gate/)
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

test("Given an installed kit When upgraded Then engine files refresh with backups and seed files survive", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-upgrade-"))

  try {
    writePackageJson(targetRoot)
    execFileSync("node", [path.join(kitRoot, "install-ai-governance.mjs"), targetRoot], {
      stdio: "pipe",
    })

    // Simulate a stale engine + adapted seed files.
    const enginePath = path.join(targetRoot, "scripts", "governance-glob.mjs")
    writeFileSync(enginePath, "// stale engine from an older kit\n")
    const agentsPath = path.join(targetRoot, "AGENTS.md")
    writeFileSync(agentsPath, "# Adapted by the repo\n")
    const constantsPath = path.join(targetRoot, "scripts", "governance-constants.mjs")
    const adaptedConstants = readFileSync(constantsPath, "utf8").replace(
      "export const STALE_REVIEW_DAYS = 90",
      "export const STALE_REVIEW_DAYS = 14"
    )
    writeFileSync(constantsPath, adaptedConstants)

    const output = execFileSync(
      "node",
      [path.join(kitRoot, "install-ai-governance.mjs"), "--upgrade", targetRoot],
      { encoding: "utf8" }
    )

    assert.match(output, /upgraded in/)
    assert.match(output, /Post-upgrade review/)
    assert.match(
      readFileSync(enginePath, "utf8"),
      /Glob matching for blast-radius/,
      "stale engine file is refreshed to the kit version"
    )
    const backups = readdirSync(path.join(targetRoot, "scripts")).filter((file) =>
      file.startsWith("governance-glob.mjs.bak.")
    )
    assert.equal(backups.length, 1, "the overwritten engine file leaves a backup")
    assert.equal(
      readFileSync(agentsPath, "utf8"),
      "# Adapted by the repo\n",
      "seed files are never overwritten by --upgrade"
    )
    assert.match(
      readFileSync(constantsPath, "utf8"),
      /STALE_REVIEW_DAYS = 14/,
      "governance-constants.mjs (repo tuning) is never overwritten by --upgrade"
    )
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

const SUITE_SKILLS = ["close-micro-spec", "implement-micro-spec", "install-governance", "write-micro-spec"]

test("Given a fresh install When the installer runs Then the station suite lands in .claude/skills", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-suite-"))

  try {
    writePackageJson(targetRoot)
    execFileSync("node", [path.join(kitRoot, "install-ai-governance.mjs"), targetRoot], {
      stdio: "pipe",
    })

    for (const name of SUITE_SKILLS) {
      const skillMd = path.join(targetRoot, ".claude/skills", name, "SKILL.md")
      assert.equal(existsSync(skillMd), true, `${name} lands in the target's .claude/skills`)
      assert.match(
        readFileSync(skillMd, "utf8"),
        /managed-by: ai-governance-starter-kit/,
        `${name} carries the managed-by marker`
      )
    }
    assert.equal(
      existsSync(path.join(targetRoot, ".claude/skills/ai-governance-starter-kit")),
      false,
      "the router is never planted into targets"
    )
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

test("Given --no-skills When installing Then no suite skills are planned or written", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-noskills-"))

  try {
    writePackageJson(targetRoot)
    const output = execFileSync(
      "node",
      [path.join(kitRoot, "install-ai-governance.mjs"), "--no-skills", targetRoot],
      { encoding: "utf8" }
    )

    assert.doesNotMatch(output, /\.claude\/skills/)
    assert.equal(existsSync(path.join(targetRoot, ".claude/skills")), false)
    assert.equal(existsSync(path.join(targetRoot, "scripts/check-governance.mjs")), true)
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

test("Given an installed suite When re-installed and upgraded Then adaptations survive installs and --upgrade refreshes with a backup", () => {
  const targetRoot = mkdtempSync(path.join(tmpdir(), "ai-governance-kit-suite-upgrade-"))

  try {
    writePackageJson(targetRoot)
    execFileSync("node", [path.join(kitRoot, "install-ai-governance.mjs"), targetRoot], {
      stdio: "pipe",
    })

    const doctored = path.join(targetRoot, ".claude/skills/write-micro-spec/SKILL.md")
    writeFileSync(doctored, "# adapted by the repo\n")

    // A plain re-install honors the adaptation (skip-if-exists).
    execFileSync("node", [path.join(kitRoot, "install-ai-governance.mjs"), targetRoot], {
      stdio: "pipe",
    })
    assert.equal(readFileSync(doctored, "utf8"), "# adapted by the repo\n")

    // --upgrade refreshes the owned suite file, leaving a backup.
    execFileSync(
      "node",
      [path.join(kitRoot, "install-ai-governance.mjs"), "--upgrade", targetRoot],
      { stdio: "pipe" }
    )
    assert.match(readFileSync(doctored, "utf8"), /name: write-micro-spec/)
    const backups = readdirSync(path.join(targetRoot, ".claude/skills/write-micro-spec")).filter(
      (file) => file.startsWith("SKILL.md.bak.")
    )
    assert.equal(backups.length, 1, "the overwritten suite skill leaves a backup")
  } finally {
    rmSync(targetRoot, { recursive: true, force: true })
  }
})

function writePackageJson(targetRoot, overrides = {}) {
  const packageJson = {
    name: "starter-target",
    type: "module",
    packageManager: "pnpm@10.0.0",
    dependencies: {},
    devDependencies: {},
    scripts: {
      build: "node --version",
      lint: "node --version",
      test: "node --test tests/micro-specs/*.test.mjs",
      typecheck: "node --version",
    },
    ...overrides,
  }

  packageJson.scripts = {
    build: "node --version",
    lint: "node --version",
    test: "node --test tests/micro-specs/*.test.mjs",
    typecheck: "node --version",
    ...(overrides.scripts ?? {}),
  }

  writeFileSync(path.join(targetRoot, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`)
}
