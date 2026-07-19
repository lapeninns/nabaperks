import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("reward collection requires a verified profile email without per-reward assurance", () => {
  const completion = read("lib", "customer", "profile-completion.ts")
  const form = read("components", "customer", "profile-gate-forms.tsx")
  const actions = read("app", "reward", "[rewardId]", "actions.ts")
  const gate = read("lib", "customer", "experience", "load-profile-gate.ts")
  const qrRoute = read("app", "reward", "[rewardId]", "qr.png", "route.ts")
  const removal = read(
    "supabase",
    "migrations",
    "20260719150000_remove_reward_email_assurance.sql"
  )
  const legacyCompatibility = read(
    "supabase",
    "migrations",
    "20260719180000_allow_legacy_verified_email_rewards.sql"
  )

  assert.match(completion, /Boolean\(fullName\)[\s\S]*emailVerified/)
  assert.match(form, /Email address/)
  assert.doesNotMatch(form, /Continue without email/)
  assert.doesNotMatch(form, /independent security check for your reward/)
  assert.match(actions, /currentCustomer\.emailVerifiedAt/)
  assert.match(actions, /submittedEmail \|\| lockedVerifiedEmail/)
  assert.doesNotMatch(
    actions,
    /hasRewardEmailAssurance|recordRewardEmailAssurance/
  )
  assert.doesNotMatch(gate, /hasRewardEmailAssurance/)
  assert.doesNotMatch(qrRoute, /hasRewardEmailAssurance/)
  assert.match(
    removal,
    /drop table if exists public\.customer_reward_email_assurances/
  )
  assert.match(removal, /require_reward_verified_email_for_scan_token/)
  assert.match(removal, /require_reward_verified_email_for_redeem/)
  assert.match(removal, /Verified email required for reward collection/)
  assert.doesNotMatch(removal, /Fresh email verification required/)
  assert.match(legacyCompatibility, /customers\.email_verified_at is not null/)
  assert.match(legacyCompatibility, /nullif\(btrim\(customers\.email\), ''\)/)
  assert.doesNotMatch(
    legacyCompatibility,
    /(?:customers|reward_record)\.email_hmac\s+is/
  )
})
