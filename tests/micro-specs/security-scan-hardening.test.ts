import { existsSync, readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const migrationPath =
  "supabase/migrations/20260624140000_security_scan_hardening.sql"

function read(path: string) {
  return readFileSync(path, "utf8")
}

describe("deep security scan hardening migration", () => {
  it("enforces browser push endpoint and push-marketing consent boundaries", () => {
    expect(existsSync(migrationPath)).toBe(true)
    const migration = read(migrationPath)

    expect(migration).toContain("is_allowed_web_push_endpoint")
    expect(migration).toContain("fcm.googleapis.com")
    expect(migration).toContain("updates.push.services.mozilla.com")
    expect(migration).toContain("web.push.apple.com")
    expect(migration).toContain("push_subscriptions_allowed_endpoint_check")
    expect(migration).toContain(
      "check (public.is_allowed_web_push_endpoint(endpoint))"
    )
    expect(migration).toContain("'email', 'sms', 'whatsapp', 'push'")
    expect(migration).toContain(
      "p_channel not in ('email', 'sms', 'whatsapp', 'push')"
    )
  })

  it("removes direct merchant membership counter updates and self-assigned verification timestamps", () => {
    const migration = read(migrationPath)

    expect(migration).toContain(
      "drop policy if exists customer_memberships_update_merchant_or_admin"
    )
    expect(migration).toContain("customer_memberships_update_admin_only")
    expect(migration).toContain(
      "new.email_verified_at is distinct from old.email_verified_at"
    )
    expect(migration).toContain(
      "new.phone_verified_at is distinct from old.phone_verified_at"
    )
    expect(migration).toContain("not public.is_service_role_request()")
  })

  it("requires QR proof for the authenticated self-stamp RPC path", () => {
    const migration = read(migrationPath)

    expect(migration).toContain("p_qr_id text")
    expect(migration).toContain("Venue QR scan proof required")
    expect(migration).toContain("Valid venue QR scan proof required")
    expect(migration).toContain("qr_codes.qr_id = v_qr_id")
    expect(migration).toContain(
      "revoke all on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric) from public, anon, authenticated"
    )
    expect(migration).toContain(
      "revoke all on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric, numeric, text, integer) from public, anon, authenticated"
    )
    expect(migration).toContain(
      "from public.issue_self_service_stamp(\n      p_membership_id,\n      p_customer_id,\n      p_latitude"
    )
    expect(migration).toContain("p_qr_id,")
  })
})
