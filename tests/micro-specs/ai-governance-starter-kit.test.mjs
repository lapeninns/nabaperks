import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const kitRoot = path.join(projectRoot, "ai-governance-starter-kit")

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
    })
    assert.match(output, /Governance check passed/)
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
