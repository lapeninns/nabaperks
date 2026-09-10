import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

const scripts = fileURLToPath(new URL("../../scripts/", import.meta.url))

test("real Playwright child signals survive the inner wrapper, pnpm and browser workload", (t) => {
  const root = mkdtempSync(join(tmpdir(), "playwright-signal-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const bin = join(root, "node_modules/.bin")
  mkdirSync(bin, { recursive: true })
  symlinkSync(scripts, join(root, "scripts"), "dir")
  writeFileSync(
    join(root, "package.json"),
    JSON.stringify({ name: "signal-fixture", private: true })
  )
  for (const [action, code] of [
    ["SIGKILL", 137],
    ["SIGTERM", 143],
    ["1", 1],
    ["0", 0],
  ]) {
    writeFileSync(
      join(bin, "playwright"),
      `#!/usr/bin/env node\n${action.startsWith("SIG") ? `process.kill(process.pid, ${JSON.stringify(action)})` : `process.exit(${action})`}\n`,
      { mode: 0o755 }
    )
    for (const args of [
      [join(scripts, "run-playwright.mjs")],
      [
        join(scripts, "ci/browser-workload.mjs"),
        "local",
        "test:e2e",
        "--project=mobile-safari",
        "--grep-invert",
        "@visual|@a11y",
        "--ignore-snapshots",
        "--shard=1/32",
      ],
    ]) {
      const result = spawnSync(process.execPath, args, {
        cwd: root,
        encoding: "utf8",
        timeout: 15_000,
        env: {
          ...process.env,
          PATH: `${bin}:${process.env.PATH}`,
          LOCAL_CI_BROWSER_JSON: "0",
          PLAYWRIGHT_NEXT_DIST_DIR: "",
        },
      })
      assert.equal(result.error, undefined)
      assert.equal(result.signal, null)
      assert.equal(result.status, code, `${action}: ${result.stderr}`)
      if (action.startsWith("SIG"))
        assert.match(
          result.stderr,
          new RegExp(`Playwright child terminated by signal ${action}`)
        )
    }
  }
})
