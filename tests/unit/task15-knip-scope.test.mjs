import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import test from "node:test"

const execFileAsync = promisify(execFile)
const repositoryRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))))
const knipBinary = join(repositoryRoot, "node_modules/.bin/knip")
const configPath =
  process.env.KNIP_SCOPE_CONFIG ?? join(repositoryRoot, "knip.json")
const dynamicTask15SupportClis = [
  "scripts/qa/validate-task15-test-infrastructure-register.mjs",
  "tests/support/task15-mobile-safari-supervisor.mjs",
]
const runtimeEntries = [
  "scripts/capture-app-harness.mjs",
  "scripts/perf-mutation-stress.mjs",
  ...dynamicTask15SupportClis,
  "tests/load/public-routes.js",
  "tests/load/stamp-redeem-race.js",
  "tests/support/alias-hook.mjs",
  "tests/support/server-only-stub.mjs",
  "tests/unit/auth-hook-route-harness.fixture.mjs",
  "tests/unit/auth-hook-route-register.mjs",
  "tests/unit/claim-offer-boundary-harness.fixture.mjs",
  "tests/unit/proxy-origin-loopback-fixture.mjs",
]

const fixtureFiles = {
  "package.json": JSON.stringify({ name: "knip-scope-fixture", private: true }),
  "components/ui/unused.ts": "export const unusedUi = 1\n",
  "scripts/unused.mjs": "export const unusedScript = 1\n",
  "tests/unused.mjs": "export const unusedTest = 1\n",
  "tests/load/unused.js": "export const unusedLoad = 1\n",
  "public/sw.js": "self.addEventListener('install', () => {})\n",
  "supabase/migrations/unused.sql": "THIS IS INTENTIONALLY NOT SQL\n",
  "supabase/config.json": "{not valid JSON\n",
}

async function writeFixture(root, config) {
  await Promise.all(
    Object.entries({
      ...fixtureFiles,
      "knip.json": JSON.stringify(config, null, 2),
    }).map(async ([relativePath, contents]) => {
      const target = join(root, relativePath)
      await mkdir(dirname(target), {
        recursive: true,
      })
      await writeFile(target, contents)
    })
  )
}

async function runKnip(root, configName = "knip.json") {
  try {
    const { stdout, stderr } = await execFileAsync(
      knipBinary,
      [
        "--config",
        configName,
        "--include",
        "files",
        "--no-progress",
        "--reporter",
        "json",
      ],
      { cwd: root, maxBuffer: 1024 * 1024 }
    )
    return { code: 0, stdout, stderr }
  } catch (error) {
    return {
      code: error.code ?? 1,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    }
  }
}

function issueFiles(stdout) {
  const parsed = JSON.parse(stdout)
  return parsed.issues.map((issue) => issue.file).sort()
}

test("Knip config recognises only the real runtime entrypoints", async () => {
  const config = JSON.parse(await readFile(configPath, "utf8"))
  for (const pattern of [
    "tests/load/**/*.js",
    "public/sw.js",
    "app/**/*.css",
  ]) {
    assert.ok(
      config.project.includes(pattern),
      `missing project pattern: ${pattern}`
    )
  }
  assert.equal(config.project.includes("supabase/**/*.sql"), false)
  assert.equal(config.project.includes("supabase/**/*.json"), false)
  assert.equal(config.ignoreDependencies, undefined)
  for (const entry of runtimeEntries) {
    assert.ok(config.entry.includes(entry), `missing runtime entry: ${entry}`)
  }
  assert.equal(
    config.entry.includes("tests/unit/auth-hook-route-resolver.mjs"),
    false
  )
  assert.equal(new Set(config.entry).size, config.entry.length)
  assert.ok(
    config.entry.includes("components/merchant/launch/launch-billing-cta.tsx")
  )
  assert.ok(
    config.entry.some((pattern) => pattern.startsWith("app/**/{page,layout"))
  )
  assert.doesNotMatch(
    JSON.stringify(config.entry),
    /components\/ui|scripts\/\*\*|tests\/\*\*/
  )
})

test("broad entry globs produce a real unused-file false negative", async () => {
  const config = JSON.parse(await readFile(configPath, "utf8"))
  const baseline = {
    ...config,
    entry: [
      "components/ui/**/*.{ts,tsx}",
      "scripts/**/*.mjs",
      "tests/**/*.{mjs,ts,tsx}",
    ],
    project: config.project.filter(
      (pattern) =>
        !pattern.startsWith("tests/load/") &&
        pattern !== "public/sw.js" &&
        !pattern.startsWith("supabase/")
    ),
  }
  const root = await mkdtemp(join(tmpdir(), "nabaperks-knip-scope-"))
  try {
    await writeFixture(root, baseline)
    const result = await runKnip(root)
    assert.equal(result.code, 0, result.stderr)
    assert.deepEqual(issueFiles(result.stdout), [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("the repaired config reports unused JavaScript in each formerly hidden class", async () => {
  const config = JSON.parse(await readFile(configPath, "utf8"))
  const root = await mkdtemp(join(tmpdir(), "nabaperks-knip-scope-"))
  try {
    await writeFixture(root, config)
    const result = await runKnip(root)
    assert.equal(result.code, 1, result.stderr)
    assert.deepEqual(issueFiles(result.stdout), [
      "components/ui/unused.ts",
      "public/sw.js",
      "scripts/unused.mjs",
      "tests/load/unused.js",
      "tests/unused.mjs",
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("Knip excludes unsupported non-JavaScript compiler inputs", async () => {
  const config = JSON.parse(await readFile(configPath, "utf8"))
  assert.equal(config.project.includes("supabase/**/*.sql"), false)
  assert.equal(config.project.includes("supabase/**/*.json"), false)
  assert.ok(config.project.includes("app/**/*.css"))
  const root = await mkdtemp(join(tmpdir(), "nabaperks-knip-scope-"))
  try {
    await writeFixture(root, config)
    const result = await runKnip(root)
    assert.equal(result.code, 1, result.stderr)
    assert.equal(result.stderr, "")
    assert.deepEqual(issueFiles(result.stdout), [
      "components/ui/unused.ts",
      "public/sw.js",
      "scripts/unused.mjs",
      "tests/load/unused.js",
      "tests/unused.mjs",
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("the clean fixture has no skipped or retried Knip execution", async () => {
  const config = JSON.parse(await readFile(configPath, "utf8"))
  const root = await mkdtemp(join(tmpdir(), "nabaperks-knip-scope-"))
  try {
    await writeFixture(root, config)
    const result = await runKnip(root)
    assert.equal(result.stderr, "")
    assert.match(result.stdout, /\"issues\":\[/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
