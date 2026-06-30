import assert from "node:assert/strict"
import { test } from "node:test"

import {
  safeMerchantNextPath,
  safeNextPath,
} from "@/lib/navigation/safe-next-path"

test("rejects protocol-relative and external redirect targets", () => {
  assert.equal(safeNextPath("//evil.example/path"), "/home")
  assert.equal(safeMerchantNextPath("https://evil.example/path"), "/app")
})

test("rejects embedded control and whitespace redirect bypasses", () => {
  for (const payload of [
    "/\t/evil.example",
    "/\r/evil.example",
    "/\n/evil.example",
    "/ /evil.example",
    "/\u0000/evil.example",
  ]) {
    assert.equal(safeNextPath(payload), "/home", payload)
    assert.equal(safeMerchantNextPath(payload), "/app", payload)
  }
})

test("preserves safe same-origin paths including search and hash", () => {
  assert.equal(
    safeNextPath("/home/rewards?tab=active#ready"),
    "/home/rewards?tab=active#ready"
  )
  assert.equal(
    safeMerchantNextPath("/app/launch?tab=qr#poster"),
    "/app/launch?tab=qr#poster"
  )
})

test("blocks auth-loop redirects", () => {
  assert.equal(safeNextPath("/home/login?next=/home"), "/home")
  assert.equal(safeMerchantNextPath("/signup?next=/app"), "/app")
})
