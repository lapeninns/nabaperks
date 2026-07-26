import assert from "node:assert/strict"
import { test } from "node:test"

import {
  checkQrFloor,
  checkZoneRhythm,
  QR_MODULE_FLOOR_MM,
  qrModuleSizeMm,
} from "@/lib/print/qr-floor"
import { solveA4Zones } from "@/lib/print/zones"

test("module size divides the outer box by modules plus both quiet zones", () => {
  // 54mm poster QR, 41 modules at EC-H, 4-module quiet zone per side.
  assert.equal(qrModuleSizeMm(54, 41, 4).toFixed(3), "1.102")
})

test("G6 passes the poster and fails the current NFC card", () => {
  assert.equal(QR_MODULE_FLOOR_MM, 0.5)
  assert.deepEqual(checkQrFloor(54, 41, 4, "poster"), [])
  const violations = checkQrFloor(18, 41, 4, "nfc-card")
  assert.equal(violations.length, 1)
  assert.match(violations[0].detail, /nfc-card/)
})

test("G5 accepts the solved zone stack at every legal PROOF height", () => {
  for (const proof of [24, 30, 36, 40]) {
    assert.deepEqual(checkZoneRhythm(solveA4Zones(proof)), [], `proof ${proof}`)
  }
})

test("G5 flags a stack whose gaps are off the scale", () => {
  const zones = solveA4Zones(30)
  const nudged = {
    ...zones,
    proof: { ...zones.proof, yMm: zones.proof.yMm + 1 },
  }
  assert.ok(checkZoneRhythm(nudged).length > 0)
})
