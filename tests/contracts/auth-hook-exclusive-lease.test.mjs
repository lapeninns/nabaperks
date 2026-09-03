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
const v2Migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260902135000_fence_auth_hook_delivery_v2.sql",
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
const envelope = readFileSync(
  new URL("../../app/api/auth/hooks/signed-hook-envelope.ts", import.meta.url),
  "utf8"
)

test("auth-hook delivery claims are exclusive finite leases", () => {
  assert.match(v2Migration, /lease_id uuid/)
  assert.match(v2Migration, /lease_expires_at timestamptz/)
  assert.match(v2Migration, /claim_auth_hook_delivery_v2/)
  assert.match(v2Migration, /return jsonb_build_object\('status', 'busy'\)/)
  assert.match(v2Migration, /and lease_id = p_lease_id/)
  assert.match(
    v2Migration,
    /v_row\.status = 'processing'[\s\S]*v_row\.lease_expires_at > v_now/
  )
})

test("storage uncertainty and busy claims cannot reach providers", () => {
  assert.match(wrapper, /if \(error \|\| !claim\)[\s\S]*throw new Error/)
  for (const route of [email, sms]) {
    assert.match(route, /claim\.status === "busy"/)
    assert.match(route, /hookRetryError\(/)
    assert.match(route, /completeAuthHookDelivery\([\s\S]*leaseId/)
    assert.match(
      route,
      /\? failAuthHookDelivery[\s\S]*: completeAuthHookDelivery/
    )
  }
})

test("email delivery has provider idempotency in addition to lease ownership", () => {
  assert.match(email, /authHookEmailIdempotencyKey\(envelope\.webhookId\)/)
})

test("DB-first deploys retain a fail-closed legacy wire contract", () => {
  assert.match(migration, /returns jsonb/)
  assert.match(v2Migration, /claim_auth_hook_delivery_v2/)
  assert.match(v2Migration, /lease_api_version = 1/)
  assert.match(v2Migration, /lease_api_version = 2/)
  assert.match(
    v2Migration,
    /create or replace function public\.claim_auth_hook_delivery\([\s\S]*select public\.claim_auth_hook_delivery_v2/
  )
  assert.match(
    v2Migration,
    /create or replace function public\.fail_auth_hook_delivery\([\s\S]*set status = 'completed'/
  )
  assert.match(wrapper, /rpc\("claim_auth_hook_delivery_v2"/)
  assert.match(wrapper, /rpc\("complete_auth_hook_delivery_v2"/)
  assert.match(wrapper, /rpc\("fail_auth_hook_delivery_v2"/)
})

test("ambiguous provider outcomes are sealed while definitive rejections reopen", () => {
  for (const route of [email, sms]) {
    assert.match(route, /isDefinitiveProviderRejection/)
    assert.match(route, /completeAuthHookDelivery/)
    assert.match(route, /failAuthHookDelivery/)
  }
  assert.match(
    email,
    /shouldRevokeAfterSendError:[\s\S]*!providerAttempted \|\| isDefinitiveProviderRejection/
  )
  assert.match(v2Migration, /provider_attempted_at is not null[\s\S]*'replay'/)
  assert.match(wrapper, /mark_auth_hook_delivery_attempted_v2/)
})

test("retryable hook responses carry GoTrue retry metadata", () => {
  assert.match(
    envelope,
    /headers: \{ "Retry-After": String\(retryAfterSeconds\) \}/
  )
  for (const route of [email, sms]) {
    assert.match(route, /hookRetryError\(/)
  }
})
