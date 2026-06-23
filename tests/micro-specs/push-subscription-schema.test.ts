import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const migrationsDir = join(root, "supabase/migrations")
const schemaRulesPath = join(root, "scripts/verify-supabase-schema-rules.mjs")
const sqlTestPath = join(root, "supabase/tests/browser_push_notifications.sql")

function allMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
    .join("\n")
}

function notificationMigration() {
  const migration = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(join(migrationsDir, file), "utf8"))
    .find((source) => source.includes("push_subscriptions"))

  return migration ?? ""
}

describe("browser push subscription schema", () => {
  it("adds customer-owned push subscription and preference tables with RLS", () => {
    const migrations = allMigrations()

    for (const table of ["push_subscriptions", "notification_preferences"]) {
      expect(migrations).toContain(`create table public.${table}`)
      expect(migrations).toContain(
        `alter table public.${table} enable row level security`
      )
      expect(migrations).toContain(
        `alter table public.${table} force row level security`
      )
      expect(migrations).toContain(
        `create policy ${table}_select_customer_or_admin`
      )
    }

    expect(migrations).toContain("endpoint text not null")
    expect(migrations).toContain("p256dh text not null")
    expect(migrations).toContain("auth text not null")
    expect(migrations).toContain("permission_state text not null")
    expect(migrations).toContain("enabled boolean not null default true")
    expect(migrations).toContain("revoked_at timestamptz")
    expect(migrations).toContain("last_seen_at timestamptz")
    expect(migrations).toContain("last_success_at timestamptz")
    expect(migrations).toContain("last_failure_at timestamptz")
    expect(migrations).toContain("failure_reason text")
    expect(migrations).toContain("transactional_enabled boolean not null default true")
    expect(migrations).toContain("reminder_enabled boolean not null default true")
    expect(migrations).toContain("marketing_enabled boolean not null default false")
    expect(migrations).not.toContain("alter table public.consent_records add column")
  })

  it("exposes customer-scoped helper RPCs without broad direct writes", () => {
    const migrations = allMigrations()
    const migration = notificationMigration()

    expect(migrations).toContain("create or replace function public.register_push_subscription")
    expect(migrations).toContain("create or replace function public.disable_push_subscription")
    expect(migrations).toContain("create or replace function public.update_notification_preferences")
    expect(migrations).toContain("create or replace function public.get_notification_preferences")
    expect(migrations).toContain("security definer")
    expect(migrations).toContain("(select public.is_customer_owner(customer_id))")
    expect(migrations).toContain("auth_user_id = (select auth.uid())")
    expect(migration).not.toContain("latitude")
    expect(migration).not.toContain("longitude")
  })

  it("registers schema verification and local-only SQL coverage", () => {
    const schemaRules = readFileSync(schemaRulesPath, "utf8")

    expect(schemaRules).toContain('"push_subscriptions"')
    expect(schemaRules).toContain('"notification_preferences"')
    expect(schemaRules).toContain('"register_push_subscription"')
    expect(schemaRules).toContain('"disable_push_subscription"')
    expect(schemaRules).toContain('"update_notification_preferences"')
    expect(schemaRules).toContain('"get_notification_preferences"')
    expect(existsSync(sqlTestPath)).toBe(true)

    const sqlTest = readFileSync(sqlTestPath, "utf8")
    expect(sqlTest).toContain("browser_push_notifications_fixture")
    expect(sqlTest).toContain("customer A cannot read customer B subscription")
    expect(sqlTest).toContain("opt-out disables future sends")
  })
})
