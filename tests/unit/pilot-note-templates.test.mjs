import assert from "node:assert/strict"
import { test } from "node:test"

import {
  PILOT_NOTE_TYPES,
  pilotNotePlaceholder,
} from "@/lib/admin/pilot-note-templates"

test("every note type has a distinct, non-empty placeholder", () => {
  const seen = new Set()
  for (const type of PILOT_NOTE_TYPES) {
    const placeholder = pilotNotePlaceholder(type.value)
    assert.ok(placeholder.length > 0, `empty placeholder for ${type.value}`)
    assert.ok(!seen.has(placeholder), `duplicate placeholder for ${type.value}`)
    seen.add(placeholder)
  }
})

test("a cancellation note asks for the reason and outcome", () => {
  assert.match(pilotNotePlaceholder("cancellation_reason"), /Why they cancelled/)
})

test("an unknown note type falls back to the support placeholder", () => {
  assert.equal(
    pilotNotePlaceholder("not-a-real-type"),
    pilotNotePlaceholder("support")
  )
})

test("placeholders carry no exclamation marks", () => {
  for (const type of PILOT_NOTE_TYPES) {
    assert.ok(!pilotNotePlaceholder(type.value).includes("!"))
  }
})
