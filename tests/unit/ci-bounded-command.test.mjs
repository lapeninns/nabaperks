import assert from "node:assert/strict"
import { test } from "node:test"
import { runBoundedCommand } from "../../scripts/ci/run-bounded-command.mjs"

test("a real successful subprocess has verified process-group cleanup", async () => {
  const result = await runBoundedCommand(
    process.execPath,
    ["-e", "process.exit(0)"],
    { timeout: 5000, stdio: "ignore" }
  )
  assert.equal(result.status, 0)
  assert.equal(result.cleanupVerified, true)
  assert.equal(result.unexpectedSurvivors, false)
})

test("a deadline terminates a real stuck subprocess and cannot succeed", async () => {
  const result = await runBoundedCommand(
    process.execPath,
    ["-e", "setInterval(()=>{}, 1000)"],
    { timeout: 150, stdio: "ignore" }
  )
  assert.equal(result.signal, "TIMEOUT")
  assert.equal(result.cleanupVerified, true)
})

test(
  "a launcher exiting early cannot leave its child running unnoticed",
  { skip: process.platform === "win32" },
  async () => {
    const script =
      "require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'}).unref()"
    const result = await runBoundedCommand(process.execPath, ["-e", script], {
      timeout: 5000,
      stdio: "ignore",
    })
    assert.equal(result.unexpectedSurvivors, true)
    assert.equal(result.cleanupVerified, true)
  }
)
