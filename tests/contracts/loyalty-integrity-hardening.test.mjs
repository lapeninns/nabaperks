import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

/**
 * Loyalty integrity — the SQL and the TypeScript must agree.
 *
 * The whole point of 20260805100100 is that a refusal is identified by a stable
 * SQLSTATE rather than by the English text of an exception. That only holds while
 * the NBS.. table in the migration and the map in block-reasons.ts stay in step,
 * and nothing but this test enforces it: they are different languages in
 * different directories, which is exactly how the previous message-matching
 * scheme drifted.
 */

const migration = (name) =>
  readFileSync(
    new URL(`../../supabase/migrations/${name}`, import.meta.url),
    "utf8"
  )

const CARD_UNIQUENESS = migration(
  "20260805100000_one_active_loyalty_card_per_merchant.sql"
)
const STAMP_CODES = migration(
  "20260805100100_stamp_refusal_codes_and_location_verification.sql"
)
const REWARD_EXPIRY = migration(
  "20260805100200_reward_expiry_releases_the_cycle.sql"
)
const SELF_STAMP_ATTEMPT_LIMIT = migration(
  "20260902123000_persist_self_stamp_attempt_limits.sql"
)
const TENANT_SAFE_REWARD_EXPIRY = migration(
  "20260902124000_isolate_reward_expiry_tenants.sql"
)
const FAIR_REWARD_CYCLE_HEALING = migration(
  "20260902132000_fair_reward_cycle_healing.sql"
)
const BLOCK_REASONS = readFileSync(
  new URL("../../lib/customer/experience/block-reasons.ts", import.meta.url),
  "utf8"
)
const STAMP_SERVICE = readFileSync(
  new URL("../../lib/customer/stamp.ts", import.meta.url),
  "utf8"
)
const STAMP_ACTION = readFileSync(
  new URL("../../app/card/[membershipId]/actions.ts", import.meta.url),
  "utf8"
)

test("Given any self-stamp attempt Then its durable allowance is charged first", () => {
  assert.match(
    SELF_STAMP_ATTEMPT_LIMIT,
    /consume_self_service_stamp_attempt[\s\S]*selfstamp-attempt:/
  )
  assert.match(
    SELF_STAMP_ATTEMPT_LIMIT,
    /revoke all on function public\.consume_self_service_stamp_attempt\(uuid, uuid\)[\s\S]*from public, anon, authenticated/
  )

  const prechargeAt = STAMP_SERVICE.indexOf(
    '"consume_self_service_stamp_attempt"'
  )
  const referralAt = STAMP_SERVICE.indexOf("drainReferralBonusesBeforeStamp(")
  const stampAt = STAMP_SERVICE.indexOf('"issue_self_service_stamp"')
  assert.ok(prechargeAt > 0, "attempt precharge is present")
  assert.ok(
    prechargeAt < referralAt,
    "attempt is charged before referral effects"
  )
  assert.ok(prechargeAt < stampAt, "attempt is charged before the stamp RPC")

  const actionChargeAt = STAMP_ACTION.indexOf("chargeSelfStampActionAttempt()")
  const inputAt = STAMP_ACTION.indexOf('value(formData, "membershipId")')
  const qrLookupAt = STAMP_ACTION.indexOf("getStampQrContextForMembership(")
  assert.ok(actionChargeAt > 0, "action-level charge is present")
  assert.ok(actionChargeAt < inputAt, "malformed input is charged")
  assert.ok(
    actionChargeAt < qrLookupAt,
    "invalid and mismatched QR input is charged"
  )
  assert.match(STAMP_ACTION, /selfstamp-action:customer:\$\{customerId\}/)
  assert.match(STAMP_ACTION, /selfstamp-action:request:\$\{requestIdentity\}/)
})

test("Given repeated location refusals Then telemetry is aggregated concurrently", () => {
  assert.match(SELF_STAMP_ATTEMPT_LIMIT, /pg_advisory_xact_lock/)
  assert.match(SELF_STAMP_ATTEMPT_LIMIT, /'attempt_count'/)
  assert.match(SELF_STAMP_ATTEMPT_LIMIT, /interval '15 minutes'/)
  assert.match(
    SELF_STAMP_ATTEMPT_LIMIT,
    /if v_existing_flag\.id is not null then[\s\S]*update public\.fraud_flags[\s\S]*return;/
  )
})

test("Given one poisoned reward-heal candidate Then other tenants still progress", () => {
  assert.match(TENANT_SAFE_REWARD_EXPIRY, /loyalty_billing_entitled/)
  assert.match(TENANT_SAFE_REWARD_EXPIRY, /order by[\s\S]*memberships\.id/)
  assert.match(TENANT_SAFE_REWARD_EXPIRY, /interval '15 minutes'/)
  assert.match(
    TENANT_SAFE_REWARD_EXPIRY,
    /for update of memberships skip locked/
  )
  assert.match(
    TENANT_SAFE_REWARD_EXPIRY,
    /exception\s+when others then[\s\S]*reward_cycle_heal_failures/
  )
  assert.match(
    TENANT_SAFE_REWARD_EXPIRY,
    /alter table public\.reward_cycle_heal_failures force row level security;/
  )
  assert.match(
    TENANT_SAFE_REWARD_EXPIRY,
    /on conflict \(membership_id\) do update/
  )
  assert.doesNotMatch(TENANT_SAFE_REWARD_EXPIRY, /sqlerrm/i)
})

test("Given a non-throwing heal refusal Then tenant-fair cooldown is durable", () => {
  assert.match(FAIR_REWARD_CYCLE_HEALING, /row_number\(\) over/i)
  assert.match(
    FAIR_REWARD_CYCLE_HEALING,
    /partition by memberships\.merchant_id/i
  )
  assert.match(FAIR_REWARD_CYCLE_HEALING, /last_merchant_id[\s\S]*for update/i)
  assert.match(FAIR_REWARD_CYCLE_HEALING, /merchant_id > v_cursor/i)
  assert.match(
    FAIR_REWARD_CYCLE_HEALING,
    /set last_merchant_id = v_last_merchant_id/i
  )
  assert.match(FAIR_REWARD_CYCLE_HEALING, /if v_reward_id is null then/i)
  assert.match(FAIR_REWARD_CYCLE_HEALING, /'NBS15'/)
})

test("Given the card-uniqueness migration Then it reconciles before it constrains", () => {
  // Adding the index without first resolving duplicates would fail on any
  // merchant that already has two active cards.
  const reconcileAt = CARD_UNIQUENESS.indexOf("set is_active = false")
  const indexAt = CARD_UNIQUENESS.indexOf(
    "loyalty_cards_one_active_per_merchant_idx"
  )

  assert.ok(reconcileAt > 0, "reconcile statement present")
  assert.ok(indexAt > reconcileAt, "reconcile runs before the unique index")
  assert.match(
    CARD_UNIQUENESS,
    /create unique index if not exists loyalty_cards_one_active_per_merchant_idx\s+on public\.loyalty_cards \(merchant_id\)\s+where is_active;/
  )
  // Must keep the same winner the four call sites already pick.
  assert.match(CARD_UNIQUENESS, /order by cards\.created_at asc, cards\.id asc/)
})

test("Given every NBS refusal code in SQL Then block-reasons.ts maps exactly the same set", () => {
  const inSql = new Set(
    [...STAMP_CODES.matchAll(/errcode = '(NBS\d{2})'/g)].map((m) => m[1])
  )
  const inTs = new Set(
    [...BLOCK_REASONS.matchAll(/^\s{2}(NBS\d{2}):/gm)].map((m) => m[1])
  )

  assert.ok(inSql.size >= 8, `expected the NBS table, saw ${inSql.size}`)
  assert.deepEqual(
    [...inSql].sort(),
    [...inTs].sort(),
    "every code raised in SQL must be classified in TypeScript, and vice versa"
  )
})

test("Given the reward-ready refusal Then it carries its own code rather than the billing wording", () => {
  // The defect this replaced: 'A reward is already ready to redeem' matched a
  // '%loyalty programme%' arm and was recorded as a billing fault.
  assert.match(
    STAMP_CODES,
    /'A reward is already ready to redeem'\s*\n?\s*using errcode = 'NBS02'/
  )
  assert.match(BLOCK_REASONS, /NBS02: "reward_ready_first"/)
})

test("Given location verification Then only a positive out-of-range fix refuses", () => {
  // NBS10 is raised inside the out-of-range branch; an unresolved fix must fall
  // through to the grace budget instead of refusing.
  assert.match(STAMP_CODES, /v_distance > v_effective_radius_meters/)
  assert.match(STAMP_CODES, /errcode = 'NBS10'/)
  assert.match(STAMP_CODES, /geofence_unverified_grace_limit\(\)/)
  assert.match(STAMP_CODES, /errcode = 'NBS11'/)

  // Poor accuracy is explicitly NOT treated as absence.
  assert.match(STAMP_CODES, /v_location_status := 'poor_accuracy'/)
  const poorAccuracyBranch = STAMP_CODES.slice(
    STAMP_CODES.indexOf("if p_accuracy_meters > 100 then"),
    STAMP_CODES.indexOf("elsif v_distance > v_effective_radius_meters")
  )
  assert.doesNotMatch(poorAccuracyBranch, /raise exception/)
})

test("Given the first two visits Then they are exempt so joining is never gated", () => {
  assert.match(STAMP_CODES, /geofence_first_verified_visit/)
  assert.match(
    STAMP_CODES,
    /select greatest\(coalesce\(p_configured, 3\), 1\);/
  )
  // Lifetime in-venue scans, not the cycle — a third card must not hand out a
  // fresh pair of unverified visits.
  assert.match(
    STAMP_CODES,
    /metadata->>'source' = 'self_service_qr'[\s\S]{0,80}v_visit_number := v_visit_number \+ 1;/
  )
})

test("Given promotional grants Then they neither exempt nor spend the grace budget", () => {
  // Both counters filter on the self-service source, so an offer or invite bonus
  // stamp cannot buy a customer out of verification.
  const visitCount = STAMP_CODES.slice(
    STAMP_CODES.indexOf("into v_visit_number"),
    STAMP_CODES.indexOf("v_visit_number := v_visit_number + 1;")
  )
  assert.match(visitCount, /metadata->>'source' = 'self_service_qr'/)
})

test("Given the velocity signal Then it is scoped to the membership, not the venue", () => {
  // Merchant-wide >= 20 in 15 minutes fired on a good Friday service.
  assert.match(
    STAMP_CODES,
    /stamp_events\.membership_id = p_membership_id\s*\n\s*and stamp_events\.event_type = 'earned'\s*\n\s*and stamp_events\.metadata->>'source' = 'self_service_qr'\s*\n\s*and stamp_events\.created_at > now\(\) - interval '15 minutes'/
  )
  assert.match(STAMP_CODES, /if recent_stamp_count >= 3 and not exists/)
  assert.match(STAMP_CODES, /'scope', 'membership'/)
})

test("Given promotional stamps Then they do not contribute to visit velocity", () => {
  const velocityQuery = STAMP_CODES.slice(
    STAMP_CODES.indexOf("into recent_stamp_count"),
    STAMP_CODES.indexOf("if recent_stamp_count >= 3")
  )

  assert.match(velocityQuery, /metadata->>'source' = 'self_service_qr'/)
})

test("Given an existing geofence opt-out Then the new default does not overwrite it", () => {
  assert.match(STAMP_CODES, /alter column require_geofence set default true/)
  assert.doesNotMatch(
    STAMP_CODES,
    /update public\.merchant_locations\s+set require_geofence = true/
  )
})

test("Given the reward-pool draw Then a vanished item refuses instead of rolling the stamp back", () => {
  assert.match(
    STAMP_CODES,
    /if reward_pool_record\.id is null then\s*\n\s*raise exception[\s\S]{0,120}errcode = 'NBS03'/
  )
})

test("Given an expired stamp-cycle reward Then the cycle is released", () => {
  assert.match(
    REWARD_EXPIRY,
    /active_cycle_number = memberships\.active_cycle_number \+ 1/
  )
  assert.match(
    REWARD_EXPIRY,
    /total_rewards_expired = memberships\.total_rewards_expired \+ 1/
  )
  // Issued rewards carry cycle_number null and must not advance anything.
  assert.match(REWARD_EXPIRY, /if expired_reward\.source = 'stamp_cycle' then/)
})

test("Given earned rewards Then they now have a real 30-day default expiry", () => {
  assert.match(
    REWARD_EXPIRY,
    /alter column reward_expires_after_days set default 30/
  )
  assert.match(
    REWARD_EXPIRY,
    /set reward_expires_after_days = 30,[\s\S]{0,80}where reward_expires_after_days is null/
  )
})

test("Given a cycle completed without a reward Then the sweep heals it before expiring", () => {
  // A full cycle with no reward row has nothing to expire, so healing must come
  // first or such a card would never be released.
  const healAt = REWARD_EXPIRY.indexOf(
    "perform public.release_completed_cycles_without_reward()"
  )
  const expireAt = REWARD_EXPIRY.indexOf("set\n      status = 'expired'")

  assert.ok(healAt > 0, "heal is called from the sweep")
  assert.ok(expireAt > healAt, "heal runs before the expiry pass")
})

test("Given the stamping path Then it does not mint inside a transaction it aborts", () => {
  // Raising NBS02 rolls back anything minted alongside it, which is why the heal
  // lives in the sweep. Guard against a future edit reintroducing it here.
  const gate = STAMP_CODES.slice(
    STAMP_CODES.indexOf(
      "if v_active_cycle_stamp_count >= card_record.stamps_required then"
    ),
    STAMP_CODES.indexOf("errcode = 'NBS02'")
  )
  assert.doesNotMatch(gate, /perform public\.mint_cycle_reward_if_missing/)
})

test("Given the referral wrapper Then no failure path is silent", () => {
  const REFERRAL = readFileSync(
    new URL(
      "../../supabase/migrations/20260805100300_referral_visit_recording_and_failure_ledger.sql",
      import.meta.url
    ),
    "utf8"
  )

  // The post-stamp handler can safely write in the wrapper because no later
  // operation can roll it back. The pre-stamp failure is recorded by the caller
  // in a separate request instead (covered below).
  const wrapperBody = REFERRAL.slice(
    REFERRAL.indexOf(
      "create or replace function public.issue_self_service_stamp"
    )
  )
  const handlers = [...wrapperBody.matchAll(/when others then([\s\S]*?)end;/g)]
  assert.equal(handlers.length, 2, "both referral calls are guarded")
  assert.match(handlers[0][1], /raise warning/)
  assert.doesNotMatch(handlers[0][1], /insert into public\.product_events/)
  assert.match(handlers[1][1], /raise warning/)
  assert.match(handlers[1][1], /insert into public\.product_events/)
  assert.match(handlers[1][1], /'sqlstate', sqlstate/)

  // A full card cannot run the normal location verifier, so it is not counted
  // as a paid visit. The bonus row is also not returned dressed as a visit stamp.
  assert.doesNotMatch(REFERRAL, /'visit_without_stamp'/)
  assert.doesNotMatch(REFERRAL, /set last_visit_at = now\(\)/)
  assert.match(REFERRAL, /stamp_event_id := null;/)

  // STRICT would make every optional-argument call return NULL without running.
  assert.doesNotMatch(REFERRAL, /returns null on null input/)
})

test("Given SQL-written analytics values Then the external allowlist accepts them", () => {
  const REFERRAL = readFileSync(
    new URL(
      "../../supabase/migrations/20260805100300_referral_visit_recording_and_failure_ledger.sql",
      import.meta.url
    ),
    "utf8"
  )
  const PRIVACY = readFileSync(
    new URL("../../lib/analytics/privacy-core.ts", import.meta.url),
    "utf8"
  )

  const outcomes = new Set(
    [...REFERRAL.matchAll(/'outcome', '([a-z_]+)'/g)].map((m) => m[1])
  )
  assert.ok(outcomes.size > 0, "outcome values are emitted")

  const allowBlock = PRIVACY.slice(
    PRIVACY.indexOf("outcome: new Set(["),
    PRIVACY.indexOf("entitlement_status:")
  )
  for (const value of outcomes) {
    assert.match(
      allowBlock,
      new RegExp(`"${value}"`),
      `outcome '${value}' must be on the external analytics allowlist or it is silently dropped`
    )
  }
})

test("Given the offer pass mint Then its refusals carry codes instead of prose", () => {
  const OFFER_PASS = readFileSync(
    new URL(
      "../../supabase/migrations/20260805100400_offer_pass_mint_refusal_codes.sql",
      import.meta.url
    ),
    "utf8"
  )

  for (const code of ["NBP01", "NBP02", "NBP03"]) {
    assert.match(OFFER_PASS, new RegExp(`errcode = '${code}'`))
  }
  // The unlimited-use pass must not be consumed by minting a code.
  assert.doesNotMatch(OFFER_PASS, /update public\.offer_discount_entitlements/)
})

test("Given the merchant expiry setting Then SQL, validation and form agree", () => {
  const SETTING = readFileSync(
    new URL(
      "../../supabase/migrations/20260805100500_merchant_reward_expiry_setting.sql",
      import.meta.url
    ),
    "utf8"
  )
  const FIELDS = readFileSync(
    new URL("../../lib/merchant/reward-expiry-fields.ts", import.meta.url),
    "utf8"
  )
  const ACTIONS = readFileSync(
    new URL("../../app/app/card/actions.ts", import.meta.url),
    "utf8"
  )

  // Adding a defaulted parameter creates a NEW function; leaving the old one
  // callable would make named-parameter calls ambiguous.
  assert.match(
    SETTING,
    /drop function if exists public\.save_loyalty_card\(uuid, uuid, text, integer, text, text, boolean\);/
  )
  // save_loyalty_card is on the authenticated allowlist and must stay there.
  assert.match(
    SETTING,
    /grant execute on function public\.save_loyalty_card\(uuid, uuid, text, integer, text, text, boolean, integer\)\s*\n\s*to authenticated, service_role;/
  )
  // The bound in SQL and the bound in TypeScript must be the same number.
  assert.match(
    SETTING,
    /v_expires_after_days < 1 or v_expires_after_days > 3660/
  )
  assert.match(FIELDS, /MAX_REWARD_EXPIRY_DAYS = 3660/)
  assert.match(FIELDS, /MIN_REWARD_EXPIRY_DAYS = 1/)
  // And the action must actually send it.
  assert.match(ACTIONS, /p_reward_expires_after_days: parsedRewardExpiryDays/)
})

test("Given a location refusal Then the caller records it outside the aborted transaction", () => {
  const STAMP_TS = readFileSync(
    new URL("../../lib/customer/stamp.ts", import.meta.url),
    "utf8"
  )
  const REFUSAL = readFileSync(
    new URL(
      "../../supabase/migrations/20260805100600_record_stamp_location_refusal.sql",
      import.meta.url
    ),
    "utf8"
  )

  // Proven against the live database: a fraud_flags row written inside the
  // refusing transaction is rolled back with the raise, so the RPC must not try.
  const outOfRangeBranch = STAMP_CODES.slice(
    STAMP_CODES.indexOf("v_location_status := 'out_of_range'"),
    STAMP_CODES.indexOf("errcode = 'NBS10'")
  )
  assert.doesNotMatch(
    outOfRangeBranch,
    /perform public\.record_cycle_stamp_soft_geofence_flag/,
    "a flag written before the raise cannot survive it"
  )

  // The caller records it instead, on a fresh transaction.
  assert.match(STAMP_TS, /record_stamp_location_refusal/)
  assert.match(STAMP_TS, /await recordLocationRefusal\(/)
  // Best-effort: it must never turn a handled block into a thrown error.
  assert.match(
    STAMP_TS,
    /async function recordLocationRefusal\([\s\S]*?try \{[\s\S]*?\} catch/
  )
  assert.match(
    STAMP_TS,
    /const \{ error \} = await supabase\.rpc\([\s\S]*?"record_stamp_location_refusal"[\s\S]*?if \(error\)/
  )

  // Both refusal reasons map to a signal, and nothing else does.
  assert.match(
    REFUSAL,
    /when 'location_out_of_range' then 'self_service_geofence_out_of_range'/
  )
  assert.match(
    REFUSAL,
    /when 'location_required' then 'self_service_geofence_unverified'/
  )
  // Ownership is verified, not trusted — this is reachable from service role.
  assert.match(REFUSAL, /v_membership\.customer_id <> p_customer_id/)
  assert.match(REFUSAL, /'outcome', 'blocked'/)
})

test("Given referral settlement fails before stamping Then evidence is committed by the caller", () => {
  const STAMP_TS = readFileSync(
    new URL("../../lib/customer/stamp.ts", import.meta.url),
    "utf8"
  )

  assert.match(
    STAMP_TS,
    /const referralBonusesPreDrained = await drainReferralBonusesBeforeStamp\([\s\S]*?const \{ data, error \} = await supabase\.rpc\(\s*"issue_self_service_stamp"/
  )
  assert.match(STAMP_TS, /eventName: "referral_settlement_failed"/)
  assert.match(STAMP_TS, /p_referral_bonuses_pre_drained:/)
})

test("Given more than one referral-health page Then the mirror reads every page", () => {
  const MIRROR = readFileSync(
    new URL("../../lib/analytics/referral-health.ts", import.meta.url),
    "utf8"
  )

  assert.match(MIRROR, /\.range\(offset, offset \+ PAGE_SIZE - 1\)/)
  assert.match(MIRROR, /if \(rows\.length < PAGE_SIZE\) break/)
  assert.match(MIRROR, /offset \+= PAGE_SIZE/)
})
