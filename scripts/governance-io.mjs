import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

export function readPackageScripts(root, failures) {
  try {
    return (
      JSON.parse(readFileSync(join(root, "package.json"), "utf8")).scripts ?? {}
    )
  } catch (error) {
    failures.push(`package.json could not be read: ${errorMessage(error)}`)
    return {}
  }
}

export function readCiCommands(root) {
  const workflowPath = join(root, ".github/workflows/ci.yml")
  if (!existsSync(workflowPath)) return []
  const source = readFileSync(workflowPath, "utf8")
  return [...source.matchAll(/run:\s*(pnpm[^\n]+)/g)].map((match) =>
    match[1].trim()
  )
}

export function readPlaywrightProjectNames(root) {
  const configPath = join(root, "playwright.config.ts")
  if (!existsSync(configPath)) return []
  const source = readFileSync(configPath, "utf8")
  return [...source.matchAll(/\bname:\s*["']([^"']+)["']/g)].map(
    (match) => match[1]
  )
}

export function readSpecs(root, failures) {
  const dir = join(root, "micro-specs")
  if (!existsSync(dir)) return []
  return listMarkdown(dir)
    .filter((file) => !["README.md", "GLOBAL_CONTEXT.md"].includes(file))
    .map((file) => {
      const source = readFileSync(join(dir, file), "utf8")
      const metadata = parseFrontmatter(source)
      if (!metadata) {
        failures.push(`${specPath(file)} is missing YAML frontmatter metadata.`)
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
  const ranges = []
  if (env.GITHUB_BASE_REF) ranges.push([`origin/${env.GITHUB_BASE_REF}...HEAD`])
  if (env.GITHUB_EVENT_BEFORE && !/^0+$/.test(env.GITHUB_EVENT_BEFORE)) {
    ranges.push([`${env.GITHUB_EVENT_BEFORE}...HEAD`])
  }
  ranges.push(["HEAD"])
  const untracked = gitFiles(root, [
    "ls-files",
    "--others",
    "--exclude-standard",
  ])

  for (const range of ranges) {
    const tracked = gitFiles(root, [
      "diff",
      "--name-only",
      "--diff-filter=ACMRTUXB",
      ...range,
    ])
    const files = [...new Set([...tracked, ...untracked])]
    if (files.length > 0) return files
  }
  return untracked
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

function listMarkdown(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name)
    if (entry.isDirectory()) return listMarkdown(absolute, base)
    if (!entry.name.endsWith(".md")) return []
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

function specPath(file) {
  return `micro-specs/${file}`
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}
