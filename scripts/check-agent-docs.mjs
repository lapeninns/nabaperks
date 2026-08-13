import { existsSync, readFileSync, statSync } from "node:fs"
import { normalize } from "node:path/posix"

const AGENTS_PATH = "AGENTS.md"
const REQUIRED_PATHS = [
  "DESIGN.md",
  "docs/operations/agent-readiness.md",
  "docs/operations/incident-response.md",
  "docs/operations/production-runbook.md",
  "docs/api/openapi.json",
  "config/env-contract.json",
]
const REQUIRED_COMMANDS = ["quality:fast", "quality:check", "build"]
const PACKAGE_COMMANDS = new Set(["install"])

function normalizeDocumentPath(value) {
  const normalized = normalize(value.trim().replaceAll("\\", "/"))
  if (
    normalized === "." ||
    normalized.startsWith("../") ||
    normalized.startsWith("/")
  )
    return null
  return normalized
}

function documentedPaths(markdown) {
  return new Set(
    [...markdown.matchAll(/`([^`\r\n]+)`/g)]
      .map((match) => normalizeDocumentPath(match[1]))
      .filter((path) => path !== null)
  )
}

function documentedCommands(markdown) {
  const codeBlocks = markdown.matchAll(
    /^```(?:bash|shell|sh|zsh)\s*\r?\n([\s\S]*?)^```/gim
  )
  const commands = new Set()
  for (const block of codeBlocks) {
    for (const line of block[1].split(/\r?\n/)) {
      const command = line.replace(/\s+#.*$/, "").trim()
      const match = command.match(
        /^pnpm\s+(?:run\s+)?([a-z][a-z0-9:-]*)(?:\s+[^|;&]+)?$/
      )
      if (match) commands.add(match[1])
    }
  }
  return commands
}

function nestedScriptTargets(command) {
  return [
    ...command.matchAll(
      /(?:^|&&|\|\||;)\s*pnpm\s+(?:run\s+)?([a-z][a-z0-9:-]*)/g
    ),
  ].map((match) => match[1])
}

function validateScriptTarget(script, scripts, errors, ancestors = []) {
  const command = scripts[script]
  if (typeof command !== "string" || command.trim() === "") {
    errors.push(`AGENT_DOCS_SCRIPT_TARGET_INVALID: ${script}`)
    return
  }
  for (const target of nestedScriptTargets(command)) {
    if (!Object.hasOwn(scripts, target)) {
      errors.push(`AGENT_DOCS_SCRIPT_TARGET_MISSING: ${script} -> ${target}`)
      continue
    }
    if (ancestors.includes(target) || target === script) {
      errors.push(
        `AGENT_DOCS_SCRIPT_TARGET_CYCLE: ${[...ancestors, script, target].join(" -> ")}`
      )
      continue
    }
    validateScriptTarget(target, scripts, errors, [...ancestors, script])
  }
}

const errors = []
let agents = ""
let packageJson = null
try {
  agents = readFileSync(AGENTS_PATH, "utf8")
} catch {
  errors.push("AGENT_DOCS_GUIDE_UNREADABLE")
}
try {
  packageJson = JSON.parse(readFileSync("package.json", "utf8"))
} catch {
  errors.push("AGENT_DOCS_PACKAGE_JSON_INVALID")
}

const paths = documentedPaths(agents)
const commands = documentedCommands(agents)
const scripts = packageJson?.scripts
if (!scripts || typeof scripts !== "object" || Array.isArray(scripts)) {
  errors.push("AGENT_DOCS_SCRIPTS_INVALID")
} else {
  for (const command of commands) {
    if (PACKAGE_COMMANDS.has(command)) continue
    if (!Object.hasOwn(scripts, command)) {
      errors.push(`AGENT_DOCS_DOCUMENTED_SCRIPT_MISSING: ${command}`)
      continue
    }
    validateScriptTarget(command, scripts, errors)
  }
}

for (const path of REQUIRED_PATHS) {
  if (!paths.has(path))
    errors.push(`AGENT_DOCS_PATH_REFERENCE_MISSING: ${path}`)
  if (!existsSync(path) || !statSync(path).isFile())
    errors.push(`AGENT_DOCS_PATH_TARGET_MISSING: ${path}`)
}
for (const command of REQUIRED_COMMANDS)
  if (!commands.has(command))
    errors.push(`AGENT_DOCS_REQUIRED_COMMAND_MISSING: ${command}`)

if (errors.length > 0) {
  console.error("AGENTS.md freshness validation failed:")
  console.error(errors.map((error) => `- ${error}`).join("\n"))
  process.exit(1)
}
console.log(
  `AGENTS.md is current for ${commands.size} documented command reference(s).`
)
