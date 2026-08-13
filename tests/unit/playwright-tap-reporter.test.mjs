import assert from "node:assert/strict"
import { test } from "node:test"

import PlaywrightTapReporter from "../support/playwright-tap-reporter.mjs"

test("Given Playwright lifecycle results When the reporter ends Then it emits validator-compatible TAP", () => {
  const chunks = []
  const reporter = new PlaywrightTapReporter({
    write: (chunk) => chunks.push(chunk),
    now: () => 1234,
  })

  reporter.onBegin()
  reporter.onTestEnd({ title: "passing journey" }, { status: "passed" })
  reporter.onTestEnd({ title: "failing journey" }, { status: "failed" })
  reporter.onTestEnd({ title: "skipped journey" }, { status: "skipped" })
  reporter.onError({ message: "worker failed\nwith context" })
  reporter.onEnd()

  const output = chunks.join("")
  assert.match(output, /^TAP version 13\n/)
  assert.match(output, /^ok 1 - passing journey$/m)
  assert.match(output, /^not ok 2 - failing journey$/m)
  assert.match(output, /^ok 3 - skipped journey # SKIP$/m)
  assert.match(output, /^not ok 4 - worker failed with context$/m)
  assert.match(output, /^1\.\.4$/m)
  assert.match(output, /^# tests 4$/m)
  assert.match(output, /^# pass 2$/m)
  assert.match(output, /^# fail 2$/m)
  assert.match(output, /^# skipped 1$/m)
  assert.match(output, /^# duration_ms \d+(?:\.\d+)?$/m)
})
