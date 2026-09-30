import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const root = fileURLToPath(new URL("../..", import.meta.url))
const cli = join(root, "node_modules/@playwright/test/cli.js")
const api = join(root, "node_modules/@playwright/test/index.mjs")

// Runs the repository's real Playwright config against a snapshot assertion
// whose baseline is missing. No browser or web server is needed: the wrapper
// keeps every setting except the test directory, projects and web server.
function runMissingBaseline(ci) {
  const dir = mkdtempSync(join(tmpdir(), "visual-mode-"))
  try {
    writeFileSync(
      join(dir, "wrapper.config.mjs"),
      `import base from ${JSON.stringify(join(root, "playwright.config.ts"))}
export default { ...base, testDir: ${JSON.stringify(dir)}, testMatch: "*.spec.mjs",
  snapshotPathTemplate: "{testDir}/baselines/{arg}{ext}", webServer: undefined,
  retries: 0, reporter: "line", projects: [{ name: "unit" }] }
`
    )
    writeFileSync(
      join(dir, "missing.spec.mjs"),
      `import { test, expect } from ${JSON.stringify(api)}
test("compares against a missing baseline", () => {
  expect("rendered").toMatchSnapshot("never-approved.txt")
})
`
    )
    const env = { ...process.env, CI: ci ? "1" : "" }
    if (!ci) delete env.CI
    const result = spawnSync(
      process.execPath,
      [cli, "test", "-c", join(dir, "wrapper.config.mjs")],
      { cwd: root, env, encoding: "utf8", timeout: 60_000 }
    )
    const baselines = join(dir, "baselines")
    return {
      status: result.status,
      output: `${result.stdout}\n${result.stderr}`,
      written: existsSync(baselines) ? readdirSync(baselines) : [],
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

test("CI verification never writes a missing visual baseline", () => {
  const ci = runMissingBaseline(true)
  assert.notEqual(ci.status, 0, ci.output)
  assert.match(ci.output, /1 failed/, "the snapshot assertion itself must fail")
  assert.deepEqual(ci.written, [], "CI must not create a reference image")
})

test("local runs keep Playwright's missing-baseline authoring behaviour", () => {
  // Control case: proves the probe can observe a write, so the CI assertion
  // above is not passing vacuously.
  const local = runMissingBaseline(false)
  assert.match(local.output, /1 failed/, local.output)
  assert.deepEqual(local.written, ["never-approved.txt"], local.output)
})
