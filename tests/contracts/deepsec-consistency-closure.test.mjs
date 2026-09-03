import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const root = process.cwd()
const read = (...parts) => readFileSync(join(root, ...parts), "utf8")

test("all external GitHub Actions are pinned to full commit SHAs", () => {
  const files = [
    ...readdirSync(join(root, ".github", "workflows")).map((name) =>
      join(root, ".github", "workflows", name)
    ),
    join(root, ".github", "actions", "setup", "action.yml"),
    join(root, ".github", "actions", "playwright", "action.yml"),
  ]

  for (const file of files) {
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(
      /^\s*-?\s*uses:\s*([^\s#]+)@([^\s#]+)/gm
    )) {
      const action = match[1]
      const revision = match[2]
      if (action.startsWith("./")) continue
      assert.match(revision, /^[a-f0-9]{40}$/, `${action} in ${file}`)
    }
  }
})

test("reward toggles update only activation state inside the audited RPC", () => {
  const action = read("app", "app", "card", "actions.ts")
  const migration = read(
    "supabase",
    "migrations",
    "20260721100000_deepsec_consistency_hardening.sql"
  )

  const toggle = action.slice(
    action.indexOf("export async function toggleRewardPoolItemActiveAction"),
    action.indexOf("export async function deleteRewardPoolItemAction")
  )
  assert.match(toggle, /set_reward_pool_item_active/)
  assert.doesNotMatch(toggle, /\.from\("reward_pool_items"\)/)
  assert.match(migration, /set is_active = p_is_active/i)
  assert.match(migration, /for update of cards/i)
})

test("stale PII retention locks and repeats eligibility before side effects", () => {
  const migration = read(
    "supabase",
    "migrations",
    "20260721100000_deepsec_consistency_hardening.sql"
  )
  const purge = migration.slice(
    migration.indexOf(
      "create or replace function public.admin_purge_stale_customer_pii"
    ),
    migration.indexOf(
      "create table if not exists public.merchant_weekly_digest_runs"
    )
  )

  assert.match(purge, /pg_advisory_xact_lock/)
  assert.match(purge, /for update;/i)
  assert.match(
    purge,
    /update public\.customers as target[\s\S]*target\.updated_at < p_cutoff/i
  )
  assert.match(purge, /if not found then\s+continue;/i)
  assert.ok(
    purge.indexOf("if not found then") <
      purge.indexOf("update public.customer_sessions")
  )
})

test("recycled-number takeover is replaced by device and verified-email continuity", () => {
  const register = read("docs", "operations", "security-risk-register.md")

  assert.match(
    register,
    /SEC-RISK-001: recycled mobile number customer access/i
  )
  assert.match(register, /\| Status\s+\| Remediated in source;/)
  assert.match(register, /\| Risk owner\s+\| `info@lapeninns\.com`\s+\|/)
  assert.match(register, /previously customer-bound device/i)
  assert.match(
    register,
    /unrecognised device without a verified recovery email fails closed/i
  )
  assert.match(register, /Unbound legacy sessions are revoked/i)
})

test("static QR presence limits remain an explicit, time-bounded accepted risk", () => {
  const register = read("docs", "operations", "security-risk-register.md")
  const staticQrRisk = register.split("## SEC-RISK-002:")[1] ?? ""

  assert.match(staticQrRisk, /static QR cannot prove venue presence/i)
  assert.match(staticQrRisk, /\| Status\s+\| Accepted\s+\|/)
  assert.match(staticQrRisk, /\| Review due\s+\| 2 December 2026\s+\|/)
  assert.match(staticQrRisk, /retain its stable static venue QR/i)
  assert.match(
    staticQrRisk,
    /indistinguishable from a legitimate in-venue request/i
  )
  assert.match(
    staticQrRisk,
    /Client GPS alone is not\s+an acceptable closure condition/i
  )
})
