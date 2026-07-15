import { existsSync, readFileSync } from "node:fs"

const agentsPath = "AGENTS.md"
const agents = readFileSync(agentsPath, "utf8")
const packageJson = JSON.parse(readFileSync("package.json", "utf8"))
const errors = []

for (const path of [
  "DESIGN.md",
  "docs/operations/agent-readiness.md",
  "docs/operations/incident-response.md",
  "docs/operations/production-runbook.md",
  "docs/api/openapi.json",
  "config/env-contract.json",
]) {
  if (!agents.includes(path))
    errors.push(`${agentsPath} must reference ${path}`)
  if (!existsSync(path)) errors.push(`${path} does not exist`)
}

const documentedCommands = [
  ...agents.matchAll(/(?:`|^\s*)pnpm ([a-z0-9:-]+)/gm),
].map((match) => match[1])
for (const command of new Set(documentedCommands)) {
  if (command === "install") continue
  if (!packageJson.scripts[command]) {
    errors.push(
      `${agentsPath} documents missing package script: pnpm ${command}`
    )
  }
}

for (const requiredCommand of ["quality:fast", "quality:check", "build"]) {
  if (!documentedCommands.includes(requiredCommand)) {
    errors.push(`${agentsPath} must document pnpm ${requiredCommand}`)
  }
}

if (errors.length > 0) {
  console.error("AGENTS.md freshness validation failed:")
  console.error(errors.map((error) => `- ${error}`).join("\n"))
  process.exit(1)
}

console.log(
  `AGENTS.md is current for ${documentedCommands.length} documented command reference(s).`
)
