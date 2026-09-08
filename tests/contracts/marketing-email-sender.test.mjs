import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

test("only invite and digest callers opt into the marketing sender", () => {
  for (const file of [
    "app/app/customers/send-reward/actions.ts",
    "lib/notifications/merchant-digest.ts",
  ])
    assert.match(read(file), /category: "marketing"/)
  assert.match(
    read("lib/loyalty-invites/delivery-worker.ts"),
    /config\.marketingFrom \?\? config\.from/
  )
  for (const file of [
    "lib/customer/email-verification.ts",
    "lib/customer/access-continuity.ts",
    "app/api/auth/hooks/send-email/route.ts",
  ])
    assert.doesNotMatch(
      read(file),
      /category: "marketing"|RESEND_MARKETING_FROM/
    )
  const env = JSON.parse(read("config/env-contract.json"))
  assert.equal(
    env.find((e) => e.name === "RESEND_MARKETING_FROM").optional,
    true
  )
  assert.match(read(".env.example"), /^RESEND_MARKETING_FROM=/m)
  const governance = JSON.parse(read("config/vercel-governance-contract.json"))
  for (const spec of Object.values(governance.environments))
    assert.ok(spec.optionalKeys.includes("RESEND_MARKETING_FROM"))
})
