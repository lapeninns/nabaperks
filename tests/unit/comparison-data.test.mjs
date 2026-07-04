import assert from "node:assert/strict"
import { test } from "node:test"

import {
  COMPARISON_ROWS,
  comparisonGapsForColumn,
} from "@/components/marketing/landing/comparison-data"

test("comparisonGapsForColumn returns only rows an alternative fails", () => {
  const walletGaps = comparisonGapsForColumn(1).map((row) => row.feature)

  assert.deepEqual(walletGaps, [
    COMPARISON_ROWS[0].feature,
    COMPARISON_ROWS[2].feature,
    COMPARISON_ROWS[4].feature,
  ])
})
