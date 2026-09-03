import { appendFileSync, readFileSync, writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const DEFAULT_CONTRACT = new URL(
  "../config/vercel-governance-contract.json",
  import.meta.url
)
const SAFE_SCOPE = /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/
const SAFE_TEAM_ID = /^team_[A-Za-z0-9]{20,}$/
const SAFE_PROJECT_ID = /^prj_[A-Za-z0-9]{20,}$/
const SAFE_PROJECT_NAME = /^[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])?$/

export function parseCanonicalVercelProductionTarget(value) {
  if (!isRecord(value) || !isRecord(value.team) || !isRecord(value.project)) {
    throw new Error("Canonical Vercel target is missing.")
  }
  const scope = safeField(value.scope, SAFE_SCOPE)
  const teamId = safeField(value.team.id, SAFE_TEAM_ID)
  const projectId = safeField(value.project.id, SAFE_PROJECT_ID)
  const projectName = safeField(value.project.name, SAFE_PROJECT_NAME)
  if (!scope || !teamId || !projectId || !projectName) {
    throw new Error("Canonical Vercel target is invalid.")
  }
  return { scope, teamId, projectId, projectName }
}

export function readCanonicalVercelProductionTarget() {
  return parseCanonicalVercelProductionTarget(
    JSON.parse(readFileSync(DEFAULT_CONTRACT, "utf8"))
  )
}

function main(args) {
  const githubEnv = option(args, "--github-env")
  const evidencePath = option(args, "--evidence")
  if (!githubEnv || !evidencePath) {
    throw new Error("Both --github-env and --evidence are required.")
  }

  const target = readCanonicalVercelProductionTarget()
  appendFileSync(
    githubEnv,
    [
      `CANONICAL_VERCEL_SCOPE=${target.scope}`,
      `CANONICAL_VERCEL_TEAM_ID=${target.teamId}`,
      `CANONICAL_VERCEL_PROJECT_ID=${target.projectId}`,
      `CANONICAL_VERCEL_PROJECT_NAME=${target.projectName}`,
      "",
    ].join("\n")
  )
  writeFileSync(evidencePath, `${JSON.stringify(target, null, 2)}\n`)
}

function option(args, name) {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

function safeField(value, pattern) {
  return typeof value === "string" && pattern.test(value) ? value : null
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2))
}
