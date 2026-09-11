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
import { git, readAt, readChanges } from "../../scripts/ci/impact-git.mjs"
import {
  fullPlan,
  validateComparisonPlan,
} from "../../scripts/ci/impact-comparison-plan.mjs"
import {
  browserEnvironmentFromWorkflow,
  candidateBrowserEnvironment,
} from "../../scripts/ci/impact-browser-environment.mjs"
import {
  candidateQualificationPages,
  verifyQualificationScope,
} from "../../scripts/ci/impact-qualification-scope.mjs"
import { selectedPages } from "../../scripts/ci/impact-qualification-scope.mjs"
import {
  documentationChanges,
  verifyDocumentationCorpus,
  verifyDocumentationEvidence,
} from "../../scripts/ci/documentation-evidence-contract.mjs"

const image =
  "mcr.microsoft.com/playwright:v1.62.1-noble@sha256:" + "a".repeat(64)
const workflow =
  "jobs:\n" +
  ["targeted-browser", "e2e", "a11y", "visual", "targeted-visual"]
    .map(
      (name) =>
        `  ${name}:\n    runs-on: ubuntu-latest\n` +
        (name.includes("visual")
          ? ""
          : `    container:\n      image: ${image}\n      options: --init --ipc=host --user 1001\n`)
    )
    .join("")
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
    `@sha256:${"b".repeat(64)}`
  )
  f.put(".github/workflows/ci.yml", changed)
  assert.throws(
    () => candidateBrowserEnvironment(f.commit(), f),
    /images or runners differ/
  )
  assert.deepEqual(candidateBrowserEnvironment(f.base, f), original)
  for (const invalid of [
    workflow.replaceAll("ubuntu-latest", "self-hosted"),
    workflow.replaceAll("ubuntu-latest", "ubuntu-24.04-arm"),
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

test("immutable Git reads ignore replacement refs and ambient Git overrides", (t) => {
  const f = fixture(t)
  f.put("README.md", "# Original\n")
  const original = f.commit()
  f.put("README.md", "# Replacement\n")
  const replacement = f.commit()
  const expected = readChanges(original, replacement, f)
  git(["replace", original, replacement], f)
  assert.equal(readAt(original, "README.md", f), "# Original\n")
  assert.deepEqual(readChanges(original, replacement, f), expected)
  const overrides = {
    GIT_DIR: join(f.cwd, "missing"),
    GIT_WORK_TREE: join(f.cwd, "missing"),
    GIT_OBJECT_DIRECTORY: join(f.cwd, "missing"),
    GIT_REPLACE_REF_BASE: "refs/replace/",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "core.bare",
    GIT_CONFIG_VALUE_0: "true",
  }
  const previous = Object.fromEntries(
    Object.keys(overrides).map((key) => [key, process.env[key]])
  )
  try {
    Object.assign(process.env, overrides)
    assert.equal(readAt(original, "README.md", f), "# Original\n")
    assert.deepEqual(readChanges(original, replacement, f), expected)
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
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
    assert.throws(
      () => verifyQualificationScope({ ...plan, qualificationPages: stale }, f),
      /immutable candidate policy/
    )
  }
})

test("documentation qualification requires the exact reviewed corpus", () => {
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

test("the foundation cannot authorise forged selective plans", () => {
  const identity = {
    repository: "lapeninns/nabaperks",
    event: "pull_request",
    baseSha: "a".repeat(40),
    headSha: "b".repeat(40),
    candidateSha: "c".repeat(40),
  }
  const plan = fullPlan(identity, "Full qualification only")
  assert.equal(validateComparisonPlan(plan, identity).profile, "full")
  for (const profile of ["documentation", "public-pages"])
    assert.throws(
      () =>
        validateComparisonPlan(
          {
            ...plan,
            profile,
            changes: [{ path: "README.md" }],
            changeDigest: "a".repeat(64),
            policyDigest: "b".repeat(64),
          },
          identity
        ),
      /all application workloads/
    )
})
