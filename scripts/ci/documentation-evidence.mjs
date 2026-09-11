import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join, relative } from "node:path"
import { runDocumentation } from "./documentation-checks.mjs"
import { digest } from "./impact-git.mjs"
import {
  DOCUMENTATION_CASES,
  documentationChanges,
  verifyDocumentationCorpus,
} from "./documentation-evidence-contract.mjs"
export {
  documentationChanges,
  verifyDocumentationCorpus,
  verifyDocumentationEvidence,
} from "./documentation-evidence-contract.mjs"

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
    for (const fixture of DOCUMENTATION_CASES) {
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
  return verifyDocumentationCorpus({
    digest: digest(DOCUMENTATION_CASES),
    cases,
  })
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
