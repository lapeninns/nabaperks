import assert from "node:assert/strict"
import { test } from "node:test"
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
import { browserConfiguration } from "../../scripts/ci/browser-configuration.mjs"
import { BROWSER_PROJECTS } from "../../scripts/ci/run-targeted-checks.mjs"

const projects = [...BROWSER_PROJECTS]

test("the real Playwright JSON reporter retains resolved settings on listing and execution", (t) => {
  const root = mkdtempSync(join(tmpdir(), "browser-configuration-reporter-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const require = createRequire(import.meta.url)
  const playwright = createRequire(require.resolve("@playwright/test")).resolve(
    "playwright"
  )
  const reporter = fileURLToPath(
    new URL(
      "../../scripts/ci/browser-configuration-reporter.mjs",
      import.meta.url
    )
  )
  writeFileSync(
    join(root, "sample.spec.js"),
    `const { test } = require(${JSON.stringify(require.resolve("@playwright/test"))}); test('configuration fixture', () => {});`
  )
  writeFileSync(
    join(root, "playwright.config.cjs"),
    `module.exports = {
    testDir: __dirname, workers: 1, forbidOnly: true, failOnFlakyTests: true,
    use: { extraHTTPHeaders: { authorization: 'private-fixture-value' } },
    projects: ${JSON.stringify(projects)}.map(name => ({ name, use: {
      browserName: 'chromium', viewport: { width: process.env.SELECTION_COMPARISON === 'true' ? 800 : 1280, height: 720 }
    }}))
  };`
  )
  const run = (id, list, comparison) => {
    const output = join(root, `${id}.json`)
    const result = spawnSync(
      process.execPath,
      [
        join(dirname(playwright), "cli.js"),
        "test",
        "--config",
        join(root, "playwright.config.cjs"),
        `--reporter=json,${reporter}`,
        ...(list ? ["--list"] : []),
      ],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 30_000,
        env: {
          ...process.env,
          CI: "1",
          SELECTION_COMPARISON: comparison,
          PLAYWRIGHT_JSON_OUTPUT_NAME: output,
        },
      }
    )
    assert.equal(result.status, 0, result.stderr)
    const text = readFileSync(output, "utf8")
    assert.ok(!text.includes("private-fixture-value"))
    const report = JSON.parse(text)
    assert.ok(
      !Object.hasOwn(report.config.projects[0], "use"),
      "Playwright omits use from its ordinary JSON projection"
    )
    return browserConfiguration(report)
  }
  const listing = run("listed", true, "false")
  assert.deepEqual(run("runtime", false, "false"), listing)
  assert.notDeepEqual(run("changed-viewport", false, "true"), listing)
})
