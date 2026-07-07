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

test("Given the kit-canonical SKILL.md When bundled Then the .factory bundle SKILL.md matches", () => {
  assert.equal(
    readFileSync(
      path.join(projectRoot, ".factory/skills/ai-governance-starter-kit/SKILL.md"),
      "utf8"
    ),
    readFileSync(path.join(source, "SKILL.md"), "utf8"),
    "the bundle SKILL.md is a mirror of the kit's — run: node scripts/sync-skill-bundles.mjs"
  )
})

test("Given the station suite When mirrored Then each .factory mirror equals its kit source and carries the marker", () => {
  const suiteRoot = path.join(source, "skills")
  const names = readdirSync(suiteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  assert.ok(names.length >= 4, "the suite ships at least the four station skills")

  for (const name of names) {
    const kitSkill = path.join(suiteRoot, name)
    const mirror = path.join(projectRoot, ".factory/skills", name)

    assert.deepEqual(
      listFiles(mirror),
      listFiles(kitSkill),
      `${name} mirror file list differs — run: node scripts/sync-skill-bundles.mjs`
    )
    for (const file of listFiles(kitSkill)) {
      assert.equal(
        readFileSync(path.join(mirror, file), "utf8"),
        readFileSync(path.join(kitSkill, file), "utf8"),
        `${name}/${file} mirror is out of sync — run: node scripts/sync-skill-bundles.mjs`
      )
    }
    assert.match(
      readFileSync(path.join(kitSkill, "SKILL.md"), "utf8"),
      /managed-by: ai-governance-starter-kit/,
      `${name} SKILL.md must carry the managed-by marker (the sync guard keys on it)`
    )
  }
})

test("Given the kit release surface When versions are compared Then plugin.json and CHANGELOG track KIT_VERSION", async () => {
  const { KIT_VERSION } = await import("../../scripts/governance-version.mjs")

  const manifest = JSON.parse(
    readFileSync(path.join(source, ".claude-plugin/plugin.json"), "utf8")
  )
  assert.equal(
    manifest.version,
    KIT_VERSION,
    "the plugin manifest version must track KIT_VERSION (bump both together)"
  )

  const changelogPath = path.join(source, "CHANGELOG.md")
  assert.equal(existsSync(changelogPath), true, "the kit ships a CHANGELOG.md")
  assert.match(
    readFileSync(changelogPath, "utf8"),
    new RegExp(`^## ${KIT_VERSION.replaceAll(".", "\\.")}\\b`, "m"),
    "the changelog carries an entry for the current KIT_VERSION"
  )
})

test("Given the plugin manifest When compared to skills/ Then the declared list matches the directory", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(source, ".claude-plugin/plugin.json"), "utf8")
  )
  const names = readdirSync(path.join(source, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  assert.deepEqual(
    manifest.skills,
    names.map((name) => `./skills/${name}`),
    "plugin.json skills must equal the skills/ directory listing"
  )
})

test("Given the shared-test lockstep When compared Then repo tests equal the kit templates", async () => {
  const { SHARED_TEST_FILES } = await import("../../scripts/governance-version.mjs")

  assert.ok(SHARED_TEST_FILES.length >= 3, "the shared-test manifest lists the shared suites")
  assert.equal(
    SHARED_TEST_FILES.includes("governance-enforcement.test.mjs"),
    false,
    "the enforcement-test flavors legitimately differ and stay dual-edited"
  )

  for (const file of SHARED_TEST_FILES) {
    assert.equal(
      readFileSync(path.join(projectRoot, "tests/micro-specs", file), "utf8"),
      readFileSync(path.join(source, "templates/tests/micro-specs", file), "utf8"),
      `tests/micro-specs/${file} drifted from the kit template — run: node scripts/sync-skill-bundles.mjs`
    )
  }
})
