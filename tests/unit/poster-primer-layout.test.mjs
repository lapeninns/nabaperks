import assert from "node:assert/strict"
import { test } from "node:test"

import { checkLedger } from "@/lib/print/guards"
import { checkZoneRhythm } from "@/lib/print/qr-floor"
import { primerLayout } from "@/lib/notifications/poster-pdf-a4-primer-layout"
import { createPosterDocument } from "@/lib/notifications/poster-pdf-document"
import { resolvePosterContent } from "@/lib/qr/poster-content"

const content = resolvePosterContent("primer", 3)

/** Ground-truth metrics: the same embedded fonts the painter draws with. */
async function pdfMetrics() {
  const { fonts } = await createPosterDocument("probe", "probe")
  return {
    widthPt: (text, sizePt) => fonts.bold.widthOfTextAtSize(text, sizePt),
    normalise: (text) => text,
  }
}

test("the primer layout raises no guard violations", async () => {
  const { ledger } = primerLayout(content, await pdfMetrics())
  assert.deepEqual(checkLedger(ledger), [])
})

test("the primer zone stack sits on the rhythm scale", async () => {
  const { zones } = primerLayout(content, await pdfMetrics())
  assert.deepEqual(checkZoneRhythm(zones), [])
})

test("no clause rule overlaps its own detail text — defects #1 and #2", async () => {
  const { ledger } = primerLayout(content, await pdfMetrics())
  const details = ledger.marks.filter((mark) =>
    mark.label.startsWith("clause-detail-")
  )
  const rules = ledger.marks.filter((mark) =>
    mark.label.startsWith("clause-rule-")
  )
  assert.equal(details.length, content.clauses.length)
  // A separator separates: one fewer rule than clauses.
  assert.equal(rules.length, content.clauses.length - 1)
  for (const rule of rules) {
    const index = rule.label.replace("clause-rule-", "")
    const detail = details.find(
      (mark) => mark.label === `clause-detail-${index}`
    )
    assert.ok(
      rule.box.yMm >= detail.box.yMm + detail.box.heightMm,
      `rule ${index} sits below its detail text`
    )
  }
})

test("the clause block fits PROOF with the headline in STATEMENT", async () => {
  const { zones, headlineLines } = primerLayout(content, await pdfMetrics())
  assert.equal(headlineLines.length, 3, "headline sets in three lines")
  assert.ok(zones.proof.heightMm > 0)
  assert.ok(zones.statement.heightMm >= 44, "STATEMENT keeps its floor")
})
