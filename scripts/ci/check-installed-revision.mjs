import { spawnSync } from "node:child_process"
import { existsSync, readFileSync, readlinkSync } from "node:fs"
import { basename, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

export const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url))

export const localCiContract = JSON.parse(
  readFileSync(
    new URL("../../config/local-ci-contract.json", import.meta.url),
    "utf8"
  )
)

export const DEFAULT_REFERENCE = "origin/main"

// Everything a drifted install could execute differently: the agent itself, the
// contract and workload definitions it reads, the CI entrypoints it invokes and
// the proof checkers that judge its output. Drift anywhere else changes what is
// tested, not how the local plane behaves, so it cannot invalidate an attribution.
export const EXECUTION_SURFACE_PREFIXES = Object.freeze([
  "ops/local-ci/",
  "scripts/ci/",
])
export const EXECUTION_SURFACE_FILES = Object.freeze([
  "config/local-ci-contract.json",
  "config/ci-workloads.json",
  "config/local-ci-image-manifest.json",
])
export const EXECUTION_SURFACE_PATTERN = /^scripts\/check-[^/]*proof[^/]*\.mjs$/

// Fail-closed by construction: only a match and drift that provably misses the
// execution surface exit 0. An unreviewed install is the most serious outcome
// and keeps its own code so an operator can page on it separately from staleness.
export const INSTALLED_REVISION_EXIT_CODES = Object.freeze({
  matched: 0,
  "informational-drift": 0,
  "install-unavailable": 2,
  "execution-surface-drift": 3,
  "unreviewed-install": 4,
})

const REVISION_PATTERN = /^[a-f0-9]{40}$/

export function touchesExecutionSurface(path) {
  return (
    EXECUTION_SURFACE_FILES.includes(path) ||
    EXECUTION_SURFACE_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
    EXECUTION_SURFACE_PATTERN.test(path)
  )
}

// The contract pins the symlink path itself; an operator naturally passes the
// directory that holds it. Accept either rather than adding a second config key.
export function currentLinkPath(installRoot) {
  return basename(installRoot) === "current"
    ? installRoot
    : join(installRoot, "current")
}

/** Parse `git log --name-only --format=format:%x00%H%x1f%s` into records. The
 * NUL record separator and unit separator keep subjects containing newlines or
 * spaces from being mistaken for changed paths. */
export function parseCommitLog(stdout) {
  return stdout
    .split("\0")
    .slice(1)
    .map((record) => {
      const [header, ...rest] = record.split("\n")
      const [sha, subject = ""] = header.split("\x1f")
      return { sha, subject, paths: rest.filter(Boolean) }
    })
}

export function runGit(args, cwd = REPO_ROOT) {
  const result = spawnSync("git", ["-C", cwd, ...args], {
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 32 * 1024 * 1024,
  })
  if (result.error || result.signal)
    throw new Error(`Unable to run git ${args[0]}`)
  return { status: result.status, stdout: result.stdout ?? "" }
}

function gitOutput(git, args) {
  const { status, stdout } = git(args)
  if (status !== 0) throw new Error(`git ${args.join(" ")} failed`)
  return stdout
}

function materialise(commits) {
  return commits
    .map((commit) => ({
      ...commit,
      paths: commit.paths.filter(touchesExecutionSurface),
    }))
    .filter((commit) => commit.paths.length > 0)
}

function describe(revision) {
  return revision.slice(0, 9)
}

/** Pure comparison. `behind` are commits in the reference but not the install,
 * `ahead` the reverse; each carries every path it changed so the caller never
 * has to pre-filter with a git pathspec it could get subtly wrong. */
export function classifyInstalledRevision({
  installedRevision,
  reference,
  ancestor,
  behind = [],
  ahead = [],
}) {
  if (!REVISION_PATTERN.test(installedRevision ?? ""))
    throw new Error("Installed revision must be a full commit SHA")
  if (!REVISION_PATTERN.test(reference?.revision ?? "") || !reference.name)
    throw new Error("Reference must be a named full commit SHA")
  const executionSurfaceCommits = materialise([...behind, ...ahead])
  const status = !ancestor
    ? "unreviewed-install"
    : installedRevision === reference.revision
      ? "matched"
      : executionSurfaceCommits.length
        ? "execution-surface-drift"
        : "informational-drift"
  const report = {
    schema: "nabaperks.installed-revision.v1",
    status,
    exitCode: INSTALLED_REVISION_EXIT_CODES[status],
    installedRevision,
    reference,
    behindCount: behind.length,
    aheadCount: ahead.length,
    executionSurfaceCommits,
  }
  return { ...report, summary: renderInstalledRevisionSummary(report) }
}

export function renderInstalledRevisionSummary(report) {
  if (report.status === "install-unavailable")
    return `Local CI install is unreadable (${report.reason}): ${report.detail}`
  const installed = describe(report.installedRevision)
  const against = `${report.reference.name} ${describe(report.reference.revision)}`
  if (report.status === "matched")
    return `Local CI install ${installed} matches ${against}.`
  const distance = `${report.behindCount} behind, ${report.aheadCount} ahead of`
  if (report.status === "unreviewed-install")
    return `Local CI install ${installed} is NOT an ancestor of ${against} (${distance} it); the host is running code that is not a reviewed main commit.`
  const drift = `Local CI install ${installed} is ${distance} ${against}`
  if (report.status === "informational-drift")
    return `${drift}; no execution-surface drift, so results remain attributable.`
  return `${drift}, and ${report.executionSurfaceCommits.length} of those commits change the local-CI execution surface:\n${report.executionSurfaceCommits
    .map(
      (commit) =>
        `  ${describe(commit.sha)} ${commit.subject}\n${commit.paths.map((path) => `    ${path}`).join("\n")}`
    )
    .join("\n")}`
}

function unavailable(installRoot, currentLink, reason, detail) {
  const report = {
    schema: "nabaperks.installed-revision.v1",
    status: "install-unavailable",
    exitCode: INSTALLED_REVISION_EXIT_CODES["install-unavailable"],
    installRoot,
    currentLink,
    reason,
    detail,
  }
  return { ...report, summary: renderInstalledRevisionSummary(report) }
}

/** Read-only inspection. Nothing here writes to the install root, touches a
 * service or mutates git state; the only git calls are rev-parse, rev-list,
 * merge-base and log. */
export function inspectInstalledRevision({
  installRoot = localCiContract.agent.installRoot,
  reference = DEFAULT_REFERENCE,
  git = runGit,
  readLink = readlinkSync,
  exists = existsSync,
} = {}) {
  const currentLink = currentLinkPath(installRoot)
  let target
  try {
    target = readLink(currentLink)
  } catch {
    return unavailable(
      installRoot,
      currentLink,
      exists(currentLink) ? "current-is-not-a-symlink" : "missing-current-link",
      `No readable 'current' symlink at ${currentLink}`
    )
  }
  const installedRevision = basename(target)
  if (!REVISION_PATTERN.test(installedRevision))
    return unavailable(
      installRoot,
      currentLink,
      "unrecognised-release-name",
      `'current' points at ${target}, whose basename is not a commit SHA`
    )
  const referenceRevision = gitOutput(git, ["rev-parse", reference]).trim()
  if (!REVISION_PATTERN.test(referenceRevision))
    throw new Error(`Reference ${reference} did not resolve to a commit SHA`)
  const named = { name: reference, revision: referenceRevision }
  // An install whose revision is not even an object here cannot be attributed to
  // any reviewed commit, which is the unreviewed case rather than a git error.
  if (git(["cat-file", "-e", `${installedRevision}^{commit}`]).status !== 0)
    return {
      installRoot,
      currentLink,
      ...classifyInstalledRevision({
        installedRevision,
        reference: named,
        ancestor: false,
      }),
      reason: "unknown-revision",
    }
  const range = (from, to) =>
    parseCommitLog(
      gitOutput(git, [
        "log",
        "--name-only",
        "--format=format:%x00%H%x1f%s",
        `${from}..${to}`,
      ])
    )
  return {
    installRoot,
    currentLink,
    ...classifyInstalledRevision({
      installedRevision,
      reference: named,
      ancestor:
        git([
          "merge-base",
          "--is-ancestor",
          installedRevision,
          referenceRevision,
        ]).status === 0,
      behind: range(installedRevision, referenceRevision),
      ahead: range(referenceRevision, installedRevision),
    }),
  }
}

export function main(args = process.argv.slice(2), env = process.env) {
  const options = {
    installRoot: env.LOCAL_CI_INSTALL_ROOT,
    reference: env.LOCAL_CI_REVISION_REFERENCE,
  }
  let json = false
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--json") json = true
    else if (args[index] === "--install-root")
      options.installRoot = args[++index]
    else if (args[index] === "--reference") options.reference = args[++index]
    else
      throw new Error(
        "Usage: check-installed-revision.mjs [--install-root <path>] [--reference <rev>] [--json]"
      )
  }
  const report = inspectInstalledRevision({
    ...(options.installRoot ? { installRoot: options.installRoot } : {}),
    ...(options.reference ? { reference: options.reference } : {}),
  })
  console.log(json ? JSON.stringify(report, null, 2) : report.summary)
  return report
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = main().exitCode
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
