import { readFileSync, realpathSync, statSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"

export const INSTALLED_REQUIRED_FILES = [
  "ops/local-ci/agent/main.mjs",
  "config/local-ci-contract.json",
  "package.json",
]
export const JOB_IMAGE_INPUTS = [
  "ops/local-ci/image/",
  ".nvmrc",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "patches/",
  "config/local-ci-image-manifest.json",
]

export function inspectReleaseFiles({
  currentLink,
  target,
  realpath = realpathSync,
  stat = statSync,
}) {
  const directory = realpath(resolve(dirname(currentLink), target))
  if (
    !stat(directory).isDirectory() ||
    basename(directory) !== basename(target)
  ) {
    throw new Error(
      "The installed release target is not the named revision directory"
    )
  }
  for (const file of INSTALLED_REQUIRED_FILES) {
    if (!stat(join(directory, file)).isFile()) {
      throw new Error(`The installed release is missing ${file}`)
    }
  }
  return directory
}

/** Compare the image's declared build inputs; this does not attest image bytes. */
export function inspectJobImage({
  currentLink,
  referenceRevision,
  git,
  readText = readFileSync,
}) {
  const path = join(dirname(currentLink), "job-image")
  const pin = readText(path, "utf8").trim()
  const match = /^nabaperks-ci-job:([a-f0-9]{40})$/.exec(pin)
  if (!match)
    throw new Error("The job image pin has no attributable full build revision")
  const sourceRevision = match[1]
  const ancestor = git([
    "merge-base",
    "--is-ancestor",
    sourceRevision,
    referenceRevision,
  ])
  if (ancestor.status !== 0)
    throw new Error("The job image build revision is not reviewed main history")
  const diff = git([
    "diff",
    "--name-only",
    sourceRevision,
    referenceRevision,
    "--",
    ...JOB_IMAGE_INPUTS,
  ])
  if (diff.status !== 0)
    throw new Error("Cannot compare the pinned job image build inputs")
  const changedPaths = diff.stdout.trim().split("\n").filter(Boolean)
  return {
    pin,
    sourceRevision,
    status: changedPaths.length
      ? "image-source-drift"
      : "compatible-image-source",
    changedPaths,
    attestation:
      "Build-source comparison only; image contents are not attested",
  }
}
