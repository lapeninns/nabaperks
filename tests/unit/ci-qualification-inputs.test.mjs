import assert from "node:assert/strict"
import { test } from "node:test"
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { git } from "../../scripts/ci/impact-git.mjs"
import { validatePlan } from "../../scripts/ci/impact-plan-contract.mjs"
import {
  browserEnvironmentFromWorkflow,
  candidateBrowserEnvironment,
} from "../../scripts/ci/impact-browser-environment.mjs"
import {
  candidateQualificationPages,
  verifyQualificationScope,
} from "../../scripts/ci/impact-qualification-scope.mjs"
import {
  selectedPages,
  targetedArguments,
} from "../../scripts/ci/run-targeted-checks.mjs"
import {
  documentationChanges,
  qualifyDocumentation,
  verifyDocumentationCorpus,
  verifyDocumentationEvidence,
} from "../../scripts/ci/documentation-evidence.mjs"

const workflow = readFileSync(
  new URL("../../.github/workflows/ci.yml", import.meta.url),
  "utf8"
)
const policy = JSON.parse(
  readFileSync(
    new URL("../../config/ci-impact-policy.json", import.meta.url),
    "utf8"
  )
)

function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), "qualification-inputs-"))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  const put = (path, text) => {
    mkdirSync(dirname(join(cwd, path)), { recursive: true })
    writeFileSync(join(cwd, path), text)
  }
  git(["init", "-q"], { cwd })
  const commit = () => {
    git(["add", "--all"], { cwd })
    git(
      [
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=ci@example.test",
        "-c",
        "core.hooksPath=/dev/null",
        "commit",
        "-qm",
        "fixture",
      ],
      { cwd }
    )
    return git(["rev-parse", "HEAD"], { cwd }).trim()
  }
  put("config/ci-impact-policy.json", JSON.stringify(policy))
  put(".github/workflows/ci.yml", workflow)
  return { cwd, put, commit, base: commit() }
}

test("candidate workflow identity rejects changed targeted images despite identical Playwright options", (t) => {
  const f = fixture(t)
  const original = candidateBrowserEnvironment(f.base, f)
  const changed = workflow.replace(
    /@sha256:[a-f0-9]{64}/,
    `@sha256:${"a".repeat(64)}`
  )
  f.put(".github/workflows/ci.yml", changed)
  assert.throws(
    () => candidateBrowserEnvironment(f.commit(), f),
    /images or runners differ/
  )
  assert.deepEqual(candidateBrowserEnvironment(f.base, f), original)
  for (const invalid of [
    workflow.replace(/@sha256:[a-f0-9]{64}/, ""),
    workflow.replace(
      "options: --init --ipc=host --user 1001",
      "options: --init --user 1001"
    ),
    workflow.replace(
      "image: mcr.microsoft.com",
      "image: &browser mcr.microsoft.com"
    ),
    workflow.replace(
      "image: mcr.microsoft.com",
      "image: '${{ env.IMAGE }}'\n      ignored: mcr.microsoft.com"
    ),
  ])
    assert.throws(() => browserEnvironmentFromWorkflow(invalid))
})

test("reviewed comparison accepts exact candidate page additions removals and renames as data", (t) => {
  const f = fixture(t)
  const stale = candidateQualificationPages(f.base, f)
  for (const operation of ["add", "remove", "rename"]) {
    const next = structuredClone(policy)
    if (operation === "add")
      next.publicPages["app/new-guide/page.tsx"] = {
        route: "/new-guide",
        visualName: "marketing-new-guide",
      }
    if (operation === "remove") delete next.publicPages["app/faq/page.tsx"]
    if (operation === "rename")
      next.publicPages["app/faq/page.tsx"].visualName = "marketing-questions"
    f.put("config/ci-impact-policy.json", JSON.stringify(next))
    const candidateSha = f.commit()
    const plan = {
      profile: "full",
      comparisonRequired: true,
      identity: { candidateSha },
      qualificationPages: candidateQualificationPages(candidateSha, f),
    }
    assert.deepEqual(verifyQualificationScope(plan, f), selectedPages(plan))
    assert.ok(targetedArguments(plan, "browser", "chromium").length)
    assert.throws(
      () => verifyQualificationScope({ ...plan, qualificationPages: stale }, f),
      /immutable candidate policy/
    )
    const page =
      plan.qualificationPages.find(
        (entry) =>
          !stale.some(
            (old) =>
              old.path === entry.path && old.visualName === entry.visualName
          )
      ) ?? plan.qualificationPages[0]
    const selective = {
      schema: "nabaperks.ci-impact-plan.v1",
      identity: plan.identity,
      profile: "public-pages",
      reason: "Literal edit after the proposed policy has been reviewed",
      pages: [page],
      changes: [{ path: page.path, status: "M" }],
      required: [
        "fast",
        "quality",
        "build",
        "targeted-browser",
        "targeted-visual",
      ],
      comparisonRequired: false,
      changeDigest: "a".repeat(64),
      policyDigest: "b".repeat(64),
    }
    assert.equal(
      validatePlan(selective, plan.identity, next).profile,
      "public-pages"
    )
    if (operation !== "remove")
      assert.throws(
        () => validatePlan(selective, plan.identity, policy),
        /Unqualified page selection/
      )
  }
})

test("documentation qualification rejects bypassed checks and omitted corpus without changed Markdown", () => {
  assert.throws(
    () => qualifyDocumentation({ run() {} }),
    /missing, changed or failed/
  )
  assert.throws(
    () =>
      qualifyDocumentation({
        run() {
          throw new Error("all fail")
        },
      }),
    /missing, changed or failed/
  )
  assert.throws(
    () => verifyDocumentationCorpus({ digest: "a".repeat(64), cases: [] }),
    /missing, changed or failed/
  )
})

test("documentation evidence requires the candidate's complete changed file and blob inventory", (t) => {
  const f = fixture(t)
  f.put("docs/operations/new-guide.md", "# New guide\n")
  const candidateSha = f.commit()
  const plan = { identity: { baseSha: f.base, candidateSha }, changes: [] }
  const files = documentationChanges(plan, f)
  assert.equal(files.length, 1)
  assert.equal(files[0].path, "docs/operations/new-guide.md")
  const evidence = {
    schema: "nabaperks.documentation-evidence.v1",
    identity: plan.identity,
    files: [],
    checks: { formatting: "not-required", localLinks: "not-required" },
  }
  assert.throws(
    () => verifyDocumentationEvidence(evidence, plan, f),
    /candidate file\/blob inventory/
  )
  assert.throws(
    () =>
      verifyDocumentationEvidence(
        { ...evidence, files: [{ ...files[0], blob: "a".repeat(40) }] },
        plan,
        f
      ),
    /candidate file\/blob inventory/
  )
})
