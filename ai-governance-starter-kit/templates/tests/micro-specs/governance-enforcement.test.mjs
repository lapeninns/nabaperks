import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { parseFrontmatter } from "../../scripts/governance-io.mjs"
import { validateGovernance } from "../../scripts/governance-rules.mjs"

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

test("Given the current repo When governance is validated Then metadata passes", () => {
  const result = validateGovernance(projectRoot, {
    enforceChangedFiles: false,
  })

  assert.deepEqual(result.failures, [])
})
