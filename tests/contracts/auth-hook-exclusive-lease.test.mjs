import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260902127000_fence_auth_hook_delivery_leases.sql",
    import.meta.url
  ),
  "utf8"
)
const wrapper = readFileSync(
  new URL("../../lib/auth/auth-hook-delivery.ts", import.meta.url),
  "utf8"
)
const email = readFileSync(
  new URL("../../app/api/auth/hooks/send-email/route.ts", import.meta.url),
  "utf8"
)
const sms = readFileSync(
  new URL("../../app/api/auth/hooks/send-sms/route.ts", import.meta.url),
  "utf8"
)

test("auth-hook delivery claims are exclusive finite leases", () => {
  assert.match(migration, /lease_id uuid/)
  assert.match(migration, /lease_expires_at timestamptz/)
  assert.match(
    migration,
    /where status = 'processing';[\s\S]*drop function if exists public\.claim_auth_hook_delivery/
  )
  assert.match(migration, /return jsonb_build_object\('status', 'busy'\)/)
  assert.match(migration, /and lease_id = p_lease_id/)
  assert.match(
    migration,
    /status = 'processing' and v_row\.lease_expires_at > v_now/
  )
})

test("storage uncertainty and busy claims cannot reach providers", () => {
  assert.match(wrapper, /if \(error \|\| !claim\)[\s\S]*throw new Error/)
  for (const route of [email, sms]) {
    assert.match(route, /claim\.status === "busy"/)
    assert.match(route, /completeAuthHookDelivery\([\s\S]*leaseId/)
    assert.match(route, /failAuthHookDelivery\([\s\S]*leaseId/)
  }
})

test("email delivery has provider idempotency in addition to lease ownership", () => {
  assert.match(
    email,
    /authHookEmailIdempotencyKey\([\s\S]*envelope\.webhookId,[\s\S]*claim\.leaseId/
  )
})
