import assert from "node:assert/strict"
import { test } from "node:test"

import { liveArea } from "@/lib/print/geometry"
import { A4_FLEXIBLE_MM, solveA4Zones } from "@/lib/print/zones"

test("the stack consumes the live area exactly, leaving no dead space", () => {
  for (const proof of [24, 32, 40]) {
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
  assert.equal(solveA4Zones(40).statement.heightMm, A4_FLEXIBLE_MM - 40)
})

test("ACTION is reserved at 64mm regardless of PROOF", () => {
  assert.equal(solveA4Zones(24).action.heightMm, 64)
  assert.equal(solveA4Zones(40).action.heightMm, 64)
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

test("PROOF outside 24-40mm is a programming error", () => {
  assert.throws(() => solveA4Zones(23), /outside/)
  assert.throws(() => solveA4Zones(41), /outside/)
})
