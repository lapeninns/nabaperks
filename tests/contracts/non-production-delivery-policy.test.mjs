import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

function read(...parts) {
  return readFileSync(join(process.cwd(), ...parts), "utf8")
}

test("every external notification sink uses the shared hosted delivery policy", () => {
  const policy = read(
    "lib",
    "notifications",
    "non-production-delivery-policy.ts"
  )
  const sinks = [
    read("lib", "notifications", "resend.ts"),
    read("lib", "loyalty-invites", "delivery-worker.ts"),
    read("lib", "customer", "verification.ts"),
    read("lib", "notifications", "push-sender.ts"),
  ]

  assert.match(policy, /VERCEL_ENV/)
  assert.match(policy, /VERCEL_TARGET_ENV/)
  assert.match(policy, /NON_PRODUCTION_DELIVERY_HMAC_SECRET/)
  assert.match(policy, /NON_PRODUCTION_DELIVERY_ALLOWLIST/)
  for (const sink of sinks) {
    assert.match(sink, /non-production-delivery-policy/)
    assert.match(sink, /assertDeliveryDestinationAllowed\(/)
  }
})

test("the hosted allowlist configuration is declared without raw destinations", () => {
  const contract = read("config", "env-contract.json")
  const example = read(".env.example")

  assert.match(contract, /NON_PRODUCTION_DELIVERY_HMAC_SECRET/)
  assert.match(contract, /NON_PRODUCTION_DELIVERY_ALLOWLIST/)
  assert.match(example, /^NON_PRODUCTION_DELIVERY_HMAC_SECRET=$/m)
  assert.match(example, /^NON_PRODUCTION_DELIVERY_ALLOWLIST=$/m)
})
