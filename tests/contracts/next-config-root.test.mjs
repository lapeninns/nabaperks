import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

test("Given the repo sits below unrelated lockfiles When Next builds with Turbopack Then the app root is pinned", () => {
  const config = readFileSync(path.join(projectRoot, "next.config.ts"), "utf8")

  assert.match(config, /turbopack:\s*\{\s*root:\s*process\.cwd\(\)/s)
})
