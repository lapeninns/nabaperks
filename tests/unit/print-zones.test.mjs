import assert from "node:assert/strict"
import { test } from "node:test"

import { liveArea } from "@/lib/print/geometry"
import {
  A4_FLEXIBLE_MM,
  A4_PROOF_MAX_MM,
  solveA4Zones,
} from "@/lib/print/zones"

test("the stack consumes the live area exactly, leaving no dead space", () => {
  for (const proof of [24, 32, 61.5, A4_PROOF_MAX_MM]) {
    const zones = solveA4Zones(proof)
    const live = liveArea("a4Poster")
    assert.equal(
      zones.rail.yMm,
      live.yMm,
      `proof ${proof} starts at the margin`
    )
    assert.equal(
      zones.legal.yMm + zones.legal.heightMm,
      live.yMm + live.heightMm,
      `proof ${proof} ends exactly at the bottom margin`
    )
  }
})

test("STATEMENT absorbs all slack so PROOF never leaves a gap", () => {
  assert.equal(solveA4Zones(24).statement.heightMm, A4_FLEXIBLE_MM - 24)
  assert.equal(solveA4Zones(61.5).statement.heightMm, A4_FLEXIBLE_MM - 61.5)
})

test("ACTION is reserved at 60mm regardless of PROOF", () => {
  assert.equal(solveA4Zones(24).action.heightMm, 60)
  assert.equal(solveA4Zones(61.5).action.heightMm, 60)
})

test("the budget fits primer, the densest sheet, with real slack", () => {
  // Measured: 3-line headline at 62pt = 69.6mm, four clause rows = 61.5mm.
  const statementNeededMm = 69.6
  const proofNeededMm = 61.5
  assert.ok(
    statementNeededMm + proofNeededMm <= A4_FLEXIBLE_MM,
    `primer needs ${statementNeededMm + proofNeededMm}mm of ${A4_FLEXIBLE_MM}mm`
  )
  assert.ok(A4_FLEXIBLE_MM - (statementNeededMm + proofNeededMm) >= 5)
})

test("zones stack top to bottom in reading order", () => {
  const z = solveA4Zones(30)
  const order = [z.rail, z.statement, z.proof, z.action, z.legal]
  for (let i = 1; i < order.length; i += 1) {
    assert.ok(
      order[i].yMm > order[i - 1].yMm,
      `zone ${i} follows zone ${i - 1}`
    )
  }
})

test("PROOF outside its band is a programming error", () => {
  assert.throws(() => solveA4Zones(23), /outside/)
  assert.throws(() => solveA4Zones(A4_PROOF_MAX_MM + 1), /outside/)
})

test("PROOF can never squeeze STATEMENT below two display lines", () => {
  assert.equal(solveA4Zones(A4_PROOF_MAX_MM).statement.heightMm, 44)
})
