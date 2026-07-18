import assert from "node:assert/strict"
import { test } from "node:test"

import { posterDesignIds } from "@/lib/qr/poster-designs"
import { resolvePosterContent } from "@/lib/qr/poster-content"
import {
  posterVisibleCopy,
  posterVisibleCopyByFace,
} from "../support/poster-output-copy.mjs"

test("the rendered-output copy contract covers all eleven visible faces", () => {
  const faces = posterDesignIds().flatMap((id) =>
    posterVisibleCopyByFace(resolvePosterContent(id, 6)).map((face) => ({
      id,
      ...face,
    }))
  )

  assert.equal(faces.length, 11)
  assert.deepEqual(
    faces.map(({ id, face }) => `${id}:${face}`),
    [
      "editorial:sheet",
      "bold:sheet",
      "ticket:sheet",
      "northstar:sheet",
      "thermal:sheet",
      "table-tent:bottom",
      "table-tent:top",
      "table-tent-night:bottom",
      "table-tent-night:top",
      "table-tent-studio:bottom",
      "table-tent-studio:top",
    ]
  )
  assert.ok(faces.every(({ strings }) => strings.length >= 5))
})

test("maximum-card output contracts retain every approved customer-facing tier", () => {
  for (const id of posterDesignIds()) {
    const content = resolvePosterContent(id, 6)
    const strings = posterVisibleCopy(content)
    assert.ok(
      strings.some((value) => /scan/i.test(value)),
      `${id} CTA`
    )
    assert.ok(
      strings.some((value) => /18\+ to redeem/i.test(value)),
      `${id} reassurance`
    )
    assert.ok(
      strings.every((value) => !/[{}]/.test(value)),
      `${id} tokens`
    )
  }
})
