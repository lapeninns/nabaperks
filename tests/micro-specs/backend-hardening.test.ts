import { createHmac } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"

import { afterEach, describe, expect, it, vi } from "vitest"

import { createSupabaseMock } from "../helpers/supabase"

const backendHardeningMigration =
  "supabase/migrations/20260617110000_backend_hardening.sql"

function readProjectFile(path: string): string {
  return readFileSync(path, "utf8")
}

function readIfExists(path: string): string {
  return existsSync(path) ? readProjectFile(path) : ""
}

function signedCookie(payload: object, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  )
  const signature = createHmac("sha256", secret)
    .update(body)
    .digest("base64url")

  return `${body}.${signature}`
}

describe("backend hardening contracts", () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock("@/lib/supabase/server")
  })

  it("keeps the new database hardening contracts in an idempotent migration", () => {
    expect(existsSync(backendHardeningMigration)).toBe(true)
    const migration = readIfExists(backendHardeningMigration)

    expect(migration).toContain(
      "create table if not exists public.reward_scan_tokens"
    )
    expect(migration).toContain(
      "create table if not exists public.stripe_webhook_events"
    )
    expect(migration).toContain(
      "create table if not exists public.customer_sessions"
    )
    expect(migration).toContain(
      "create or replace function public.create_reward_scan_token"
    )
    expect(migration).toContain(
      "create or replace function public.get_reward_scan_context"
    )
    expect(migration).toContain(
      "create or replace function public.collect_reward_scan_token"
    )
    expect(migration).toContain(
      "create or replace function public.register_customer_session"
    )
    expect(migration).toContain(
      "create or replace function public.revoke_customer_session"
    )
    expect(migration).toContain("force row level security")
    expect(migration).toContain("grant execute")
  })

  it("makes tenant isolation SQL self-contained instead of seed-count coupled", () => {
    const tenantTest = readProjectFile("supabase/tests/tenant_isolation.sql")

    expect(tenantTest).toContain("tenant_isolation_fixture")
    expect(tenantTest).toContain("insert into public.merchants")
    expect(tenantTest).toContain("insert into public.customers")
    expect(tenantTest).not.toContain("00000000-0000-0000-0000-000000000101")
    expect(tenantTest).not.toContain("15000000-0000-0000-0000-000000000001")
    expect(tenantTest).not.toContain(
      "merchant owner A saw % customers, expected 5"
    )
  })

  it("claims Stripe webhook events once before handling side effects", async () => {
    const supabase = createSupabaseMock({
      from: {
        stripe_webhook_events: [
          {
            data: { stripe_event_id: "evt_1" },
            error: null,
          },
          {
            data: null,
            error: { code: "23505", message: "duplicate key value" },
          },
        ],
      },
    })
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServiceRoleClient: () => supabase.client,
    }))

    const { claimStripeWebhookEvent } =
      await import("@/lib/stripe/webhook-events")
    const event = {
      id: "evt_1",
      type: "customer.subscription.updated",
      livemode: false,
      created: 1_781_000_000,
    }

    await expect(claimStripeWebhookEvent(event)).resolves.toEqual({
      status: "claimed",
    })
    await expect(claimStripeWebhookEvent(event)).resolves.toEqual({
      status: "duplicate",
    })
    expect(supabase.queryCalls).toContainEqual(
      expect.objectContaining({
        table: "stripe_webhook_events",
        method: "insert",
      })
    )
  })

  it("wires the Stripe route to skip duplicate webhook side effects", () => {
    const route = readProjectFile("app/api/stripe/webhook/route.ts")

    expect(route).toContain("claimStripeWebhookEvent")
    expect(route).toContain("markStripeWebhookEventProcessed")
    expect(route).toContain("markStripeWebhookEventFailed")
    expect(route).toContain('claim.status === "duplicate"')
  })

  it("accepts signed customer sessions only when they carry a revocable session id", async () => {
    const { readCustomerSessionCookieValue } =
      await import("@/lib/customer/session-cookie")
    const secret = "session-secret-with-enough-entropy"
    const now = 1_781_000_000
    const value = signedCookie(
      {
        version: 2,
        sessionId: "session-1",
        customerId: "customer-1",
        issuedAt: now,
        expiresAt: now + 600,
      },
      secret
    )

    expect(readCustomerSessionCookieValue(value, secret, now + 1)).toEqual({
      ok: true,
      payload: {
        version: 2,
        sessionId: "session-1",
        customerId: "customer-1",
        issuedAt: now,
        expiresAt: now + 600,
      },
    })
  })

  it("centralizes loyalty availability decisions for customer loaders", () => {
    expect(existsSync("lib/customer/availability.ts")).toBe(true)
    const availability = readIfExists("lib/customer/availability.ts")
    const card = readProjectFile("lib/customer/card.ts")
    const join = readProjectFile("lib/customer/join.ts")
    const reward = readProjectFile("lib/customer/reward.ts")

    expect(availability).toContain("loyaltyAvailability")
    expect(availability).toContain("merchant_inactive")
    expect(availability).toContain("card_inactive")
    expect(availability).toContain("billing_blocked")
    expect(card).toContain("loyaltyAvailability")
    expect(join).toContain("loyaltyAvailability")
    expect(reward).toContain("loyaltyAvailability")
  })

  it("enforces the backend hardening gates in the security verifier", () => {
    const verifier = readProjectFile("scripts/verify-security.mjs")

    expect(verifier).toContain("reward_scan_tokens")
    expect(verifier).toContain("stripe_webhook_events")
    expect(verifier).toContain("customer_sessions")
    expect(verifier).toContain("claimStripeWebhookEvent")
    expect(verifier).toContain("tenant_isolation_fixture")
  })
})
