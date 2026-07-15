import { existsSync, readFileSync, writeFileSync } from "node:fs"

const sourcePath = "docs/api/openapi.json"
const outputPath = "docs/api/README.md"
const specification = JSON.parse(readFileSync(sourcePath, "utf8"))
const methods = new Set([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
])
const operations = []

if (!/^3\./.test(specification.openapi ?? "")) {
  throw new Error("OpenAPI version must be 3.x")
}

for (const [path, pathItem] of Object.entries(specification.paths ?? {})) {
  for (const [method, operation] of Object.entries(pathItem)) {
    if (!methods.has(method)) continue
    if (!operation.summary || !operation.responses || !operation["x-source"]) {
      throw new Error(
        `${method.toUpperCase()} ${path} needs summary, responses, and x-source`
      )
    }
    if (!existsSync(operation["x-source"])) {
      throw new Error(
        `${method.toUpperCase()} ${path} references missing ${operation["x-source"]}`
      )
    }
    operations.push({
      method: method.toUpperCase(),
      path,
      summary: operation.summary,
      source: operation["x-source"],
    })
  }
}

operations.sort((left, right) =>
  `${left.path}:${left.method}`.localeCompare(`${right.path}:${right.method}`)
)

const lines = [
  "# Nabaperks operational API",
  "",
  "Generated from `docs/api/openapi.json` by `pnpm docs:generate`. Do not edit this table by hand.",
  "",
  specification.info.description,
  "",
  "| Method | Path | Summary | Source |",
  "| --- | --- | --- | --- |",
  ...operations.map(
    (operation) =>
      `| ${operation.method} | \`${operation.path}\` | ${operation.summary} | \`${operation.source}\` |`
  ),
  "",
  "The protected readiness endpoint requires `Authorization: Bearer <PRODUCTION_MONITOR_SECRET>`.",
  "",
]

writeFileSync(outputPath, lines.join("\n"))
console.log(`Generated ${outputPath} with ${operations.length} operation(s).`)
