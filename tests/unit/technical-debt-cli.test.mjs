import assert from "node:assert/strict"
import { execFileSync, spawnSync } from "node:child_process"
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

const projectDir = process.cwd()
const debtScript = join(projectDir, "scripts/check-technical-debt.mjs")

test("technical debt CLI rejects a JavaScript marker whose issue reference has trailing junk", () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "nabaperks-debt-cli-"))
  try {
    execFileSync("git", ["init", "-q"], { cwd: fixtureDir })
    cpSync(debtScript, join(fixtureDir, "check-technical-debt.mjs"))
    writeFileSync(
      join(fixtureDir, "fixture.js"),
      "// TO" + "DO(#123)trailing-junk must be rejected\\n"
    )
    execFileSync("git", ["add", "."], { cwd: fixtureDir })

    const result = spawnSync(process.execPath, ["check-technical-debt.mjs"], {
      cwd: fixtureDir,
      encoding: "utf8",
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /fixture\.js:1/)
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true })
  }
})
