import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * contract-referral-bonus-stamp — source-scan tier.
 *
 * Proves the bonus mechanic is wired the way the spec's constraints demand:
 * server-authoritative (a SECURITY DEFINER, service-role-only primitive, not a
 * client write), the bonus is an earned/NULL-dated `referral_bonus` stamp, the
 * inner ledger hook is fail-safe (wrapped), a drain sweep exists, and the shared
 * link is built from the opaque referral_code — never a membership UUID.
 */

const root = process.cwd()
const read = (relativePath) =>
  readFileSync(path.join(root, relativePath), "utf8")

const migration = read(
  "supabase/migrations/20260709090000_referral_bonus_stamp.sql"
)
const actions = read("app/card/[membershipId]/actions.ts")
const cardStampLabels = read("lib/customer/card-stamp-labels.ts")
const cardStamps = read("lib/customer/card-stamps.ts")
const loadStamp = read("lib/customer/experience/load-stamp.ts")
const referralBonusBank = read("lib/customer/referral-bonus-bank.ts")
const homeTile = read("components/customer/home-card-tile.tsx")
const bankPanels = read("components/customer/referral-bonus-bank-panels.tsx")
const bankCopy = read("lib/customer/referral-bonus-bank-copy.ts")
const stampChoreography = read(
  "lib/customer/experience/stamp-choreography.ts"
)
const referral = read("lib/customer/referral.ts")
const liveDbTest = read("tests/db/referral-bonus-stamp.test.mjs")

test("the bonus primitive is SECURITY DEFINER and granted to service_role only", () => {
  assert.match(
    migration,
    /create or replace function public\.award_referrer_bonus_stamp\([\s\S]*?security definer/,
    "the bonus is issued by a security-definer primitive"
  )
  assert.match(
    migration,
    /grant execute on function public\.award_referrer_bonus_stamp\([^)]*\)\s*to service_role/,
    "the primitive is service-role-only (not customer-callable)"
  )
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.award_referrer_bonus_stamp\([^)]*\)\s*to[^;]*authenticated/,
    "the primitive is never granted to authenticated"
  )
})

test("the bonus stamp is an earned, NULL-dated referral_bonus event", () => {
  assert.match(
    migration,
    /'source'\s*,\s*'referral_bonus'/,
    "provenance is referral_bonus"
  )
  assert.match(
    migration,
    /insert into public\.stamp_events[\s\S]*?earned_business_date[\s\S]*?values[\s\S]*?'earned'/,
    "the bonus is an earned stamp"
  )
})

test("the QR-gated stamp entrypoint calls the bonus primitive behind a fail-safe wrapper", () => {
  assert.match(
    migration,
    /create or replace function public\.issue_self_service_stamp\(\s*p_membership_id uuid,\s*p_customer_id uuid,\s*p_qr_id text/,
    "the QR-gated overload (which both stamp paths route through) is re-created"
  )
  assert.match(
    migration,
    /begin[\s\S]*?perform public\.award_referrer_bonus_stamp[\s\S]*?exception\s+when others/,
    "the bonus hook is wrapped so a failure never blocks the friend's stamp"
  )
})

test("a drain sweep exists to pay bonuses held due", () => {
  assert.match(
    migration,
    /create or replace function public\.drain_due_referrer_bonuses\(/,
    "a drain function pays due bonuses when room frees"
  )
})

test("the next venue stamp drains banked referral bonuses for that member", () => {
  assert.match(
    migration,
    /create or replace function public\.drain_due_referrer_bonuses_for_membership\(/,
    "a member-scoped drain function pays due bonuses after a customer stamps"
  )
  assert.match(
    actions,
    /drainReferralBonusBankWithOutcome\(membershipId\)/,
    "the self-stamp action drains the customer's referral bank after the venue stamp lands"
  )
  assert.match(
    actions,
    /bonusStampsApplied/,
    "the applied bonus count returns to the client action state"
  )
  assert.match(
    actions,
    /result\.rewardUnlocked \|\| bonusRewardUnlocked/,
    "drained bonuses that unlock a reward are treated as reward transitions"
  )
  assert.match(
    referralBonusBank,
    /rewardCountBefore[\s\S]*drainReferralBonusBankWithClient[\s\S]*rewardCountAfter/,
    "the drain helper detects whether the drain created a new unlocked reward"
  )
  assert.match(
    stampChoreography,
    /import \{ REFERRAL_BONUS_STAMP_LABEL \} from "@\/lib\/customer\/card-stamp-labels"/,
    "drained bonus stamps use the shared label contract"
  )
})

test("the referral bonus cap banks after two awards per UK business day", () => {
  assert.match(
    migration,
    /v_daily_bonus_cap\s+constant\s+integer\s*:=\s*2/,
    "the daily referral bonus cap is two awards per referrer"
  )
  assert.match(
    migration,
    /public\.uk_business_date\(referrals\.referrer_bonus_awarded_at\)\s*=\s*v_business_date/,
    "awarded bonuses are counted by UK business day"
  )
  assert.match(
    migration,
    /set referrer_bonus_due_at = coalesce\(referrer_bonus_due_at, now\(\)\)/,
    "over-cap bonuses are banked as due instead of dropped"
  )
})

test("customer card and wallet surfaces show banked and applied referral bonuses", () => {
  assert.match(
    bankPanels,
    /data-testid="referral-bonus-bank"/,
    "the customer card exposes the referral bonus bank"
  )
  assert.match(
    bankPanels,
    /data-testid="home-referral-bonus-bank"/,
    "the wallet tile exposes the referral bonus bank"
  )
  assert.match(
    bankCopy,
    /REFERRAL_BONUS_DAILY_CAP\s*=\s*2/,
    "the UI copy uses the same two-per-day referral bonus limit"
  )
  assert.match(
    bankCopy,
    /Your venue stamp lands first/,
    "the UI explains the customer's venue stamp lands before banked referral bonuses"
  )
  assert.match(
    bankCopy,
    /bonus limit is full/,
    "the UI explains banked bonuses stay banked after the daily cap is full"
  )
  assert.match(
    homeTile,
    /ReferralBonusBankMini/,
    "the wallet tile renders the compact bank panel"
  )
})

test("referral bonus stamps stay visible even when their earned date is null", () => {
  assert.match(
    cardStampLabels,
    /REFERRAL_BONUS_STAMP_LABEL\s*=\s*"Bonus"/,
    "NULL-dated referral bonus stamps use a visible label"
  )
  assert.match(
    cardStampLabels,
    /membershipCount/,
    "visible progress is reconciled from the authoritative membership count"
  )
  assert.match(
    cardStampLabels,
    /stampDisplayLabelsForCount/,
    "missing labels are padded so earned bonus dots remain visible"
  )
  assert.match(
    cardStamps,
    /stampEventSource\(event\.metadata\) === "referral_bonus"/,
    "referral bonus events with no business date use the bonus label"
  )
  assert.match(
    loadStamp,
    /\.not\("earned_business_date", "is", null\)[\s\S]*\.order\("earned_business_date"/,
    "same-day stamp checks ignore NULL-dated referral bonus rows"
  )
})

test("the live DB referral bonus race harness cleans committed audit rows and synchronizes contenders", () => {
  assert.match(
    liveDbTest,
    /committedMembershipIds/,
    "committed memberships are tracked alongside committed customers"
  )
  assert.match(
    liveDbTest,
    /delete from public\.product_events where membership_id/,
    "race-run product events are removed before customer teardown"
  )
  assert.match(
    liveDbTest,
    /delete from public\.notification_events where membership_id/,
    "race-run notification events are removed before customer teardown"
  )
  assert.match(
    liveDbTest,
    /createStartBarrier\(2\)/,
    "both award contenders synchronize after opening DB connections"
  )
  assert.match(
    liveDbTest,
    /awardWithStartBarrier/,
    "award calls wait at the shared start barrier"
  )
  assert.match(
    liveDbTest,
    /lc\.stamps_required > 1/,
    "the pool-guard fixture avoids one-stamp card side effects"
  )
  assert.match(
    liveDbTest,
    /where loyalty_card_id = \$\{qr\.loyalty_card_id\}::uuid/,
    "the pool-guard fixture scopes reward-pool changes to one loyalty card"
  )
})

test("the shared link is built from the opaque referral_code, never a UUID", () => {
  assert.match(
    referral,
    /join\?ref=/,
    "the link targets the join route with a ref code"
  )
  assert.match(
    referral,
    /referral_?[cC]ode|referralCode|code/,
    "the link is parameterised by the referral code"
  )
  assert.doesNotMatch(
    referral,
    /membership_?[iI]d|membershipId/,
    "the shared link never carries a membership id"
  )
})
