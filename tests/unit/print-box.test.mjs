import assert from "node:assert/strict"
import { test } from "node:test"

import { boxBottom, boxRight, contains, intersects } from "@/lib/print/box"

const outer = { xMm: 0, yMm: 0, widthMm: 100, heightMm: 100 }

test("edges are derived from origin plus extent", () => {
  assert.equal(boxRight({ xMm: 10, yMm: 5, widthMm: 20, heightMm: 8 }), 30)
  assert.equal(boxBottom({ xMm: 10, yMm: 5, widthMm: 20, heightMm: 8 }), 13)
})

test("contains accepts an inner box and rejects any overhang", () => {
  assert.equal(
    contains(outer, { xMm: 10, yMm: 10, widthMm: 10, heightMm: 10 }),
    true
  )
  assert.equal(
    contains(outer, { xMm: 95, yMm: 10, widthMm: 10, heightMm: 10 }),
    false
  )
  assert.equal(
    contains(outer, { xMm: -1, yMm: 10, widthMm: 10, heightMm: 10 }),
    false
  )
})

test("contains tolerates sub-0.05mm float noise at the edge", () => {
  assert.equal(
    contains(outer, { xMm: 0, yMm: 0, widthMm: 100.02, heightMm: 100 }),
    true
  )
})

test("intersects detects overlap but not mere edge contact", () => {
  const a = { xMm: 0, yMm: 0, widthMm: 10, heightMm: 10 }
  assert.equal(
    intersects(a, { xMm: 5, yMm: 5, widthMm: 10, heightMm: 10 }),
    true
  )
  assert.equal(
    intersects(a, { xMm: 10, yMm: 0, widthMm: 10, heightMm: 10 }),
    false
  )
})
