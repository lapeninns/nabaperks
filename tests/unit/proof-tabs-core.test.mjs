import assert from "node:assert/strict"
import { test } from "node:test"

import {
  proofPanelIdFromHash,
  resolveProofActiveId,
} from "@/components/marketing/landing/proof-tabs-core"

const panels = [
  { id: "nabaperks-proof" },
  { id: "old-crown" },
  { id: "venue-proof" },
]

test("resolveProofActiveId defaults to the first panel", () => {
  assert.equal(
    resolveProofActiveId({
      panels,
      selection: null,
      hash: "",
      hashPanelId: null,
    }),
    "nabaperks-proof"
  )
})

test("resolveProofActiveId honors a chip selection for the current hash", () => {
  assert.equal(
    resolveProofActiveId({
      panels,
      selection: { forHash: "", id: "old-crown" },
      hash: "",
      hashPanelId: null,
    }),
    "old-crown"
  )
})

test("resolveProofActiveId ignores stale chip selection after the hash changes", () => {
  assert.equal(
    resolveProofActiveId({
      panels,
      selection: { forHash: "", id: "venue-proof" },
      hash: "old-crown",
      hashPanelId: "old-crown",
    }),
    "old-crown"
  )
})

test("resolveProofActiveId lets chip selection override a hash-matched panel", () => {
  assert.equal(
    resolveProofActiveId({
      panels,
      selection: { forHash: "old-crown", id: "venue-proof" },
      hash: "old-crown",
      hashPanelId: "old-crown",
    }),
    "venue-proof"
  )
})

test("resolveProofActiveId defers hash deep links until honorHash is true", () => {
  assert.equal(
    resolveProofActiveId({
      panels,
      selection: null,
      hash: "old-crown",
      hashPanelId: "old-crown",
      honorHash: false,
    }),
    "nabaperks-proof"
  )
})

test("proofPanelIdFromHash returns null for unrelated anchors", () => {
  assert.equal(proofPanelIdFromHash(panels, "faq"), null)
  assert.equal(proofPanelIdFromHash(panels, "old-crown"), "old-crown")
})
