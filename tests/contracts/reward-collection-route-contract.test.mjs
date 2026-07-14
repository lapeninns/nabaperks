import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function projectPath(...segments) {
  return path.join(projectRoot, ...segments)
}

function readProjectFile(...segments) {
  return readFileSync(projectPath(...segments), "utf8")
}

test("Given merchant reward collection routes accept scan tokens When route files are inspected Then the segment and params use scanToken", () => {
  const scanRoute = projectPath(
    "app",
    "app",
    "rewards",
    "scan",
    "[scanToken]",
    "page.tsx"
  )
  const oldRoute = projectPath(
    "app",
    "app",
    "rewards",
    "scan",
    "[rewardId]"
  )
  const page = readFileSync(scanRoute, "utf8")
  const form = readProjectFile(
    "components",
    "merchant",
    "reward-collection-form.tsx"
  )

  assert.equal(existsSync(scanRoute), true)
  assert.equal(existsSync(oldRoute), false)
  assert.match(page, /scanToken: string/)
  assert.match(page, /const \{ scanToken \} = await params/)
  assert.doesNotMatch(page, /rewardId: string/)
  assert.match(form, /@\/app\/app\/rewards\/scan\/\[scanToken\]\/actions/)
})
