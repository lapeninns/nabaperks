import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

// contract-analytics-qr-downloaded-wire — pins the wiring contract:
//   1. the poster print button fires the tracking action WITHOUT awaiting it
//      (void) before window.print(), so printing can never be delayed or
//      failed by analytics;
//   2. the server action validates the client-supplied template id against
//      the registry and swallows every error (fire-and-forget);
//   3. inline QR previews stay untracked — the img-src consumers of
//      /app/qr/image must not record qr_downloaded.
// The event-shape contract itself is proven by
// tests/unit/qr-downloaded-tracking.test.mjs.

const chrome = readFileSync(
  "components/merchant/qr-poster/poster-preview-chrome.tsx",
  "utf8"
)
const action = readFileSync("app/app/qr/poster/actions.ts", "utf8")
const panelLive = readFileSync(
  "components/merchant/launch/qr-panel-live.tsx",
  "utf8"
)
const dashboardCard = readFileSync(
  "components/merchant/dashboard-qr-card.tsx",
  "utf8"
)

test("the print button fires tracking without awaiting, then prints", () => {
  assert.match(
    chrome,
    /void recordPosterPrintAction\(/,
    "tracking must be fired-and-forgotten with void, never awaited"
  )
  assert.match(chrome, /window\.print\(\)/, "the print affordance stays intact")
})

test("the tracking action validates the template and never throws", () => {
  assert.match(
    action,
    /getQrPosterTemplate\(/,
    "client-supplied template ids must be validated against the registry"
  )
  assert.match(
    action,
    /catch\s*\{/,
    "the action must swallow analytics failures (printing never depends on it)"
  )
  assert.match(
    action,
    /recordProductEvent\(/,
    "events go through the canonical recordProductEvent path"
  )
})

test("inline QR previews stay untracked", () => {
  assert.doesNotMatch(
    panelLive,
    /qr_downloaded/,
    "the QR panel inline preview must not record download events"
  )
  assert.doesNotMatch(
    dashboardCard,
    /qr_downloaded/,
    "the dashboard inline preview must not record download events"
  )
})
