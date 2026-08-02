import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * contract-rewards-merchant-sent (Phase 4) — invite wiring source contract. Proves the
 * app seams are connected without a browser/DB: email PII codec, the attach
 * helper + all attach hooks, the send-action invite creation + email, the claim
 * page, the retention cron, and the env contract.
 */
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const read = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

test("the email PII codec + attach helper are wired to the RPCs", () => {
  const emailPii = read("lib", "customer", "email-pii-core.ts")
  assert.match(emailPii, /export function customerEmailHmac/)
  assert.match(emailPii, /CUSTOMER_EMAIL_HMAC_SECRET/)

  const helper = read("lib", "customer", "reward-invites.ts")
  assert.match(helper, /export async function attachRewardInvitesForCustomer/)
  assert.match(helper, /attach_matched_reward_invites/)
})

test("all three creation choke points attach invites", () => {
  const identity = read("lib", "customer", "identity.ts")
  assert.match(identity, /attachRewardInvitesForCustomer/)

  const profile = read("lib", "customer", "profile.ts")
  assert.match(profile, /attachRewardInvitesForCustomer/)

  const join = read("app", "m", "[merchantSlug]", "join", "actions.ts")
  assert.match(join, /attachRewardInvitesForCustomer/)
})

test("the send action creates an invite + one-off email for an unmatched contact", () => {
  const action = read("app", "app", "customers", "send-reward", "actions.ts")
  assert.match(action, /create_merchant_reward_invite/)
  assert.match(action, /createRewardInviteForUnmatchedContact/)
  assert.match(action, /\.eq\("email", normalizeEmail\(raw\)\)/)
  assert.doesNotMatch(action, /\.ilike\("email"/)
  assert.match(action, /Promise<RewardInviteCreateResult>/)
  assert.match(action, /if \(!inviteResult\.ok\)/)
  assert.match(action, /buildRewardInviteEmail/)
  assert.match(action, /isInviteEmailSuppressed/)
  assert.match(action, /shouldSuppressRewardInviteEmail\(result\)/)
  assert.match(action, /invite-email:/)

  const email = read("lib", "notifications", "reward-invite-email.ts")
  assert.match(email, /export function buildRewardInviteEmail/)
  assert.match(email, /Unsubscribe|unsubscribe/)
})

test("the claim page + unsubscribe are public and IP-limited", () => {
  const page = read("app", "claim", "[token]", "page.tsx")
  assert.match(page, /get_reward_invite_claim_context/)
  assert.match(page, /enforceRateLimit/)
  assert.match(page, /attachRewardInvitesForCustomer/)

  const unsubscribePage = read(
    "app",
    "claim",
    "unsubscribe",
    "[token]",
    "page.tsx"
  )
  assert.match(unsubscribePage, /enforceRateLimit/)

  const actions = read("app", "claim", "unsubscribe", "[token]", "actions.ts")
  assert.match(actions, /suppress_reward_invite_email_by_token/)
})

test("the claim token carries no unsubscribe authority", () => {
  // One 256-bit value used to serve BOTH capabilities — the unsubscribe link
  // was literally `/claim/<claimToken>?unsubscribe=1` — so a leaked claim URL
  // silenced that address across every venue.
  const page = read("app", "claim", "[token]", "page.tsx")
  assert.doesNotMatch(page, /unsubscribe/i)

  const send = read("app", "app", "customers", "send-reward", "actions.ts")
  assert.match(send, /unsubscribeTokenHash/)
  assert.match(send, /p_unsubscribe_token_hash/)
  // The unsubscribe URL must be built from its own secret, not the claim token.
  assert.doesNotMatch(send, /\$\{claimUrl\}\?unsubscribe/)
  assert.match(send, /\/claim\/unsubscribe\/\$\{unsubscribeToken\}/)

  // Send-time suppression is venue-scoped.
  assert.match(send, /reward_invite_email_suppressed/)
  assert.match(send, /p_merchant_id: merchantId/)

  const unsubscribeActions = read(
    "app",
    "claim",
    "unsubscribe",
    "[token]",
    "actions.ts"
  )
  assert.doesNotMatch(unsubscribeActions, /claim_token_hash/)
})

test("the retention cron sweeps invites and the env contract declares the secret", () => {
  const cron = read("app", "api", "cron", "privacy-retention", "route.ts")
  assert.match(cron, /expire_and_purge_reward_invites/)

  const contract = JSON.parse(read("config", "env-contract.json"))
  assert.ok(
    contract.some((entry) => entry.name === "CUSTOMER_EMAIL_HMAC_SECRET"),
    "env contract declares CUSTOMER_EMAIL_HMAC_SECRET"
  )
})
