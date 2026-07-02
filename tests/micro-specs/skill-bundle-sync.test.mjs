import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const source = path.join(projectRoot, "ai-governance-starter-kit")
const factoryBundle = path.join(
  projectRoot,
  ".factory/skills/ai-governance-starter-kit/ai-governance-starter-kit"
)

function listFiles(dir, base = dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      const absolute = path.join(dir, entry.name)
      if (entry.isDirectory()) return listFiles(absolute, base)
      return [path.relative(base, absolute)]
    })
    .sort()
}

test("Given the .factory skill When compared to source Then it is self-contained", () => {
  assert.equal(existsSync(factoryBundle), true, "the .factory skill must bundle the installer + templates")
  assert.equal(
    existsSync(path.join(factoryBundle, "install-ai-governance.mjs")),
    true,
    "the bundled installer must be present so the skill works on any repo"
  )
})

test("Given the canonical kit When bundled Then the .factory bundle is byte-identical", () => {
  const sourceFiles = listFiles(source)
  const bundleFiles = listFiles(factoryBundle)

  assert.deepEqual(
    bundleFiles,
    sourceFiles,
    "file lists differ — run: node scripts/sync-skill-bundles.mjs"
  )

  for (const file of sourceFiles) {
    assert.equal(
      readFileSync(path.join(factoryBundle, file), "utf8"),
      readFileSync(path.join(source, file), "utf8"),
      `${file} is out of sync — run: node scripts/sync-skill-bundles.mjs`
    )
  }
})
