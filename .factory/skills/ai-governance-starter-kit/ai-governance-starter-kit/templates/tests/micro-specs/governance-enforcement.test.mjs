import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { parseFrontmatter } from "../../scripts/governance-io.mjs"
import { isManualInspectionGate, parsePackageScriptGate, validateGovernance } from "../../scripts/governance-rules.mjs"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

test("Given governance is installed When required files are checked Then the spine exists", () => {
  for (const file of [
    "AGENTS.md",
    "Instructions_MicroSpecsCreation.md",
    "Instructions_tdd.md",
    "micro-specs/README.md",
    "micro-specs/GLOBAL_CONTEXT.md",
    "scripts/check-governance.mjs",
    "scripts/run-governance-gates.mjs",
  ]) {
    assert.equal(existsSync(path.join(projectRoot, file)), true, `${file} exists`)
  }
})

test("Given Micro-Spec metadata When frontmatter is parsed Then list fields stay lists", () => {
  const metadata = parseFrontmatter(`---
spec_id: MS-example
status: active
risk_class: docs-tooling
allowed_blast_radius:
  - scripts/**
required_playwright_projects: []
---
# Example
`)

  assert.deepEqual(metadata.allowed_blast_radius, ["scripts/**"])
  assert.deepEqual(metadata.required_playwright_projects, [])
})

test("Given a package-script gate When parsed Then manager and script are recovered", () => {
  assert.deepEqual(parsePackageScriptGate("pnpm test"), {
    manager: "pnpm",
    scriptName: "test",
    args: undefined,
  })
  assert.equal(parsePackageScriptGate("npm run build").scriptName, "build")
  assert.equal(parsePackageScriptGate("rm -rf /"), null)
})

test("Given a manual gate token When checked Then it is recognised", () => {
  assert.equal(isManualInspectionGate("manual:security-review"), true)
  assert.equal(isManualInspectionGate("manual:design-review"), true)
  assert.equal(isManualInspectionGate("pnpm test"), false)
})

test("Given the current repo When governance is validated Then metadata passes", () => {
  const result = validateGovernance(projectRoot, {
    enforceChangedFiles: false,
  })

  assert.deepEqual(result.failures, [])
})

test("Given a changed file outside blast radius When validated Then enforcement fails", () => {
  const result = validateGovernance(projectRoot, {
    changedFiles: ["src/definitely/not/governed/secret.txt"],
  })

  assert.equal(result.ok, false)
  assert.ok(
    result.failures.some((failure) => failure.includes("allowed_blast_radius")),
    "expected a blast-radius failure"
  )
})

test("Given a changed file inside blast radius When validated Then blast radius passes", () => {
  const result = validateGovernance(projectRoot, {
    changedFiles: ["micro-specs/README.md"],
  })

  assert.equal(
    result.failures.filter((failure) => failure.includes("allowed_blast_radius")).length,
    0,
    "expected no blast-radius failure for an in-scope file"
  )
})
