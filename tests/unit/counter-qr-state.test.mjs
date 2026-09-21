import assert from "node:assert/strict"
import { test } from "node:test"

import {
  counterQrHasImage,
  resolveCounterQrState,
} from "@/lib/merchant/counter-qr-state"

test("the Counter QR state follows the join row and launch readiness", () => {
  assert.equal(
    resolveCounterQrState({ qrCode: null, launchReady: true }),
    "missing"
  )
  assert.equal(
    resolveCounterQrState({ qrCode: { is_active: false }, launchReady: true }),
    "paused"
  )
  assert.equal(
    resolveCounterQrState({ qrCode: { is_active: true }, launchReady: false }),
    "gated"
  )
  assert.equal(
    resolveCounterQrState({ qrCode: { is_active: true }, launchReady: true }),
    "ready"
  )
})

test("paused wins over gated: a switched-off QR never reads as merely not live", () => {
  assert.equal(
    resolveCounterQrState({ qrCode: { is_active: false }, launchReady: false }),
    "paused"
  )
})

test("only a missing row replaces the QR image with the receipt note", () => {
  assert.equal(counterQrHasImage("ready"), true)
  assert.equal(counterQrHasImage("paused"), true)
  assert.equal(counterQrHasImage("gated"), true)
  assert.equal(counterQrHasImage("missing"), false)
})
