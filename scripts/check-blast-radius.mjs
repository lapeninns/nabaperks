import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const FIELD_ALIASES = {
  declaredBlastRadius: [
    "Declared blast radius",
    "Blast radius",
    "Blast-radius",
  ],
  approvedExceptions: [
    "Approved blast-radius exceptions",
    "Approved exceptions",
  ],
}

const NONE_PATTERN = /^(?:none|n\/a|not applicable|no exceptions?)$/i

/**
 * @param {string} body
 * @returns {{ declaredBlastRadius: string[], approvedExceptions: string[] }}
 */
export function parseBlastRadiusPolicy(body = "") {
  return {
    declaredBlastRadius: parseFieldList(
      body,
      FIELD_ALIASES.declaredBlastRadius
    ),
    approvedExceptions: parseFieldList(body, FIELD_ALIASES.approvedExceptions),
  }
}

/**
 * @param {{ body?: string, changedFiles?: string[], eventName?: string }} [input]
 * @returns {{ skipped: boolean, diagnostics: string[] }}
 */
export function checkBlastRadius({
  body = "",
  changedFiles = [],
  eventName = "",
} = {}) {
  if (eventName !== "pull_request" && eventName !== "pull_request_target") {
    return {
      skipped: true,
      diagnostics: [],
    }
  }

  const diagnostics = []
  const policy = parseBlastRadiusPolicy(body)
  const sortedFiles = changedFiles
    .map((filePath) => filePath.trim())
    .filter(Boolean)
    .sort()

  if (policy.declaredBlastRadius.length === 0) {
    diagnostics.push(
      "PR body must declare at least one blast-radius path or glob."
    )
  }

  const outOfScope = sortedFiles.filter(
    (filePath) =>
      !matchesAnyPolicy(filePath, policy.declaredBlastRadius) &&
      !matchesAnyPolicy(filePath, policy.approvedExceptions)
  )

  for (const filePath of outOfScope) {
    diagnostics.push(
      `${filePath} is outside the declared blast radius and has no approved exception.`
    )
  }

  return {
    skipped: false,
    diagnostics: diagnostics.sort(),
  }
}

function parseFieldList(body, labels) {
  const lines = body.split(/\r?\n/)
  const values = []

  for (let index = 0; index < lines.length; index += 1) {
    const line = stripMarkdownComment(lines[index]).trim()
    if (!line) continue

    const label = labels.find((candidate) =>
      new RegExp(`^[-*\\s]*${escapeRegex(candidate)}\\s*:`, "i").test(line)
    )
    if (!label) continue

    const inlineValue = line.replace(
      new RegExp(`^[-*\\s]*${escapeRegex(label)}\\s*:`, "i"),
      ""
    )
    values.push(...splitPolicyValues(inlineValue))

    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = stripMarkdownComment(lines[nextIndex])
      const trimmed = nextLine.trim()
      if (!trimmed) continue
      if (/^##?\s+/.test(trimmed)) break
      if (/^[-*]\s+[^:]+:\s*/.test(trimmed)) break
      const bullet = trimmed.match(/^[-*]\s+(.+)$/)
      if (!bullet) break
      values.push(...splitPolicyValues(bullet[1]))
      index = nextIndex
    }
  }

  return [...new Set(values.filter((value) => !NONE_PATTERN.test(value)))]
}

function stripMarkdownComment(value) {
  return value.replace(/<!--.*?-->/g, "")
}

function splitPolicyValues(value) {
  return value
    .split(/[,;]/)
    .map((entry) => entry.trim().replace(/^`|`$/g, ""))
    .filter(Boolean)
}

function matchesAnyPolicy(filePath, policies) {
  return policies.some((policy) => matchesPolicy(filePath, policy))
}

function matchesPolicy(filePath, policy) {
  if (policy === filePath) return true
  if (policy.endsWith("/**")) return filePath.startsWith(policy.slice(0, -3))
  if (policy.endsWith("/*")) {
    const prefix = policy.slice(0, -1)
    const remainder = filePath.slice(prefix.length)
    return filePath.startsWith(prefix) && !remainder.includes("/")
  }
  if (policy.endsWith("*")) return filePath.startsWith(policy.slice(0, -1))
  if (policy.endsWith("/")) return filePath.startsWith(policy)
  return false
}

function getChangedFilesFromEnvironment() {
  if (process.env.GOVERNANCE_CHANGED_FILES) {
    return process.env.GOVERNANCE_CHANGED_FILES.split(/\r?\n|,/)
  }

  const baseRef = process.env.GITHUB_BASE_REF
  if (!baseRef) return []

  try {
    return execFileSync(
      "git",
      ["diff", "--name-only", `origin/${baseRef}...HEAD`],
      { encoding: "utf8" }
    ).split(/\r?\n/)
  } catch {
    return execFileSync("git", ["diff", "--name-only", `${baseRef}...HEAD`], {
      encoding: "utf8",
    }).split(/\r?\n/)
  }
}

function getPullRequestBody() {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath || !existsSync(eventPath)) return ""
  const event = JSON.parse(readFileSync(eventPath, "utf8"))
  return event.pull_request?.body ?? ""
}

function printResult(result) {
  if (result.skipped) {
    console.log("Blast-radius diff check skipped outside pull_request events.")
    return
  }

  if (result.diagnostics.length === 0) {
    console.log("Blast-radius diff check passed.")
    return
  }

  console.error("Blast-radius diff check failed:")
  for (const diagnostic of result.diagnostics) {
    console.error(`  - ${diagnostic}`)
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ""
const currentPath = resolve(fileURLToPath(import.meta.url))

if (invokedPath === currentPath) {
  const result = checkBlastRadius({
    body: getPullRequestBody(),
    changedFiles: getChangedFilesFromEnvironment(),
    eventName: process.env.GITHUB_EVENT_NAME,
  })
  printResult(result)
  process.exit(result.diagnostics.length > 0 ? 1 : 0)
}
