import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8")
}

test("reward collection requires a verified independent email at app and database boundaries", () => {
  const completion = read("lib", "customer", "profile-completion.ts")
  const form = read("components", "customer", "profile-gate-forms.tsx")
  const actions = read("app", "reward", "[rewardId]", "actions.ts")
  const migration = read(
    "supabase",
    "migrations",
    "20260713130000_reward_redemption_verified_email.sql"
  )

  assert.match(completion, /Boolean\(fullName\)[\s\S]*emailVerified/)
  assert.match(form, /Email address/)
  assert.doesNotMatch(form, /Continue without email/)
  assert.match(actions, /currentCustomer\.emailVerifiedAt/)
  assert.match(actions, /submittedEmail \|\| lockedVerifiedEmail/)
  assert.match(migration, /reward_scan_tokens_require_verified_email/)
  assert.match(migration, /reward_events_redeem_require_verified_email/)
  assert.match(migration, /customer_reward_email_assurances/)
  assert.match(migration, /expires_at > now\(\)/)
})
