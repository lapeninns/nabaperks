import assert from "node:assert/strict"
import test from "node:test"

import { resolvePreviewShareOrigin } from "@/lib/qr/preview-share-origin"

test("resolvePreviewShareOrigin prefers an explicit http(s) override", () => {
  assert.equal(
    resolvePreviewShareOrigin({
      override: "https://nabaperks.com/",
      host: "127.0.0.1:3000",
      protocol: "http",
    }),
    "https://nabaperks.com"
  )
})

test("resolvePreviewShareOrigin falls back to the request host", () => {
  assert.equal(
    resolvePreviewShareOrigin({
      override: null,
      host: "127.0.0.1:3000",
      protocol: "http",
    }),
    "http://127.0.0.1:3000"
  )
})
