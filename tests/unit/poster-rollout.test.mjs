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

test("the production rotation exposes exactly the launch-ready designs", () => {
  assert.deepEqual(
    QR_POSTER_PRODUCTION_TEMPLATES.map(({ id }) => id),
    ["garden", "pinned", "round", "lastcall"]
  )
  // Garden leads the production rotation and is the picker default.
  assert.equal(QR_POSTER_TEMPLATES[0].id, "primer")
  assert.equal(QR_POSTER_PRODUCTION_TEMPLATES[0].id, "garden")
})

test("review and experimental templates stay registered but out of rotation", () => {
  const held = QR_POSTER_TEMPLATES.filter(
    ({ rollout }) => rollout !== "production"
  )
  assert.deepEqual(
    held.map(({ id, rollout }) => `${id}:${rollout}`),
    ["primer:review", "window:review", "seal:review", "tally:experimental"]
  )
  for (const template of held) {
    assert.ok(isQrPosterTemplateId(template.id), `${template.id} still renders`)
  }
})
