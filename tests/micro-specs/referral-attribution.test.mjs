import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * MS-referral-attribution — source-scan tier.
 *
 * Proves the attribution rails are wired the way the spec's constraints demand:
 * server-authoritative (a SECURITY DEFINER RPC, not a client write), opaque
 * codes (resolved by referral_code, never the raw membership UUID), RLS on the
 * edge, and the join action forwarding `?ref` to the RPC as `p_ref`.
 */

const root = process.cwd()
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8")

const migration = read(
  "supabase/migrations/20260708090000_referral_attribution.sql"
)
const actions = read("app/m/[merchantSlug]/join/actions.ts")

test("the join wrapper takes an optional p_ref and stays SECURITY DEFINER", () => {
  assert.match(
    migration,
    /create function public\.join_customer_membership_with_first_stamp\([^)]*p_ref text default null/,
    "the wrapper gains an optional p_ref argument"
  )
  assert.match(
    migration,
    /create function public\.join_customer_membership_with_first_stamp[\s\S]*?security definer/,
    "the wrapper is server-authoritative (security definer)"
  )
})

test("attribution lands in an RLS-protected referrals edge, resolved by opaque code", () => {
  assert.match(migration, /create table if not exists public\.referrals/)
  assert.match(
    migration,
    /referred_membership_id uuid not null unique/,
    "at most one referrer per membership"
  )
  assert.match(
    migration,
    /alter table public\.referrals enable row level security/,
    "RLS is enabled on the edge"
  )
  assert.match(
    migration,
    /create policy referrals_select_scoped[\s\S]*?is_customer_owner/,
    "reads are confined to the owning memberships"
  )
  assert.match(
    migration,
    /rm\.referral_code = btrim\(p_ref\)/,
    "ref is resolved by the opaque code, not a membership id"
  )
})

test("referral_code is a generated opaque string, never the membership UUID", () => {
  assert.match(migration, /add column if not exists referral_code text/)
  assert.match(
    migration,
    /generate_membership_referral_code[\s\S]*?gen_random_bytes/,
    "the code is minted from random bytes (base64url), like qr_id"
  )
})

test("the join action forwards ?ref to the RPC as p_ref", () => {
  assert.match(
    actions,
    /const ref = value\(formData, "ref"\)/,
    "the action reads ref from the submitted form"
  )
  assert.match(
    actions,
    /ref \? \{ \.\.\.joinArgs, p_ref: ref \} : joinArgs/,
    "and forwards it as p_ref only when present (7-arg-compatible before the migration)"
  )
})
