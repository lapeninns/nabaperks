import assert from "node:assert/strict"
import { test } from "node:test"
import {
  INSTALLED_REVISION_EXIT_CODES,
  classifyInstalledRevision,
  currentLinkPath,
  inspectInstalledRevision,
  localCiContract,
  parseCommitLog,
  touchesExecutionSurface,
} from "../../scripts/ci/check-installed-revision.mjs"

const INSTALLED = "aed95ca9b33eacbe79c7a4b2808976649b2502c6"
const REFERENCE = "d5f5c36417efd114117ca75eb5e7866b9a7ac06d"
const UNMERGED = "0123456789abcdef0123456789abcdef01234567"
const INSTALL_ROOT = "/opt/nabaperks-local-ci"
const CURRENT_LINK = "/opt/nabaperks-local-ci/current"

const encodeLog = (commits) =>
  commits
    .map(
      ({ sha, subject, paths }) =>
        `\0${sha}\x1f${subject}\n\n${paths.join("\n")}\n`
    )
    .join("")

const fakeGit = ({
  reference = REFERENCE,
  ancestor = true,
  known = true,
  behind = [],
  ahead = [],
} = {}) => {
  const calls = []
  const git = (args) => {
    calls.push(args.join(" "))
    if (args[0] === "rev-parse") return { status: 0, stdout: `${reference}\n` }
    if (args[0] === "cat-file") return { status: known ? 0 : 128, stdout: "" }
    if (args[0] === "merge-base")
      return { status: ancestor ? 0 : 1, stdout: "" }
    if (args[0] === "log")
      return {
        status: 0,
        stdout: encodeLog(args[3].startsWith(reference) ? ahead : behind),
      }
    throw new Error(`Unexpected git invocation: ${args.join(" ")}`)
  }
  return { git, calls }
}

const inspect = (options = {}, gitOptions = {}) => {
  const { git, calls } = fakeGit(gitOptions)
  const report = inspectInstalledRevision({
    installRoot: INSTALL_ROOT,
    git,
    readLink: () => `${INSTALL_ROOT}/releases/${INSTALLED}`,
    exists: () => true,
    ...options,
  })
  return { report, calls }
}

test("the install root default comes from the contract, not a hard-coded path", () => {
  assert.equal(localCiContract.agent.installRoot, CURRENT_LINK)
  assert.equal(currentLinkPath(INSTALL_ROOT), CURRENT_LINK)
  assert.equal(currentLinkPath(CURRENT_LINK), CURRENT_LINK)
  assert.equal(currentLinkPath("/srv/local-ci"), "/srv/local-ci/current")
})

test("the execution surface covers the agent, its config and the proof checkers", () => {
  for (const path of [
    "ops/local-ci/agent/dispatch.mjs",
    "ops/local-ci/profiles/pr.json",
    "scripts/ci/run-workload.mjs",
    "config/local-ci-contract.json",
    "config/ci-workloads.json",
    "config/local-ci-image-manifest.json",
    "scripts/check-local-ci-proof.mjs",
    "scripts/check-nightly-proof.mjs",
  ])
    assert.equal(touchesExecutionSurface(path), true, path)
  for (const path of [
    "ops/factory/github.mjs",
    "scripts/check-env.mjs",
    "config/env-contract.json",
    "docs/operations/production-runbook.md",
    "lib/notifications/resend.ts",
    "tests/unit/ci-workloads.test.mjs",
    "opsx/local-ci/agent.mjs",
  ])
    assert.equal(touchesExecutionSurface(path), false, path)
})

test("the commit log parser keeps subjects apart from changed paths", () => {
  assert.deepEqual(
    parseCommitLog(
      encodeLog([
        { sha: INSTALLED, subject: "Ship a thing (#1)", paths: ["a.ts"] },
        { sha: REFERENCE, subject: "", paths: [] },
      ])
    ),
    [
      { sha: INSTALLED, subject: "Ship a thing (#1)", paths: ["a.ts"] },
      { sha: REFERENCE, subject: "", paths: [] },
    ]
  )
  assert.deepEqual(parseCommitLog(""), [])
})

test("an install at the reference revision reports a match and exits zero", () => {
  const { report } = inspect(
    { readLink: () => `${INSTALL_ROOT}/releases/${REFERENCE}` },
    { ancestor: true }
  )
  assert.equal(report.status, "matched")
  assert.equal(report.exitCode, 0)
  assert.equal(report.installedRevision, REFERENCE)
  assert.deepEqual(report.reference, {
    name: "origin/main",
    revision: REFERENCE,
  })
  assert.deepEqual(report.executionSurfaceCommits, [])
  assert.match(report.summary, /matches origin\/main d5f5c3641\./)
})

test("drift that misses the execution surface is informational and exits zero", () => {
  const { report } = inspect(
    {},
    {
      behind: [
        {
          sha: REFERENCE,
          subject: "Bind production deployment credentials (#293)",
          paths: ["config/env-contract.json", "lib/notifications/resend.ts"],
        },
        {
          sha: UNMERGED,
          subject: "Give the guide routes the hub's section spine (#277)",
          paths: ["components/marketing/guides/guide-page.tsx"],
        },
      ],
    }
  )
  assert.equal(report.status, "informational-drift")
  assert.equal(report.exitCode, 0)
  assert.equal(report.behindCount, 2)
  assert.equal(report.aheadCount, 0)
  assert.deepEqual(report.executionSurfaceCommits, [])
  assert.match(report.summary, /2 behind, 0 ahead of origin\/main d5f5c3641/)
  assert.match(report.summary, /no execution-surface drift/)
})

test("execution-surface drift fails closed and names the commits and paths", () => {
  const { report } = inspect(
    {},
    {
      behind: [
        {
          sha: REFERENCE,
          subject: "Retune the lane scheduler (#293)",
          paths: [
            "docs/operations/production-runbook.md",
            "ops/local-ci/agent/scheduler.mjs",
          ],
        },
        {
          sha: UNMERGED,
          subject: "Unrelated marketing copy (#277)",
          paths: ["components/marketing/guides/guide-page.tsx"],
        },
      ],
    }
  )
  assert.equal(report.status, "execution-surface-drift")
  assert.equal(report.exitCode, 3)
  assert.notEqual(report.exitCode, 0)
  assert.deepEqual(report.executionSurfaceCommits, [
    {
      sha: REFERENCE,
      subject: "Retune the lane scheduler (#293)",
      paths: ["ops/local-ci/agent/scheduler.mjs"],
    },
  ])
  assert.match(report.summary, /ops\/local-ci\/agent\/scheduler\.mjs/)
  assert.doesNotMatch(report.summary, /guide-page\.tsx/)
})

test("execution-surface drift ahead of the reference is material too", () => {
  const { report } = inspect(
    {},
    {
      ancestor: true,
      ahead: [
        {
          sha: UNMERGED,
          subject: "Local tweak to the contract",
          paths: ["config/local-ci-contract.json"],
        },
      ],
    }
  )
  assert.equal(report.status, "execution-surface-drift")
  assert.equal(report.exitCode, 3)
  assert.equal(report.aheadCount, 1)
})

test("a missing install root or symlink fails closed without reading git", () => {
  for (const [exists, reason] of [
    [() => false, "missing-current-link"],
    [() => true, "current-is-not-a-symlink"],
  ]) {
    const { report, calls } = inspect({
      exists,
      readLink: () => {
        throw new Error("ENOENT")
      },
      git: () => {
        throw new Error("git must not run when the install is unreadable")
      },
    })
    assert.equal(report.status, "install-unavailable")
    assert.equal(report.exitCode, 2)
    assert.equal(report.reason, reason)
    assert.equal(report.currentLink, CURRENT_LINK)
    assert.deepEqual(calls, [])
    assert.match(report.summary, /unreadable/)
  }
})

test("a release directory that is not a commit SHA cannot be attributed", () => {
  const { report } = inspect({
    readLink: () => `${INSTALL_ROOT}/releases/hotfix-by-hand`,
  })
  assert.equal(report.status, "install-unavailable")
  assert.equal(report.exitCode, 2)
  assert.equal(report.reason, "unrecognised-release-name")
})

test("an install that is not an ancestor of the reference is unreviewed", () => {
  const { report } = inspect(
    {},
    {
      ancestor: false,
      behind: [
        { sha: REFERENCE, subject: "Reviewed work (#293)", paths: ["a.ts"] },
      ],
      ahead: [{ sha: UNMERGED, subject: "Never reviewed", paths: ["b.ts"] }],
    }
  )
  assert.equal(report.status, "unreviewed-install")
  assert.equal(report.exitCode, 4)
  assert.notEqual(
    report.exitCode,
    INSTALLED_REVISION_EXIT_CODES["informational-drift"]
  )
  assert.notEqual(
    report.exitCode,
    INSTALLED_REVISION_EXIT_CODES["execution-surface-drift"]
  )
  assert.equal(report.behindCount, 1)
  assert.equal(report.aheadCount, 1)
  assert.match(report.summary, /NOT an ancestor of origin\/main d5f5c3641/)
  assert.match(report.summary, /not a reviewed main commit/)
})

test("an installed revision git has never seen is unreviewed, not a crash", () => {
  const { report } = inspect({}, { known: false })
  assert.equal(report.status, "unreviewed-install")
  assert.equal(report.exitCode, 4)
  assert.equal(report.reason, "unknown-revision")
  assert.equal(report.behindCount, 0)
})

test("the reference is configurable and must resolve to a full commit SHA", () => {
  const { report, calls } = inspect(
    { reference: "upstream/main" },
    { behind: [] }
  )
  assert.equal(report.reference.name, "upstream/main")
  assert.ok(calls.includes("rev-parse upstream/main"))
  assert.throws(
    () => inspect({}, { reference: "origin/main\n" }).report,
    /did not resolve to a commit SHA/
  )
})

test("classification rejects malformed revisions rather than guessing", () => {
  for (const input of [
    { installedRevision: "abc", reference: { name: "m", revision: REFERENCE } },
    { installedRevision: INSTALLED, reference: { name: "m", revision: "xyz" } },
    { installedRevision: INSTALLED, reference: { revision: REFERENCE } },
    { installedRevision: undefined, reference: null },
  ])
    assert.throws(() => classifyInstalledRevision({ ...input, ancestor: true }))
})
