/** Refuse dispatch from a stale or unattributable installed execution surface. */
import { mkdtempSync, realpathSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { LocalCiError } from "../core/contract.mjs"
import { HOSTED_REPOSITORY } from "../core/hosted-identity.mjs"
import {
  currentLinkPath,
  inspectInstalledRevision,
  runGit,
} from "../../../scripts/ci/check-installed-revision.mjs"

const EXECUTING_ROOT = fileURLToPath(new URL("../../../", import.meta.url))

/** Installed releases are archives, with no .git. Fetch canonical main into
 * a disposable host reference, never a candidate checkout or a stale mirror.
 * This checks source attribution, not image contents or execution equivalence.
 */
export function inspectCurrentInstall({
  contract,
  inspect = inspectInstalledRevision,
}) {
  const root = mkdtempSync(join(tmpdir(), "nabaperks-ci-reference-"))
  const git = (args) => runGit(args, root)
  try {
    for (const args of [
      ["init", "--quiet"],
      [
        "fetch",
        "--quiet",
        "--no-tags",
        "--filter=blob:none",
        `https://github.com/${HOSTED_REPOSITORY}.git`,
        "+refs/heads/main:refs/remotes/origin/main",
      ],
    ]) {
      if (git(args).status !== 0)
        throw new Error(`Canonical reference git ${args[0]} failed`)
    }
    return inspect({ installRoot: contract.agent.installRoot, git })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

export function assertInstalledExecutionCurrent(
  { contract, logger },
  {
    inspect = inspectCurrentInstall,
    realpath = realpathSync,
    executingRoot = EXECUTING_ROOT,
  } = {}
) {
  let report
  try {
    const current = currentLinkPath(contract.agent.installRoot)
    if (realpath(executingRoot) !== realpath(current)) {
      throw new Error("Executing agent is not the installed current release")
    }
    report = inspect({ contract })
  } catch (error) {
    throw new LocalCiError(
      "INSTALLED_EXECUTION_UNAVAILABLE",
      `${error.message}; dispatch and qualification blocked`
    )
  }
  if (
    !["matched", "informational-drift"].includes(report.status) ||
    report.exitCode !== 0
  ) {
    throw new LocalCiError(
      "INSTALLED_EXECUTION_DRIFT",
      `${report.summary}; dispatch and qualification blocked`
    )
  }
  logger.info(
    `Installed execution preflight: ${report.status}; image contents are not attested`
  )
  return report
}
