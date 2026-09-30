import assert from "node:assert/strict"
import { test } from "node:test"
import {
  captureBrowserConfiguration,
  browserConfiguration,
} from "../../scripts/ci/browser-configuration.mjs"
import { BROWSER_PROJECTS } from "../../scripts/ci/impact-qualification-scope.mjs"

const projects = [...BROWSER_PROJECTS]
const resolved = (patch = {}) => ({
  projects: projects.map((name) => ({
    name,
    use: {
      browserName: "chromium",
      viewport: { width: 1280, height: 720 },
      contextOptions: { reducedMotion: "reduce" },
      ...patch,
    },
  })),
})

test("resolved browser evidence includes all use options and rejects non-data settings", () => {
  const baseline = captureBrowserConfiguration(resolved())
  for (const patch of [
    { browserName: "webkit" },
    { viewport: null },
    { channel: "chromium" },
    { userAgent: "mobile device" },
    { deviceScaleFactor: 3 },
    { isMobile: true },
    { hasTouch: true },
    { contextOptions: { reducedMotion: "no-preference" } },
    { launchOptions: { args: ["--force-color-profile=srgb"] } },
    { locale: "fr-FR" },
    { colorScheme: "dark" },
  ])
    assert.notDeepEqual(captureBrowserConfiguration(resolved(patch)), baseline)
  const reordered = resolved()
  for (const project of reordered.projects)
    project.use.viewport = { height: 720, width: 1280 }
  assert.deepEqual(captureBrowserConfiguration(reordered), baseline)
  assert.throws(() =>
    captureBrowserConfiguration(resolved({ custom: () => true }))
  )
  assert.throws(() => browserConfiguration({ config: { projects } }), /missing/)
})
