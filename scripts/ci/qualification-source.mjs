import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { git, readAt, digest } from "./impact-git.mjs"

const REVIEWED_ROOT = fileURLToPath(new URL("../../", import.meta.url))

function executionInput(path) {
  // This read-only advisory collector does not execute or produce qualification.
  if (path === "scripts/ci/hosted-evidence.mjs") return false
  return (
    path.startsWith(".github/actions/") ||
    path.startsWith("scripts/ci/") ||
    /^tests\/e2e\/.*\.(?:[cm]?[jt]sx?|json)$/.test(path) ||
    [
      "package.json",
      "pnpm-lock.yaml",
      "pnpm-workspace.yaml",
      ".nvmrc",
      ".npmrc",
      ".pnpmfile.cjs",
      ".editorconfig",
      ".prettierrc",
      ".prettierignore",
      "config/ci-workloads.json",
      "ops/local-ci/core/process-tree.mjs",
      "scripts/run-playwright.mjs",
      "scripts/playwright-server-heap.mjs",
    ].includes(path) ||
    /^(?:playwright|next|postcss|prettier|tsconfig)[^/]*\.(?:[cm]?[jt]s|json)$/.test(
      path
    )
  )
}

function inputs(sha, cwd) {
  return git(["ls-tree", "-r", "-z", sha], { cwd })
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const match = /^(\d{6}) (\w+) ([a-f0-9]{40})\t(.+)$/.exec(entry)
      assert.ok(match, "Unsupported qualification input")
      return { mode: match[1], type: match[2], blob: match[3], path: match[4] }
    })
    .filter((entry) => executionInput(entry.path))
    .sort((a, b) => a.path.localeCompare(b.path))
}

export function verifyQualificationSource(
  candidateSha,
  { cwd = process.cwd(), reviewedCwd = REVIEWED_ROOT } = {}
) {
  const reviewedSha = git(["rev-parse", "HEAD"], { cwd: reviewedCwd }).trim()
  const workflow = readAt(candidateSha, ".github/workflows/ci.yml", { cwd })
  // The entire proposed workflow is reviewable data in the foundation. This
  // includes steps, conditions, environment, actions and artifact wiring.
  const expectedWorkflow = readAt(
    reviewedSha,
    "config/ci-qualification-workflow.yml",
    { cwd: reviewedCwd }
  )
  assert.equal(
    workflow,
    expectedWorkflow,
    "Qualification workflow differs from the reviewed command wiring"
  )
  const expected = inputs(reviewedSha, reviewedCwd)
  assert.ok(expected.length > 0, "Reviewed execution inputs are missing")
  assert.deepEqual(
    inputs(candidateSha, cwd),
    expected,
    "Qualification executables, dependencies or test configuration differ from reviewed source"
  )
  // The live checkout must still contain the reviewed verifier and inputs.
  for (const input of expected) {
    assert.ok(
      ["100644", "100755"].includes(input.mode),
      "Qualification input must be a regular file"
    )
    assert.equal(input.type, "blob")
    assert.equal(
      readFileSync(join(reviewedCwd, input.path), "utf8"),
      readAt(reviewedSha, input.path, { cwd: reviewedCwd }),
      "Reviewed execution input differs in the verifier worktree"
    )
  }
  return {
    reviewedSha,
    candidateSha,
    workflowDigest: digest(workflow),
    executionInputsDigest: digest(expected),
    executionInputs: expected.length,
  }
}
