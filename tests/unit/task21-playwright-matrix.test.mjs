import assert from "node:assert/strict"
import test from "node:test"

import {
  classifyDiscoveredTests,
  parseListReporter,
  reconcileProjectDiscoveries,
  renderTestList,
} from "../../scripts/qa/task21-playwright-matrix.mjs"

const rules = {
  live: [
    "merchant-auth-recovery-flow.ts › merchant auth recovery › local Supabase session proof",
  ],
  unsupported: [
    "[desktop-firefox] › nfc-card-print.desktop.spec.ts › NFC card print › generates two native pages",
  ],
}

test("Given real Playwright list rows When classified Then every row has exactly one matrix owner", () => {
  const discovered = parseListReporter(`
Listing tests:
  [chromium] › merchant-auth-recovery-flow.ts:49:3 › merchant auth recovery › DB-free correction
  [chromium] › merchant-auth-recovery-flow.ts:273:5 › merchant auth recovery › local Supabase session proof › establishes a session
  [desktop-firefox] › nfc-card-print.desktop.spec.ts:84:3 › NFC card print › generates two native pages
Total: 3 tests in 2 files
`)

  const result = classifyDiscoveredTests(discovered, rules)

  assert.equal(result.dbFree.length, 1)
  assert.equal(result.live.length, 1)
  assert.equal(result.unsupported.length, 1)
  assert.equal(result.unknown.length, 0)
  assert.equal(result.overlap.length, 0)
  assert.equal(result.total, 3)
})

test("Given a prompt-like title When no structural prefix matches Then it remains DB-free", () => {
  const discovered = parseListReporter(`
Listing tests:
  [chromium] › prompt.spec.ts:8:1 › says local Supabase session proof in prose
Total: 1 test in 1 file
`)

  const result = classifyDiscoveredTests(discovered, rules)

  assert.deepEqual(result.live, [])
  assert.equal(result.dbFree.length, 1)
})

test("Given overlapping matrix rules When classified Then the overlap is rejected", () => {
  const discovered = parseListReporter(`
Listing tests:
  [desktop-firefox] › nfc-card-print.desktop.spec.ts:84:3 › NFC card print › generates two native pages
Total: 1 test in 1 file
`)

  const result = classifyDiscoveredTests(discovered, {
    live: ["nfc-card-print.desktop.spec.ts › NFC card print"],
    unsupported: rules.unsupported,
  })

  assert.equal(result.overlap.length, 1)
})

test("Given exact discovered rows When rendered Then Playwright receives location-free stable test descriptions", () => {
  const discovered = parseListReporter(`
Listing tests:
  [chromium] › example.spec.ts:17:3 › suite › title
Total: 1 test in 1 file
`)

  assert.equal(
    renderTestList(discovered),
    "[chromium] › example.spec.ts › suite › title\n"
  )
})

test("Given malformed list output When parsed Then discovery fails closed", () => {
  assert.throws(
    () =>
      parseListReporter("Listing tests:\n  a prompt-like row\nTotal: 1 test"),
    /TASK21_MALFORMED_DISCOVERY/
  )
  assert.throws(
    () => parseListReporter("Listing tests:\nTotal: 0 tests in 0 files"),
    /TASK21_ZERO_DISCOVERY/
  )
})

test("Given a project-only exclusion When another project owns the same test Then reconciliation proves coverage", () => {
  const chromium = [
    "[chromium] › pwa.spec.ts › PWA › works offline",
    "[chromium] › auth.spec.ts › live proof › signs in",
  ]
  const firefox = [
    "[desktop-firefox] › pwa.spec.ts › PWA › works offline",
    "[desktop-firefox] › auth.spec.ts › live proof › signs in",
  ]
  const result = reconcileProjectDiscoveries(
    { chromium, "desktop-firefox": firefox },
    {
      live: ["auth.spec.ts › live proof"],
      unsupported: ["[desktop-firefox] › pwa.spec.ts › PWA"],
    }
  )

  assert.equal(result.semanticTests, 2)
  assert.deepEqual(result.uncovered, [])
  assert.deepEqual(result.overlap, [])
})
