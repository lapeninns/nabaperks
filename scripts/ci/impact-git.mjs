import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"

export const FULL_SHA = /^[a-f0-9]{40}$/

export function isToolingSourcePath(path) {
  return (
    /^(?:\.design-sync|\.github|\.husky|ops|scripts|supabase|tests)(?:\/|$)/.test(
      path
    ) ||
    /^(?:eslint|playwright|postcss|stryker)\.config(?:\.[cm]?[jt]s)?$/.test(
      path
    )
  )
}

export function git(
  args,
  { cwd = process.cwd(), encoding = "utf8", input } = {}
) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([name]) =>
        !name.startsWith("GIT_") ||
        [
          "GIT_AUTHOR_NAME",
          "GIT_AUTHOR_EMAIL",
          "GIT_COMMITTER_NAME",
          "GIT_COMMITTER_EMAIL",
        ].includes(name)
    )
  )
  return execFileSync("git", ["--no-replace-objects", ...args], {
    cwd,
    env: {
      ...env,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null",
      GIT_GRAFT_FILE: "/dev/null",
    },
    encoding,
    input,
    maxBuffer: 32 * 1024 * 1024,
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
  })
}

export function readSourceTree(sha, { cwd } = {}) {
  requireCommit(sha, cwd)
  const entries = git(["ls-tree", "-r", "-z", sha], { cwd })
    .split("\0")
    .filter(Boolean)
    .map((entry) => {
      const match = /^(\d{6}) (blob|tree|commit) ([a-f0-9]{40})\t(.+)$/.exec(
        entry
      )
      if (!match) throw new Error("Unsupported source tree entry")
      return { mode: match[1], type: match[2], oid: match[3], path: match[4] }
    })
  if (
    entries.some(
      (entry) =>
        !isToolingSourcePath(entry.path) &&
        ["120000", "160000"].includes(entry.mode)
    )
  )
    throw new Error(
      "Application symlinks or submodules make source consumers uncertain"
    )
  const sources = entries.filter(
    (entry) =>
      /\.[cm]?[jt]sx?$/.test(entry.path) && !isToolingSourcePath(entry.path)
  )
  if (!sources.length) return []
  if (
    sources.some(
      (entry) =>
        entry.type !== "blob" ||
        entry.mode !== "100644" ||
        !safePath(entry.path)
    )
  )
    throw new Error("Source tree contains an unsupported file mode or path")
  // One bounded Git process, rather than several subprocesses per source file.
  const data = git(["cat-file", "--batch"], {
    cwd,
    encoding: null,
    input: sources.map((entry) => entry.oid).join("\n") + "\n",
  })
  let offset = 0
  return sources.map((entry, index) => {
    const end = data.indexOf(10, offset)
    const header = /^([a-f0-9]{40}) blob (\d+)$/.exec(
      data.subarray(offset, end).toString("ascii")
    )
    if (!header || header[1] !== entry.oid)
      throw new Error("Source batch identity mismatch")
    const size = Number(header[2])
    if (!Number.isSafeInteger(size) || size > 1024 * 1024)
      throw new Error("Source blob exceeds classification bound")
    const blob = data.subarray(end + 1, end + 1 + size)
    const text = blob.toString("utf8")
    offset = end + 1 + size + 1
    if (
      blob.length !== size ||
      data[offset - 1] !== 10 ||
      !Buffer.from(text).equals(blob) ||
      text.includes("\0") ||
      (index === sources.length - 1 && offset !== data.length)
    )
      throw new Error("Truncated or invalid source batch")
    return { path: entry.path, text }
  })
}

export function requireCommit(sha, cwd) {
  if (!FULL_SHA.test(sha ?? ""))
    throw new Error("An immutable full commit SHA is required")
  if (git(["rev-parse", "--verify", `${sha}^{commit}`], { cwd }).trim() !== sha)
    throw new Error("Commit identity did not resolve exactly")
  return sha
}

export function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

export function safePath(path) {
  return (
    typeof path === "string" &&
    /^[A-Za-z0-9_.()[\]/-]+$/.test(path) &&
    !path.startsWith("/") &&
    !path.split("/").some((part) => ["", ".", ".."].includes(part))
  )
}

// Git's raw, NUL-delimited records include modes and both blob identities.
// Disabling rename detection makes both sides of a move independently visible.
export function readChanges(baseSha, candidateSha, { cwd } = {}) {
  requireCommit(baseSha, cwd)
  requireCommit(candidateSha, cwd)
  const raw = git(
    [
      "diff",
      "--raw",
      "-z",
      "--no-renames",
      "--no-abbrev",
      baseSha,
      candidateSha,
      "--",
    ],
    { cwd }
  )
  const parts = raw.split("\0")
  if (parts.pop() !== "") throw new Error("Truncated Git change inventory")
  const changes = []
  for (let index = 0; index < parts.length; index += 2) {
    const match =
      /^:(\d{6}) (\d{6}) ([a-f0-9]{40}) ([a-f0-9]{40}) ([AMD])$/.exec(
        parts[index]
      )
    if (!match || !parts[index + 1])
      throw new Error("Unsupported Git change record")
    changes.push({
      path: parts[index + 1],
      oldMode: match[1],
      newMode: match[2],
      oldOid: match[3],
      newOid: match[4],
      status: match[5],
    })
  }
  return changes.sort((left, right) => left.path.localeCompare(right.path))
}

export function readBlob(oid, { cwd } = {}) {
  if (!FULL_SHA.test(oid) || /^0+$/.test(oid))
    throw new Error("A present blob identity is required")
  const size = Number(git(["cat-file", "-s", oid], { cwd }).trim())
  if (!Number.isSafeInteger(size) || size > 1024 * 1024)
    throw new Error("Source blob exceeds the classification bound")
  const buffer = git(["cat-file", "blob", oid], { cwd, encoding: null })
  const text = buffer.toString("utf8")
  if (!Buffer.from(text).equals(buffer) || text.includes("\0"))
    throw new Error("Source blob is not UTF-8 text")
  return text
}

export function readAt(sha, path, { cwd } = {}) {
  requireCommit(sha, cwd)
  if (!safePath(path)) throw new Error("Unsafe source path")
  const oid = git(["rev-parse", `${sha}:${path}`], { cwd }).trim()
  return readBlob(oid, { cwd })
}
