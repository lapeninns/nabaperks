import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

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

export function readCiCommands(root) {
  const workflowDir = join(root, ".github/workflows")
  if (!existsSync(workflowDir)) return []
  return listFiles(workflowDir)
    .filter((file) => /\.(ya?ml)$/.test(file))
    .flatMap((file) => {
      const source = readFileSync(join(workflowDir, file), "utf8")
      return [...source.matchAll(/run:\s*([^\n]+)/g)].map((match) => match[1].trim())
    })
    .filter((command) => /\b(governance:check|governance:run-gates|test|build|lint|typecheck)\b/.test(command))
}

export function readSpecs(root, failures) {
  const dir = join(root, "micro-specs")
  if (!existsSync(dir)) return []
  return listFiles(dir)
    .filter((file) => file.endsWith(".md"))
    .filter((file) => !["README.md", "GLOBAL_CONTEXT.md"].includes(file))
    .map((file) => {
      const source = readFileSync(join(dir, file), "utf8")
      const metadata = parseFrontmatter(source)
      if (!metadata) {
        failures.push(`micro-specs/${file} is missing YAML frontmatter metadata.`)
        return { file, source, metadata: {} }
      }
      return { file, source, metadata }
    })
}

export function findChangedFiles(root, env) {
  if (env.GOVERNANCE_CHANGED_FILES) {
    return env.GOVERNANCE_CHANGED_FILES.split(/\r?\n|,/)
      .map((file) => file.trim())
      .filter(Boolean)
  }

  const untracked = gitFiles(root, ["ls-files", "--others", "--exclude-standard"])
  const tracked = gitFiles(root, ["diff", "--name-only", "--diff-filter=ACMRTUXB", "HEAD"])
  return [...new Set([...tracked, ...untracked])]
}

export function parseFrontmatter(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n/)
  if (!match) return null
  const metadata = {}
  let currentKey = ""
  for (const rawLine of match[1].split(/\r?\n/)) {
    if (!rawLine.trim()) continue
    const item = rawLine.match(/^\s+-\s*(.+?)\s*$/)
    if (item && currentKey) {
      metadata[currentKey].push(stripQuotes(item[1]))
      continue
    }
    const pair = rawLine.match(/^([A-Za-z0-9_]+):\s*(.*?)\s*$/)
    if (!pair) continue
    currentKey = pair[1]
    metadata[currentKey] = pair[2] === "" ? [] : parseScalar(pair[2])
  }
  return metadata
}

export function namedSection(source, title) {
  const start = source.indexOf(`## ${title}`)
  if (start === -1) return ""
  const next = source.indexOf("\n## ", start + 1)
  return source.slice(start, next === -1 ? source.length : next)
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

function parseScalar(value) {
  if (value === "[]") return []
  return stripQuotes(value)
}

function stripQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}
