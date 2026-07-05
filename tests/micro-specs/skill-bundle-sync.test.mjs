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

test("Given the lockstep contract When engine files are compared Then repo scripts equal kit templates", async () => {
  const { ENGINE_FILES } = await import("../../scripts/governance-version.mjs")

  assert.ok(ENGINE_FILES.length >= 8, "engine manifest lists the governance engine")
  assert.equal(
    ENGINE_FILES.includes("governance-constants.mjs"),
    false,
    "constants are the per-repo tuning point and must never be lockstep-owned"
  )

  for (const file of ENGINE_FILES) {
    assert.equal(
      readFileSync(path.join(projectRoot, "scripts", file), "utf8"),
      readFileSync(path.join(source, "templates/scripts", file), "utf8"),
      `scripts/${file} drifted from the kit template — run: node scripts/sync-skill-bundles.mjs`
    )
  }
})

test("Given the constants contract When export keys are compared Then repo and kit shapes are equal", async () => {
  const repoConstants = await import("../../scripts/governance-constants.mjs")
  const kitConstants = await import(
    "../../ai-governance-starter-kit/templates/scripts/governance-constants.mjs"
  )

  assert.deepEqual(
    Object.keys(repoConstants).sort(),
    Object.keys(kitConstants).sort(),
    "governance-constants.mjs export names must match the kit (values may differ)"
  )
})
