import assert from "node:assert/strict"
import { test } from "node:test"
import { playwrightServerNodeOptions } from "../../scripts/playwright-server-heap.mjs"

test("hosted heap stays at 8 GiB and local runners can request a bounded larger heap", () => {
  assert.equal(playwrightServerNodeOptions(), "--max-old-space-size=8192")
  assert.equal(
    playwrightServerNodeOptions("12288"),
    "--max-old-space-size=12288"
  )
  assert.equal(
    playwrightServerNodeOptions("16384"),
    "--max-old-space-size=16384"
  )
})

test("heap overrides cannot exceed the budget or inject shell arguments", () => {
  for (const value of [
    "",
    "999",
    "16385",
    "-8192",
    "1e4",
    "8192; echo bad",
    "8192 --inspect",
    "8192\n",
    "foo",
  ]) {
    assert.throws(
      () => playwrightServerNodeOptions(value),
      /must be an integer/
    )
  }
})
