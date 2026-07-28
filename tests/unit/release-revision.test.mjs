import assert from "node:assert/strict"
import { test } from "node:test"

import { releaseRevision } from "../../lib/observability/release-revision.ts"

const REVISION = "1234567890abcdef1234567890abcdef12345678"

test("release revision falls back to the immutable build SHA when CLI runtime metadata is blank", () => {
  assert.equal(
    releaseRevision({
      buildRevision: REVISION,
      fallback: "0.0.1",
      runtimeRevision: "",
    }),
    REVISION.slice(0, 12)
  )
})

test("release revision accepts matching runtime and build identities", () => {
  assert.equal(
    releaseRevision({
      buildRevision: REVISION.toUpperCase(),
      fallback: "0.0.1",
      runtimeRevision: REVISION,
    }),
    REVISION.slice(0, 12)
  )
})

test("release revision fails closed on mismatched identities", () => {
  assert.equal(
    releaseRevision({
      buildRevision: REVISION,
      fallback: "0.0.1",
      runtimeRevision: "abcdef1234567890abcdef1234567890abcdef12",
    }),
    "revision-mismatch"
  )
})

test("release revision rejects malformed supplied identities", () => {
  assert.equal(
    releaseRevision({
      buildRevision: "not-a-full-sha",
      fallback: "0.0.1",
    }),
    "invalid-revision"
  )
})

test("release revision preserves the package fallback outside a release build", () => {
  assert.equal(
    releaseRevision({
      buildRevision: " ",
      fallback: "0.0.1",
      runtimeRevision: undefined,
    }),
    "0.0.1"
  )
})
