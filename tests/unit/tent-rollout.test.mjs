import assert from "node:assert/strict"
import { test } from "node:test"

import {
  getTentDesign,
  isTentDesignId,
  TENT_DESIGN_IDS,
  TENT_DESIGNS,
  TENT_PRODUCTION_DESIGNS,
} from "@/lib/qr/tent-templates"

test("all five registered tents validate and resolve metadata", () => {
  assert.equal(TENT_DESIGN_IDS.length, 5)
  for (const id of TENT_DESIGN_IDS) {
    assert.ok(isTentDesignId(id))
    const design = getTentDesign(id)
    assert.equal(design?.id, id)
    assert.equal(design.collection, "table-tent")
    assert.equal(design.format, "a4-tent")
    assert.ok(["production", "review", "experimental"].includes(design.rollout))
  }
  assert.equal(isTentDesignId("unknown-tent"), false)
  assert.equal(getTentDesign("unknown-tent"), null)
})

test("the whole tent kit is in the production rotation", () => {
  assert.deepEqual(
    TENT_PRODUCTION_DESIGNS.map(({ id }) => id),
    ["regulars", "welcome", "sealed", "today", "classic"]
  )
  assert.equal(TENT_PRODUCTION_DESIGNS.length, TENT_DESIGNS.length)
})
