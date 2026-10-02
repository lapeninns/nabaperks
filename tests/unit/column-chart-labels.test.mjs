import assert from "node:assert/strict"
import { test } from "node:test"

import { selectColumnCaptions } from "@/lib/merchant/column-chart-labels"

for (const total of [7, 14]) {
  for (const width of [228, 272, 318, 342, 512, 768]) {
    test(`${total} date captions fit a ${width}px chart with endpoint context`, () => {
      const labelWidths = Array.from({ length: total }, (_, index) =>
        index % 3 === 0 ? 42 : 36
      )
      const columnGap = 4
      const visible = selectColumnCaptions({ width, columnGap, labelWidths })
      assert.equal(visible[0], 0)
      assert.equal(visible.at(-1), total - 1)
      const cellWidth = (width - columnGap * (total - 1)) / total
      const bounds = visible.map((index) => {
        const labelWidth = labelWidths[index]
        const left =
          index === 0
            ? 0
            : index === total - 1
              ? width - labelWidth
              : index * (cellWidth + columnGap) + cellWidth / 2 - labelWidth / 2
        return { left, right: left + labelWidth }
      })
      for (let index = 1; index < bounds.length; index += 1) {
        assert.ok(bounds[index].left - bounds[index - 1].right >= 8)
      }
      assert.ok(
        bounds.every((bound) => bound.left >= 0 && bound.right <= width)
      )
    })
  }
}

test("paired cards use their own width, exposing fewer dates than a wide chart", () => {
  const labelWidths = Array(14).fill(42)
  const paired = selectColumnCaptions({ width: 310, columnGap: 4, labelWidths })
  const single = selectColumnCaptions({ width: 700, columnGap: 4, labelWidths })
  assert.ok(paired.length < single.length)
})

test("empty, single-day and narrower-than-two-caption tracks settle safely", () => {
  assert.deepEqual(
    selectColumnCaptions({ width: 0, columnGap: 0, labelWidths: [] }),
    []
  )
  assert.deepEqual(
    selectColumnCaptions({ width: 100, columnGap: 0, labelWidths: [36] }),
    [0]
  )
  assert.deepEqual(
    selectColumnCaptions({ width: 60, columnGap: 0, labelWidths: [36, 36] }),
    [1]
  )
})
