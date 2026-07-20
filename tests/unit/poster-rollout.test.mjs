import assert from "node:assert/strict"
import { test } from "node:test"

import {
  getQrPosterTemplate,
  isQrPosterTemplateId,
  QR_POSTER_PRODUCTION_TEMPLATES,
  QR_POSTER_TEMPLATE_IDS,
  QR_POSTER_TEMPLATES,
} from "@/lib/qr/poster-templates"

test("all eight registered templates validate and resolve metadata", () => {
  assert.equal(QR_POSTER_TEMPLATE_IDS.length, 8)
  for (const id of QR_POSTER_TEMPLATE_IDS) {
    assert.ok(isQrPosterTemplateId(id))
    const template = getQrPosterTemplate(id)
    assert.equal(template?.id, id)
    assert.ok(
      ["production", "review", "experimental"].includes(template.rollout)
    )
  }
  assert.equal(isQrPosterTemplateId("unknown-poster"), false)
  assert.equal(getQrPosterTemplate("unknown-poster"), null)
})

test("the production rotation exposes every registered design in catalogue order", () => {
  assert.deepEqual(
    QR_POSTER_PRODUCTION_TEMPLATES.map(({ id }) => id),
    [
      "primer",
      "window",
      "pinned",
      "seal",
      "tally",
      "lastcall",
      "receipt",
      "chalk",
    ]
  )
  // The whole registry is now launch-ready; the rotation mirrors the catalogue.
  assert.equal(
    QR_POSTER_PRODUCTION_TEMPLATES.length,
    QR_POSTER_TEMPLATES.length
  )
})

test("no registered template is held out of the production rotation", () => {
  const held = QR_POSTER_TEMPLATES.filter(
    ({ rollout }) => rollout !== "production"
  )
  assert.deepEqual(held, [])
})
