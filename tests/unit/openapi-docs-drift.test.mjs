import assert from "node:assert/strict"
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const sourcePaths = [
  "package.json",
  "docs/api/openapi.json",
  "docs/api/README.md",
  "scripts/generate-api-docs.mjs",
]

function fixtureSourcePaths() {
  const openapi = JSON.parse(
    readFileSync(path.join(projectRoot, "docs/api/openapi.json"), "utf8")
  )
  const operationSources = Object.values(openapi.paths).flatMap((pathItem) =>
    Object.values(pathItem)
      .map((operation) => operation["x-source"])
      .filter((sourcePath) => typeof sourcePath === "string")
  )

  return [...sourcePaths, ...operationSources]
}

function run(command, arguments_, cwd) {
  return spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${path.join(projectRoot, "node_modules", ".bin")}:${process.env.PATH}`,
    },
  })
}

function requireSuccess(result, command) {
  assert.equal(result.error, undefined, `${command} starts`)
  assert.equal(result.status, 0, `${command}\n${result.stderr}`)
}

function copyFixtureFile(fixturePath, sourcePath) {
  const targetPath = path.join(fixturePath, sourcePath)
  cpSync(path.join(projectRoot, sourcePath), targetPath, { recursive: true })
}

test("Given a source-only OpenAPI change When docs check runs Then it rejects the drift", () => {
  const fixturePath = mkdtempSync(
    path.join(tmpdir(), "nabaperks-task15-openapi-docs-")
  )

  try {
    // Given: a task-owned repository fixture with generated docs committed.
    for (const sourcePath of fixtureSourcePaths()) {
      copyFixtureFile(fixturePath, sourcePath)
    }
    requireSuccess(run("git", ["init", "--quiet"], fixturePath), "git init")
    requireSuccess(
      run(
        "git",
        ["config", "user.email", "task15@example.invalid"],
        fixturePath
      ),
      "git config email"
    )
    requireSuccess(
      run("git", ["config", "user.name", "task15"], fixturePath),
      "git config name"
    )
    requireSuccess(run("git", ["add", "."], fixturePath), "git add")
    requireSuccess(
      run("git", ["commit", "--quiet", "-m", "baseline"], fixturePath),
      "git commit"
    )
    requireSuccess(
      run("pnpm", ["docs:check"], fixturePath),
      "baseline docs:check"
    )

    const readmePath = path.join(fixturePath, "docs/api/README.md")
    const initialReadme = readFileSync(readmePath, "utf8")
    const openapiPath = path.join(fixturePath, "docs/api/openapi.json")
    const openapi = JSON.parse(readFileSync(openapiPath, "utf8"))
    openapi.info.version = `${openapi.info.version}-source-only-drift`
    writeFileSync(openapiPath, `${JSON.stringify(openapi, null, 2)}\n`)

    // When: a semantically meaningful field omitted from the README changes.
    const driftResult = run("pnpm", ["docs:check"], fixturePath)

    // Then: the rendered document stays identical while the package command fails.
    assert.equal(readFileSync(readmePath, "utf8"), initialReadme)
    assert.notEqual(driftResult.status, 0)
    assert.match(
      `${driftResult.stdout}${driftResult.stderr}`,
      /docs\/api\/openapi\.json/
    )
  } finally {
    rmSync(fixturePath, { force: true, recursive: true })
  }
})
