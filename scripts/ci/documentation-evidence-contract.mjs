import assert from "node:assert/strict"
import { isDocumentationPath } from "./impact-documentation.mjs"
import { readChanges, digest } from "./impact-git.mjs"

export const DOCUMENTATION_CASES = Object.freeze([
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
      digest: digest(DOCUMENTATION_CASES),
      cases: DOCUMENTATION_CASES.map(({ id, passes }) => ({ id, passes })),
    },
    "Documentation qualification cases are missing, changed or failed"
  )
  return corpus
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
