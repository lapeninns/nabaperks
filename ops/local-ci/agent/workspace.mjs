/**
 * The workspace scripts both runtimes run, moved here from main.mjs unchanged.
 *
 * The Lima runtime hands them to `/bin/sh` inside the VM; the Docker Desktop
 * runtime hands them to a short-lived helper container that mounts the state
 * volume at the same path. Either way the text is the same, so one review of
 * these builders covers both.
 */

import { isCommitSha } from "../core/queue.mjs"

/**
 * Quote one value for POSIX `sh`.
 *
 * The scripts below are assembled as text and handed to `/bin/sh -c`, so every
 * interpolated value is shell syntax until it is quoted. The inputs are not
 * arbitrary - a head SHA is validated as 40 hex, a lane id comes from a
 * reviewed profile - but "currently well-formed" is not a security boundary:
 * this agent exists to run pull-request code, and the remote URL, the
 * workspace root and the VM name all reach here from a contract file or the
 * environment. Quoting at the seam means a future caller cannot turn a value
 * into a command by accident.
 *
 * Single quotes are literal in `sh` for every character except the single
 * quote itself, which is closed, escaped and reopened.
 */
export function shQuote(value) {
  const text = String(value)
  if (text === "") return "''"
  return `'${text.replace(/'/g, `'\\''`)}'`
}

/** Build a self-contained checkout: no Git paths or object hardlinks escape it. */
export function buildWorkspacePreparationScript({ root, remoteUrl, headSha }) {
  const mirror = `${root}/repo`
  const workspace = `${root}/runs/${headSha}`
  return [
    "set -eu",
    `mkdir -p ${shQuote(`${root}/runs`)}`,
    `if [ ! -d ${shQuote(`${mirror}/.git`)} ]; then git clone ${shQuote(remoteUrl)} ${shQuote(mirror)}; fi`,
    `cd ${shQuote(mirror)}`,
    `git remote set-url origin ${shQuote(remoteUrl)}`,
    'if [ "$(git rev-parse --is-shallow-repository)" = "true" ]; then git fetch --unshallow origin; fi',
    "git fetch --prune --tags origin '+refs/heads/*:refs/remotes/origin/*'",
    `git fetch origin ${shQuote(headSha)}`,
    `git worktree remove --force ${shQuote(workspace)} 2>/dev/null || true`,
    `rm -rf ${shQuote(workspace)} ${shQuote(`${workspace}-lanes`)}`,
    `git clone --no-hardlinks --no-checkout ${shQuote(mirror)} ${shQuote(workspace)}`,
    `git -C ${shQuote(workspace)} remote set-url origin ${shQuote(remoteUrl)}`,
    `git -C ${shQuote(workspace)} fetch --no-tags ${shQuote(mirror)} ${shQuote(headSha)}`,
    `git -C ${shQuote(workspace)} checkout --detach ${shQuote(headSha)}`,
  ].join("\n")
}

/** Each lane owns its Git metadata, dependencies, caches and generated files. */
export function buildLaneWorkspaceScript({
  workspace,
  laneId,
  headSha,
  remoteUrl,
}) {
  if (!isCommitSha(headSha) || !/^[a-z][a-z0-9-]*$/.test(laneId))
    throw new Error("Invalid lane workspace identity")
  if (!workspace.endsWith(`/runs/${headSha}`))
    throw new Error("Lane workspace must belong to the exact run")
  const destination = `${workspace}-lanes/${laneId}`
  return {
    destination,
    script: [
      "set -eu",
      `mkdir -p ${shQuote(`${workspace}-lanes`)}`,
      // git clone refuses an existing directory with content; no candidate
      // workspace is reused, and --no-hardlinks prevents cross-lane mutation.
      `git clone --no-hardlinks --no-checkout ${shQuote(workspace)} ${shQuote(destination)}`,
      `git -C ${shQuote(destination)} remote set-url origin ${shQuote(remoteUrl)}`,
      `git -C ${shQuote(destination)} checkout --detach ${shQuote(headSha)}`,
    ].join("\n"),
  }
}
