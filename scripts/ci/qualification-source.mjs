import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import {
  constants,
  openSync,
  fstatSync,
  readFileSync,
  closeSync,
} from "node:fs"
import { fileURLToPath } from "node:url"
import { join } from "node:path"
import { git, readAt, digest } from "./impact-git.mjs"
import { isDocumentationPath } from "./impact-documentation.mjs"

const REVIEWED_ROOT = fileURLToPath(new URL("../../", import.meta.url))
const WORKFLOW_PATH = ".github/workflows/ci.yml"
const STAGED_PREFIX = "config/ci-qualification-inputs/"
const STAGED_SUFFIX = ".source"

function safeInputPath(path) {
  // Git paths are read as NUL-delimited data and passed to the filesystem, not a
  // shell. Existing dependency patches and content use spaces and @ characters.
  return (
    typeof path === "string" &&
    path.length > 0 &&
    !path.startsWith("/") &&
    !/[\u0000-\u001f\u007f\\]/.test(path) &&
    !path.split("/").some((part) => ["", ".", ".."].includes(part))
  )
}

function executionInput(path) {
  // Any tracked input can be consumed by a required workload, including tests,
  // fixtures, configuration and application modules imported by checkers. Do
  // not infer trust from a directory or extension allowlist. Only the separately
  // checked documentation content and whole-workflow proposal have other guards.
  return path !== WORKFLOW_PATH && !isDocumentationPath(path)
}

function inputs(sha, cwd) {
  return git(["ls-tree", "-r", "-z", sha], { cwd })
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const match = /^(\d{6}) (\w+) ([a-f0-9]{40})\t(.+)$/.exec(entry)
      assert.ok(match, "Unsupported qualification input")
      assert.ok(safeInputPath(match[4]), "Unsafe qualification input path")
      return { mode: match[1], type: match[2], blob: match[3], path: match[4] }
    })
    .filter(
      (entry) =>
        executionInput(entry.path) ||
        (entry.path !== WORKFLOW_PATH && entry.mode !== "100644")
    )
    .sort((a, b) => a.path.localeCompare(b.path))
}

function expectedInputs(reviewed) {
  const expected = new Map(reviewed.map((entry) => [entry.path, entry]))
  const staged = reviewed.filter((entry) =>
    entry.path.startsWith(STAGED_PREFIX)
  )
  for (const entry of staged) {
    assert.ok(
      entry.path.endsWith(STAGED_SUFFIX),
      "Staged inputs must be inert source data"
    )
    const path = entry.path.slice(STAGED_PREFIX.length, -STAGED_SUFFIX.length)
    assert.ok(
      safeInputPath(path) &&
        executionInput(path) &&
        !path.startsWith(STAGED_PREFIX),
      "Invalid staged qualification input target"
    )
    // A prerequisite can review the future input without activating it in its
    // legacy workflow. Its immutable blob and mode define the only accepted
    // candidate replacement. The staged copies themselves remain bound too.
    expected.set(path, { ...entry, path })
  }
  return {
    entries: [...expected.values()].sort((a, b) =>
      a.path.localeCompare(b.path)
    ),
    staged: staged.length,
  }
}

function verifyLiveInputs(reviewed, cwd) {
  for (const input of reviewed) {
    assert.ok(
      ["100644", "100755"].includes(input.mode) && input.type === "blob",
      "Qualification input must be a regular file"
    )
    const path = join(cwd, input.path)
    // Open once without following a substituted link or blocking on a FIFO.
    // Inspect and hash that same descriptor, even if its pathname changes.
    assert.equal(typeof constants.O_NOFOLLOW, "number")
    assert.equal(typeof constants.O_NONBLOCK, "number")
    const descriptor = openSync(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
    )
    try {
      const stat = fstatSync(descriptor)
      assert.ok(stat.isFile(), "Reviewed execution input is not a regular file")
      assert.equal(
        stat.mode & 0o111 ? "100755" : "100644",
        input.mode,
        "Reviewed execution input mode differs in the verifier worktree"
      )
      const content = readFileSync(descriptor)
      const blob = createHash("sha1")
        .update(`blob ${content.length}\0`)
        .update(content)
        .digest("hex")
      assert.equal(
        blob,
        input.blob,
        `Reviewed execution input differs in the verifier worktree: ${input.path}`
      )
    } finally {
      closeSync(descriptor)
    }
  }
}

export function verifyQualificationSource(
  candidateSha,
  { cwd = process.cwd(), reviewedCwd = REVIEWED_ROOT } = {}
) {
  const reviewedSha = git(["rev-parse", "HEAD"], { cwd: reviewedCwd }).trim()
  const workflow = readAt(candidateSha, WORKFLOW_PATH, { cwd })
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
  const reviewed = inputs(reviewedSha, reviewedCwd)
  assert.ok(reviewed.length > 0, "Reviewed execution inputs are missing")
  verifyLiveInputs(reviewed, reviewedCwd)
  const expected = expectedInputs(reviewed)
  const actual = inputs(candidateSha, cwd)
  if (digest(actual) !== digest(expected.entries)) {
    const left = new Map(
      expected.entries.map((entry) => [entry.path, digest(entry)])
    )
    const right = new Map(actual.map((entry) => [entry.path, digest(entry)]))
    const changed = [...new Set([...left.keys(), ...right.keys()])].filter(
      (path) => left.get(path) !== right.get(path)
    )
    assert.fail(
      "Qualification executables, dependencies or test inputs differ from reviewed source: " +
        changed.slice(0, 12).join(", ")
    )
  }
  return {
    reviewedSha,
    candidateSha,
    workflowDigest: digest(workflow),
    executionInputsDigest: digest(expected.entries),
    executionInputs: expected.entries.length,
    stagedInputs: expected.staged,
    scope: "complete-tracked-input-tree",
  }
}
