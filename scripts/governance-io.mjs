import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

import { isGateCommandCandidate } from "./governance-commands.mjs"
import {
  CI_WORKFLOW_FILES,
  README_GATES_SECTION_TITLE,
} from "./governance-constants.mjs"
import { parseFrontmatter } from "./governance-frontmatter.mjs"

export { parseFrontmatter }

export function readPackageJson(root, failures = []) {
  try {
    return JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  } catch (error) {
    failures.push(`package.json could not be read: ${errorMessage(error)}`)
    return {}
  }
}

export function readPackageScripts(root, failures = []) {
  return readPackageJson(root, failures).scripts ?? {}
}

// Collect gate-candidate commands from CI workflows. Handles single-line
// `run: <cmd>` steps and `run: |` / `run: >` block scalars (each block line is
// considered separately). Which workflow files are scanned is controlled by
// CI_WORKFLOW_FILES; the symmetric isGateCommandCandidate filter decides what
// counts as a gate command.
export function readCiCommands(root) {
  const workflowDir = join(root, ".github/workflows")
  if (!existsSync(workflowDir)) return []

  const files = listFiles(workflowDir)
    .filter((file) => /\.(ya?ml)$/.test(file))
    .filter((file) => CI_WORKFLOW_FILES === null || CI_WORKFLOW_FILES.includes(file))

  const commands = []
  for (const file of files) {
    const lines = readFileSync(join(workflowDir, file), "utf8").split(/\r?\n/)
    for (let i = 0; i < lines.length; i += 1) {
      const step = lines[i].match(/^(\s*)(?:-\s+)?run:\s*(.*)$/)
      if (!step) continue

      const indent = step[1].length
      const value = step[2].trim()
      if (/^[|>]/.test(value)) {
        // Block scalar: consume the more-indented lines that follow.
        for (let j = i + 1; j < lines.length; j += 1) {
          const blockLine = lines[j]
          if (blockLine.trim() === "") continue
          const blockIndent = blockLine.match(/^\s*/)[0].length
          if (blockIndent <= indent) break
          commands.push(blockLine.trim())
          i = j
        }
      } else if (value !== "") {
        commands.push(value)
      }
    }
  }

  return unique(commands.filter(isGateCommandCandidate))
}

// Collect gate-candidate commands from the README's gate section. Accepts
// dash items (`- cmd`, `- \`cmd\``) and fenced-code-block lines, then applies
// the SAME filter as readCiCommands so the two sides compare like for like.
export function readReadmeGateCommands(root) {
  const readmePath = join(root, "micro-specs/README.md")
  if (!existsSync(readmePath)) return null

  const section = namedSection(readFileSync(readmePath, "utf8"), README_GATES_SECTION_TITLE)
  if (!section) return null

  const commands = []
  let inFence = false
  for (const rawLine of section.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith("```")) {
      inFence = !inFence
      continue
    }
    if (inFence) {
      if (line !== "") commands.push(line)
      continue
    }
    const item = line.match(/^-\s+(.+)$/)
    if (item) commands.push(item[1].trim().replace(/^`(.+)`$/, "$1"))
  }

  return unique(commands.filter(isGateCommandCandidate))
}

export function readPlaywrightProjectNames(root) {
  const configPath = ["playwright.config.ts", "playwright.config.js", "playwright.config.mjs"]
    .map((name) => join(root, name))
    .find((path) => existsSync(path))
  if (!configPath) return []
  const source = readFileSync(configPath, "utf8")
  return [...source.matchAll(/\bname:\s*["']([^"']+)["']/g)].map((match) => match[1])
}

export function readSpecs(root, failures) {
  const dir = join(root, "micro-specs")
  if (!existsSync(dir)) return []
  return listFiles(dir)
    .filter((file) => file.endsWith(".md"))
    .filter((file) => !["README.md", "GLOBAL_CONTEXT.md"].includes(file))
    .map((file) => {
      const source = readFileSync(join(dir, file), "utf8")
      const parsed = parseFrontmatter(source)
      if (!parsed) {
        failures.push(`${specPath(file)} is missing YAML frontmatter metadata.`)
        return { file, source, metadata: {}, parseErrors: [] }
      }
      for (const error of parsed.errors) {
        failures.push(`${specPath(file)}:${error.line}: ${error.message}`)
      }
      return { file, source, metadata: parsed.metadata, parseErrors: parsed.errors }
    })
}

// Resolve the set of changed files to enforce blast radius against.
//
// Order of precedence:
//   1. GOVERNANCE_CHANGED_FILES override (newline/comma separated).
//   2. GitHub PR range: origin/<base>...HEAD (needs fetch-depth: 0).
//   3. GitHub push range: <event-before>...HEAD.
//   4. Local working tree: git diff HEAD plus untracked.
//
// Ranges 2 and 3 are what make blast-radius enforcement actually fire in CI —
// a bare `git diff HEAD` is empty on a freshly checked-out PR branch tip.
export function findChangedFiles(root, env) {
  if (env.GOVERNANCE_CHANGED_FILES) {
    return env.GOVERNANCE_CHANGED_FILES.split(/\r?\n|,/)
      .map((file) => file.trim())
      .filter(Boolean)
  }

  const untracked = gitFiles(root, ["ls-files", "--others", "--exclude-standard"])

  const ranges = []
  if (env.GITHUB_BASE_REF) ranges.push(`origin/${env.GITHUB_BASE_REF}...HEAD`)
  if (env.GITHUB_EVENT_BEFORE && !/^0+$/.test(env.GITHUB_EVENT_BEFORE)) {
    ranges.push(`${env.GITHUB_EVENT_BEFORE}...HEAD`)
  }
  ranges.push("HEAD")

  for (const range of ranges) {
    const tracked = gitFiles(root, ["diff", "--name-only", "--diff-filter=ACMRTUXB", range])
    const files = [...new Set([...tracked, ...untracked])]
    if (files.length > 0) return files
  }
  return untracked
}

export function namedSection(source, title) {
  const start = source.indexOf(`## ${title}`)
  if (start === -1) return ""
  const next = source.indexOf("\n## ", start + 1)
  return source.slice(start, next === -1 ? source.length : next)
}

export function specPath(file) {
  return `micro-specs/${file}`
}

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name)
    if (entry.isDirectory()) return listFiles(absolute, base)
    return [relative(base, absolute)]
  })
}

function gitFiles(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .filter(Boolean)
  } catch {
    return []
  }
}

function unique(values) {
  return [...new Set(values)]
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}
