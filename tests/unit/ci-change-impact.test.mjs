import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  classifyChanges,
  calculateImpact,
  requiredRoots,
} from "../../scripts/ci/change-impact.mjs"
import {
  isPresentationOnly,
  findPageConsumers,
} from "../../scripts/ci/impact-presentation.mjs"
import { git, readChanges, safePath } from "../../scripts/ci/impact-git.mjs"
import {
  expectedIdentity,
  fullPlan,
  ALL_WORKLOADS,
} from "../../scripts/ci/impact-plan-contract.mjs"
import { verifyImpactEvidence } from "../../scripts/ci/verify-impact-evidence.mjs"
import { planChecks } from "../../scripts/ci/plan-checks.mjs"
import {
  createNoDeployment,
  validateNoDeployment,
} from "../../scripts/release/no-deployment.mjs"

const before =
  'export default function Page() { return <p className="p-2">Hello</p> }'
const copy = before.replace("Hello", "Welcome")
const change = (path, fields = {}) => ({
  path,
  status: "M",
  oldMode: "100644",
  newMode: "100644",
  oldOid: "a".repeat(40),
  newOid: "b".repeat(40),
  ...fields,
})
const classify = (changes, after = copy, consumers = () => []) =>
  classifyChanges(changes, {
    read: (oid) => (oid === "a".repeat(40) ? before : after),
    consumers,
  })

test("internal documentation has its own profile; executable and unqualified files never inherit it", () => {
  assert.equal(
    classify([change("docs/operations/production-runbook.md")]).profile,
    "documentation"
  )
  assert.equal(
    classify([
      change("docs/decisions/new-decision.md", {
        status: "A",
        oldMode: "000000",
      }),
    ]).profile,
    "documentation"
  )
  for (const path of [
    "AGENTS.md",
    "SECURITY.md",
    "DESIGN.md",
    "docs/api/openapi.json",
    "docs/api/README.md",
    "package.json",
    ".github/workflows/ci.yml",
    "lib/loyalty/issue.ts",
    "supabase/migrations/new.sql",
    "docs/operations/test.mjs",
    "docs/operations/evil.md/run.ts",
  ])
    assert.equal(classify([change(path)]).profile, "full", path)
})

test("copy and literal intrinsic style changes qualify only in reviewed public leaf pages", () => {
  for (const after of [
    copy,
    before.replace('className="p-2"', 'className="p-4"'),
  ]) {
    const result = classify([change("app/about/page.tsx")], after)
    assert.equal(result.profile, "public-pages")
    assert.equal(result.pages[0].route, "/about")
  }
  assert.equal(classify([change("components/ui/button.tsx")]).profile, "full")
  assert.equal(classify([change("app/home/login/page.tsx")]).profile, "full")
  assert.equal(
    classify([change("app/about/page.tsx")], copy, () => ["app/other/page.tsx"])
      .profile,
    "full"
  )
})

test("a one-line behaviour change, new import or new JSX structure cannot masquerade as copy", () => {
  for (const after of [
    'import "./side-effect"; ' + copy,
    copy.replace("return", "console.log('side effect'); return"),
    copy.replace("<p ", "<p onClick={submit} "),
    copy.replace("Welcome", "{runCode()}"),
    copy.replace("<p ", "<p dangerouslySetInnerHTML={{ __html: user }} "),
    copy.replace("p-2", 'p-2" onClick={submit} data-x="'),
    copy.replace(/<p /, "<button ").replace("</p>", "</button>"),
    copy.replace("function Page()", "async function Page()"),
  ])
    assert.equal(
      isPresentationOnly(before, after, "app/about/page.tsx"),
      false,
      after
    )
  assert.equal(
    isPresentationOnly(
      '<a href="/a">Hello</a>',
      '<a href="/b">Hello</a>',
      "page.tsx"
    ),
    false
  )
  assert.equal(
    isPresentationOnly(
      '<Widget title="mode-a" />',
      '<Widget title="mode-b" />',
      "page.tsx"
    ),
    false
  )
  assert.equal(
    isPresentationOnly(
      "<script>alert(1)</script>",
      "<script>alert(2)</script>",
      "page.tsx"
    ),
    false
  )
  assert.equal(
    isPresentationOnly(
      'const message="A"; <p>{message}</p>',
      'const message="B"; <p>{message}</p>',
      "page.tsx"
    ),
    false
  )
  assert.throws(
    () => isPresentationOnly(before, "<p broken=", "page.tsx"),
    /Unparseable/
  )
})

test("interaction, visibility, positioning and arbitrary classes retain full functional validation", () => {
  const original =
    '<div className="flex gap-3"><a href="/signup">Start</a></div>'
  for (const utility of [
    "pointer-events-none",
    "hover:pointer-events-none",
    "[pointer-events:none]",
    "sm:[&>*]:pointer-events-none",
    "!pointer-events-none",
    "touch-none",
    "hidden",
    "invisible",
    "opacity-0",
    "absolute",
    "z-50",
    "w-0",
    "overflow-hidden",
    "translate-x-full",
    "unknown-custom-class",
  ]) {
    const changed = original.replace("flex gap-3", `flex gap-3 ${utility}`)
    assert.equal(
      isPresentationOnly(original, changed, "page.tsx"),
      false,
      utility
    )
    assert.equal(
      isPresentationOnly(changed, original, "page.tsx"),
      false,
      `removed ${utility}`
    )
    assert.equal(
      classify([change("app/faq/page.tsx")], copy.replace("p-2", utility))
        .profile,
      "full",
      utility
    )
  }
  for (const utility of [
    "gap-4",
    "text-lg",
    "font-semibold",
    "sm:bg-slate-100",
    "rounded-md",
    "border-2",
  ]) {
    const changed = original.replace("flex gap-3", `flex gap-3 ${utility}`)
    assert.equal(
      isPresentationOnly(original, changed, "page.tsx"),
      true,
      utility
    )
  }
})

test("a mixed eligible PR retains the documentation evidence required for its Markdown files", () => {
  const changes = [change("app/about/page.tsx"), change("docs/operations/a.md")]
  assert.equal(classify(changes).profile, "public-pages")
  const plan = {
    ...fullPlan(identity, "Mixed eligible change", false),
    profile: "public-pages",
    changes,
    pages: [
      {
        path: "app/about/page.tsx",
        route: "/about",
        visualName: "marketing-about",
      },
    ],
    changeDigest: "d".repeat(64),
    policyDigest: "e".repeat(64),
    required: requiredRoots("public-pages", changes),
  }
  assert.ok(plan.required.includes("documentation"))
  const evidence = evidenceFor("documentation")
  evidence.selection.outputs.plan = JSON.stringify(plan)
  for (const name of ALL_WORKLOADS)
    evidence[name].result = plan.required.includes(name) ? "success" : "skipped"
  assert.match(
    verifyImpactEvidence(evidence, identity),
    /documentation: passed/
  )
  evidence.documentation.result = "skipped"
  assert.throws(
    () => verifyImpactEvidence(evidence, identity),
    /documentation: successful execution required/
  )
  plan.required = plan.required.filter((name) => name !== "documentation")
  evidence.selection.outputs.plan = JSON.stringify(plan)
  assert.throws(
    () => verifyImpactEvidence(evidence, identity),
    /Required checks differ/
  )
})

test("deletions, executable modes, symlinks, renames and mixed changes retain complete validation", () => {
  for (const fields of [
    { status: "D", newMode: "000000" },
    { newMode: "100755" },
    { newMode: "120000" },
    { oldMode: "120000" },
  ])
    assert.equal(
      classify([change("docs/operations/a.md", fields)]).profile,
      "full"
    )
  assert.equal(
    classify([change("docs/operations/a.md"), change("app/api/route.ts")])
      .profile,
    "full"
  )
  assert.equal(
    classify([change("app/about/page.tsx", { status: "A", oldMode: "000000" })])
      .profile,
    "full"
  )
  assert.equal(classify([]).profile, "full")
  for (const path of [
    "../x.md",
    "/tmp/x.md",
    "docs//x.md",
    "docs/operations/../api/x.md",
    "docs/operations/x\ny.md",
    "docs/operations/`cmd`.md",
    "docs/operations/x\\y.md",
  ])
    assert.equal(safePath(path), false, path)
})

function repository(t) {
  const cwd = mkdtempSync(join(tmpdir(), "ci-impact-test-"))
  t.after(() => rmSync(cwd, { recursive: true, force: true }))
  git(["init", "-q", "--initial-branch=main"], { cwd })
  git(["config", "user.name", "CI fixture"], { cwd })
  git(["config", "user.email", "ci@example.test"], { cwd })
  const put = (path, content) => {
    mkdirSync(join(cwd, path, ".."), { recursive: true })
    writeFileSync(join(cwd, path), content)
  }
  const commit = () => {
    git(["add", "--all"], { cwd })
    git(["-c", "core.hooksPath=/dev/null", "commit", "-qm", "fixture"], { cwd })
    return git(["rev-parse", "HEAD"], { cwd }).trim()
  }
  return { cwd, put, commit }
}

test("no deployment requires the entire difference from actual production to be documentation", (t) => {
  const fixture = repository(t)
  fixture.put("docs/operations/a.md", "# A\n")
  fixture.put("app/runtime.ts", "export const value = 1\n")
  const deployed = fixture.commit()
  fixture.put("docs/operations/a.md", "# B\n")
  const candidateRevision = fixture.commit()
  const expected = {
    repository: "lapeninns/nabaperks",
    runId: "42",
    attempt: 2,
    candidateRevision,
    projectId: "prj_example",
    teamId: "team_example",
  }
  const baseline = {
    schema: "nabaperks.production-baseline.v1",
    deploymentId: "dpl_example",
    projectId: expected.projectId,
    teamId: expected.teamId,
    revision: deployed,
    url: "https://candidate-example.vercel.app",
    target: "production",
    observedAt: "2026-09-10T18:00:00Z",
  }
  const artifact = createNoDeployment(baseline, expected, fixture)
  assert.equal(artifact.outcome, "not-required")
  assert.equal(
    validateNoDeployment(artifact, expected, fixture).revision,
    deployed
  )
  for (const patch of [
    { changeDigest: "a".repeat(64) },
    { candidateRevision: deployed },
    { releaseRunAttempt: 1 },
    { paths: [] },
    { outcome: "success" },
    { repository: "fork/nabaperks" },
  ])
    assert.throws(() =>
      validateNoDeployment({ ...artifact, ...patch }, expected, fixture)
    )
  assert.throws(() =>
    validateNoDeployment(
      artifact,
      { ...expected, projectId: "prj_other" },
      fixture
    )
  )
  fixture.put("app/runtime.ts", "export const value = 2\n")
  const pendingRuntime = fixture.commit()
  fixture.put("docs/operations/a.md", "# C\n")
  const docsOnTop = fixture.commit()
  assert.equal(
    calculateImpact(pendingRuntime, docsOnTop, fixture).profile,
    "documentation"
  )
  assert.equal(
    createNoDeployment(
      baseline,
      { ...expected, candidateRevision: docsOnTop },
      fixture
    ),
    null
  )
  git(["rm", "docs/operations/a.md"], fixture)
  assert.equal(
    createNoDeployment(
      baseline,
      { ...expected, candidateRevision: fixture.commit() },
      fixture
    ),
    null
  )
})

test("real Git comparison includes both sides of moves and does not read dirty working files", (t) => {
  const fixture = repository(t)
  fixture.put("app/about/page.tsx", before)
  fixture.put("docs/operations/a.md", "# A\n")
  const base = fixture.commit()
  fixture.put("app/about/page.tsx", copy)
  const candidate = fixture.commit()
  fixture.put("app/about/page.tsx", "malformed dirty work")
  const result = calculateImpact(base, candidate, fixture)
  assert.equal(result.profile, "public-pages")
  assert.equal(result.changes.length, 1)
  git(["restore", "app/about/page.tsx"], fixture)
  git(["mv", "docs/operations/a.md", "docs/operations/b.md"], fixture)
  const renamed = fixture.commit()
  assert.deepEqual(
    readChanges(candidate, renamed, fixture)
      .map((entry) => entry.status)
      .sort(),
    ["A", "D"]
  )
  assert.equal(calculateImpact(candidate, renamed, fixture).profile, "full")
})

test("consumer proof recognises re-exports and dynamic imports, and refuses computed imports", (t) => {
  const fixture = repository(t)
  fixture.put("app/about/page.tsx", before)
  fixture.put("lib/consumer.ts", 'export { default } from "@/app/about/page"\n')
  let sha = fixture.commit()
  assert.deepEqual(findPageConsumers(sha, ["app/about/page.tsx"], fixture), [
    "lib/consumer.ts",
  ])
  fixture.put(
    "lib/consumer.ts",
    'export const load = () => import("../app/about/page.tsx")\n'
  )
  sha = fixture.commit()
  assert.deepEqual(findPageConsumers(sha, ["app/about/page.tsx"], fixture), [
    "lib/consumer.ts",
  ])
  fixture.put(
    "lib/consumer.ts",
    "export const load = (path: string) => import(path)\n"
  )
  sha = fixture.commit()
  assert.throws(
    () => findPageConsumers(sha, ["app/about/page.tsx"], fixture),
    /Computed imports/
  )
})

const identity = {
  repository: "lapeninns/nabaperks",
  event: "pull_request",
  baseSha: "a".repeat(40),
  headSha: "b".repeat(40),
  candidateSha: "c".repeat(40),
}
function evidenceFor(profile, comparisonRequired = false) {
  const plan = fullPlan(identity, "Fixture policy decision", comparisonRequired)
  plan.profile = profile
  if (profile === "documentation") {
    plan.required = ["documentation"]
    plan.changes = [change("docs/operations/a.md")]
    plan.changeDigest = "d".repeat(64)
    plan.policyDigest = "e".repeat(64)
  }
  return {
    selection: { result: "success", outputs: { plan: JSON.stringify(plan) } },
    ...Object.fromEntries(
      ALL_WORKLOADS.map((job) => [
        job,
        {
          result:
            plan.required.includes(job) ||
            (comparisonRequired &&
              ["documentation", "targeted-browser", "targeted-visual"].includes(
                job
              ))
              ? "success"
              : "skipped",
        },
      ])
    ),
    "selection-comparison": {
      result: comparisonRequired ? "success" : "skipped",
    },
  }
}

test("required evidence distinguishes justified non-execution from success", () => {
  assert.match(
    verifyImpactEvidence(evidenceFor("documentation"), identity),
    /db: not required \(not executed\)/
  )
  assert.match(
    verifyImpactEvidence(evidenceFor("full"), identity),
    /db: passed/
  )
  assert.match(
    verifyImpactEvidence(evidenceFor("full", true), identity),
    /targeted-visual: passed/
  )
  const unexpected = evidenceFor("documentation")
  unexpected.db.result = "success"
  assert.throws(
    () => verifyImpactEvidence(unexpected, identity),
    /explicitly not required/
  )
})

test("every required job rejects missing, skipped, cancelled or failed proof", () => {
  for (const profile of ["full", "documentation"]) {
    const good = evidenceFor(profile, profile === "full")
    for (const name of Object.keys(good).filter(
      (key) => good[key].result === "success"
    )) {
      for (const result of [
        "failure",
        "cancelled",
        "skipped",
        undefined,
        "neutral",
      ]) {
        const bad = structuredClone(good)
        bad[name].result = result
        assert.throws(
          () => verifyImpactEvidence(bad, identity),
          undefined,
          `${name}: ${result}`
        )
      }
      const bad = structuredClone(good)
      delete bad[name]
      assert.throws(
        () => verifyImpactEvidence(bad, identity),
        /missing CI jobs/
      )
    }
  }
})

test("stale identities, changed profile requirements and a selective main run never pass", () => {
  const good = evidenceFor("documentation")
  for (const field of [
    "baseSha",
    "headSha",
    "candidateSha",
    "repository",
    "event",
  ])
    assert.throws(
      () => verifyImpactEvidence(good, { ...identity, [field]: "other" }),
      /another candidate/
    )
  const changed = structuredClone(good)
  const plan = JSON.parse(changed.selection.outputs.plan)
  plan.required = []
  changed.selection.outputs.plan = JSON.stringify(plan)
  assert.throws(
    () => verifyImpactEvidence(changed, identity),
    /Required checks/
  )
  plan.required = ["documentation"]
  plan.identity.event = "push"
  changed.selection.outputs.plan = JSON.stringify(plan)
  assert.throws(
    () => verifyImpactEvidence(changed, plan.identity),
    /complete main CI/
  )
  assert.throws(() => expectedIdentity({}), /repository/)
})

test("the planner verifies the real merge parents and uses the already reviewed base", (t) => {
  const fixture = repository(t)
  fixture.put("docs/operations/a.md", "# A\n")
  const baseSha = fixture.commit()
  git(["switch", "-qc", "change"], fixture)
  fixture.put("docs/operations/a.md", "# B\n")
  const headSha = fixture.commit()
  git(["switch", "-q", "main"], fixture)
  git(
    [
      "-c",
      "core.hooksPath=/dev/null",
      "merge",
      "--no-ff",
      "--no-edit",
      "change",
    ],
    fixture
  )
  const candidateSha = git(["rev-parse", "HEAD"], fixture).trim()
  git(["checkout", "--detach", "-q", baseSha], fixture)
  const env = {
    GITHUB_REPOSITORY: identity.repository,
    GITHUB_EVENT_NAME: "pull_request",
    CI_BASE_SHA: baseSha,
    CI_HEAD_SHA: headSha,
    GITHUB_SHA: candidateSha,
    CI_HEAD_REPOSITORY: identity.repository,
  }
  assert.equal(planChecks(env, fixture).profile, "documentation")
  assert.equal(
    planChecks({ ...env, CI_HEAD_REPOSITORY: "external/fork" }, fixture)
      .profile,
    "full"
  )
  assert.throws(
    () => planChecks({ ...env, CI_HEAD_SHA: baseSha }, fixture),
    /merge candidate/
  )
  git(["checkout", "--detach", "-q", candidateSha], fixture)
  assert.throws(() => planChecks(env, fixture), /trusted policy/)
  const main = planChecks(
    {
      ...env,
      GITHUB_EVENT_NAME: "push",
      CI_HEAD_SHA: candidateSha,
      GITHUB_REF: "refs/heads/main",
    },
    fixture
  )
  assert.equal(main.profile, "full")
})
