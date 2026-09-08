import assert from "node:assert/strict"
import { test } from "node:test"
import { readFileSync } from "node:fs"
import { packShards } from "../../scripts/ci/run-browser-pack.mjs"
import { browserPackRequests } from "../../scripts/ci/browser-pack.mjs"
import {
  BROWSER_IMAGE_VERSION,
  verifyBrowserImage,
} from "../../scripts/ci/check-browser-image.mjs"

test("eight packs cover each original shard exactly once for all four browsers", () => {
  const shards = Array.from({ length: 8 }, (_, index) =>
    packShards(index + 1)
  ).flat()
  assert.deepEqual(
    shards,
    Array.from({ length: 32 }, (_, index) => `${index + 1}/32`)
  )
  for (const project of [
    "chromium",
    "mobile-safari",
    "desktop-firefox",
    "desktop-safari",
  ])
    for (let pack = 1; pack <= 8; pack++)
      assert.equal(
        browserPackRequests({ project, shards: packShards(pack) }).length,
        4
      )
  for (const invalid of [0, 9, 1.5, "01", "1;exit", undefined])
    assert.throws(() => packShards(invalid))
})

test("prepared image verification rejects version drift and missing browsers", () => {
  const valid = {
    version: BROWSER_IMAGE_VERSION,
    browsersPath: "/ms-playwright",
    executables: ["chromium", "firefox", "webkit"].map(
      (browser) => `/ms-playwright/${browser}`
    ),
  }
  assert.doesNotThrow(() => verifyBrowserImage(valid, () => true))
  for (const change of [
    { version: "0.0.0" },
    { browsersPath: "/tmp" },
    { executables: [] },
  ])
    assert.throws(() => verifyBrowserImage({ ...valid, ...change }, () => true))
  assert.throws(() => verifyBrowserImage(valid, () => false))
  const workflow = readFileSync(".github/workflows/ci.yml", "utf8")
  assert.equal(
    workflow.split("options: --init --ipc=host --user 1001").length - 1,
    2
  )
  assert.equal(
    workflow.split(
      `mcr.microsoft.com/playwright:v${BROWSER_IMAGE_VERSION}-noble@sha256:`
    ).length - 1,
    2
  )
})
