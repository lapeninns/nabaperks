import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join, relative } from "node:path"
import { runDocumentation } from "./documentation-checks.mjs"
import { isDocumentationPath } from "./impact-documentation.mjs"
import { readChanges, digest } from "./impact-git.mjs"

const CASES = Object.freeze([
  {
    id: "valid-inline",
    text: "# Guide\n\n[Target](target.md)\n",
    passes: true,
  },
  {
    id: "valid-reference",
    text: "# Guide\n\n[Target][target]\n\n[target]: target.md\n",
    passes: true,
  },
  { id: "valid-html", text: '<a href="target.md">Target</a>\n', passes: true },
  { id: "code-example", text: "`[Example](missing.md)`\n", passes: true },
  { id: "bad-format", text: "# Guide\n\n\nText\n", passes: false },
  { id: "broken-inline", text: "[Target](missing.md)\n", passes: false },
  {
    id: "broken-reference",
    text: "[Target][target]\n\n[target]: missing.md\n",
    passes: false,
  },
  {
    id: "broken-html",
    text: '<a href="missing.md">Target</a>\n',
    passes: false,
  },
])

export function documentationChanges(plan, options) {
  return readChanges(plan.identity.baseSha, plan.identity.candidateSha, options)
    .filter(
      (change) => change.status !== "D" && isDocumentationPath(change.path)
    )
    .map(({ path, newOid }) => ({ path, blob: newOid }))
}

export function verifyDocumentationCorpus(corpus) {
  assert.deepEqual(
    corpus,
    {
      digest: digest(CASES),
      cases: CASES.map(({ id, passes }) => ({ id, passes })),
    },
    "Documentation qualification cases are missing, changed or failed"
  )
  return corpus
}

export function qualifyDocumentation({
  cwd = process.cwd(),
  run = runDocumentation,
} = {}) {
  // Exercise the actual changed-file command even when the PR has no Markdown.
  // Both good and broken input are necessary: an unconditional pass or failure
  // must not qualify a parser or formatter change.
  const root = mkdtempSync(join(cwd, "docs/operations/.ci-qualification-"))
  const cases = []
  try {
    writeFileSync(join(root, "target.md"), "# Target\n")
    for (const fixture of CASES) {
      const path = join(root, `${fixture.id}.md`)
      writeFileSync(path, fixture.text)
      let passes = true
      try {
        run(
          {
            profile: "public-pages",
            required: ["documentation"],
            changes: [{ path: relative(cwd, path), status: "A" }],
          },
          { cwd }
        )
      } catch {
        passes = false
      }
      cases.push({ id: fixture.id, passes })
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
  return verifyDocumentationCorpus({ digest: digest(CASES), cases })
}

export function runDocumentationEvidence(
  plan,
  { cwd = process.cwd(), ...options } = {}
) {
  const files = documentationChanges(plan, { cwd })
  runDocumentation(
    { ...plan, changes: files.map(({ path }) => ({ path, status: "M" })) },
    { cwd, ...options }
  )
  const evidence = {
    schema: "nabaperks.documentation-evidence.v1",
    identity: plan.identity,
    files,
    checks: {
      formatting: files.length ? "passed" : "not-required",
      localLinks: files.length ? "passed" : "not-required",
    },
    corpus: plan.comparisonRequired ? qualifyDocumentation({ cwd }) : null,
  }
  const output = join(process.env.RUNNER_TEMP ?? cwd, "documentation-evidence")
  mkdirSync(output, { recursive: true })
  writeFileSync(
    join(output, "documentation.json"),
    JSON.stringify(evidence, null, 2) + "\n"
  )
  return evidence
}

export function verifyDocumentationEvidence(evidence, plan, options) {
  assert.equal(evidence?.schema, "nabaperks.documentation-evidence.v1")
  assert.deepEqual(evidence.identity, plan.identity)
  const files = documentationChanges(plan, options)
  assert.deepEqual(
    evidence.files,
    files,
    "Documentation evidence differs from the candidate file/blob inventory"
  )
  assert.deepEqual(evidence.checks, {
    formatting: files.length ? "passed" : "not-required",
    localLinks: files.length ? "passed" : "not-required",
  })
  verifyDocumentationCorpus(evidence.corpus)
  return evidence
}
