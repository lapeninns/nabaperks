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

test("recycled-number takeover remains an explicit, time-bounded accepted risk", () => {
  const register = read(
    "docs",
    "operations",
    "security-risk-register.md"
  )

  assert.match(register, /SEC-RISK-001: recycled mobile number customer access/i)
  assert.match(register, /Status \| Accepted/)
  assert.match(register, /Risk owner \| `info@lapeninns\.com`/)
  assert.match(register, /Review due \| 21 October 2026/)
  assert.match(register, /retain phone-only customer access/i)
  assert.match(register, /may therefore inherit the previous holder's customer session/i)
  assert.match(register, /do not solve number\s+reassignment/i)
})
