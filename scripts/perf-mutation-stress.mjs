/**
 * Write-path concurrency stress harness (local-only).
 *
 * Fires M parallel invocations at the SAME target for each mutation RPC and
 * asserts the single-winner invariants hold under contention:
 *   - issue_self_service_stamp: one earned stamp per business day, rate limit,
 *     no double-count, no cycle corruption, single reward unlock.
 *   - join_customer_membership: idempotent — exactly one membership per
 *     (merchant, customer) under a join race.
 *   - create_or_get_join_qr: exactly one active join QR per location.
 *   - create_reward_scan_token / collect_reward_scan_token: single-use
 *     redemption — a reward can never be collected twice.
 *   - award_referrer_bonus_stamp / drain_due_referrer_bonuses: bonus paid
 *     exactly once per edge; referrer card never overdrawn past the cycle cap.
 *   - issue_birthday_rewards: one birthday reward per (merchant, customer, year).
 *
 * Each RPC call runs in its own transaction with PostgREST-equivalent GUCs
 * (`role` + `request.jwt.claims`), so SECURITY DEFINER bodies, auth.uid() and
 * is_service_role_request() behave exactly as they do in production.
 *
 * Usage:
 *   node scripts/perf-mutation-stress.mjs [--contenders 16] [--keep] [--json]
 *
 * Safety: refuses to run against any non-local database host, exactly like
 * scripts/seed-stress.mjs. Never bypass that check.
 */

import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { performance } from "node:perf_hooks"
import postgres from "postgres"

import { stressCustomerId, stressMembershipId } from "./seed-stress.mjs"

const projectDir = process.cwd()
const MERCHANT_ID = "10000000-0000-0000-0000-000000000001"
const LOCATION_ID = "11000000-0000-0000-0000-000000000001"
const LOYALTY_CARD_ID = "13000000-0000-0000-0000-000000000001"
const MERCHANT_SLUG = "old-crown-girton"
const JOIN_QR_ID = "old-crown-girton"
const OWNER_AUTH_USER_ID = "00000000-0000-0000-0000-000000000304"

// Disjoint stress-seed indexes reserved per scenario (must exist in the seed).
const IDX = {
  stampRace: 777,
  stampUnlock: 778,
  stampFanout: Array.from({ length: 32 }, (_, i) => 810 + i),
  tokenCollect: 555,
  tokenDeadlock: 556,
  refAwardReferrer: 601,
  refAwardFriend: 602,
  refDrainFriend: 603,
  refDrainReferrer: 605,
  refPoolFriendA: 604,
  refPoolFriendB: 607,
  refPoolReferrer: 606,
  birthday: 6, // DOB 1981-07-07: birthday in July (today) by day and month
}

function fixtureAuthId(index) {
  return `f0000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`
}

const JOIN_RACE_CUSTOMER_ID = "f2000000-0000-4000-8000-000000000001"
const JOIN_RACE_AUTH_ID = fixtureAuthId(0xf2)
const TOKEN_REWARD_ID = "f3000000-0000-4000-8000-000000000001"
const TOKEN_DEADLOCK_REWARD_ID = "f3000000-0000-4000-8000-000000000002"
const EDGE_AWARD_ID = "f4000000-0000-4000-8000-000000000001"
const EDGE_DRAIN_ID = "f4000000-0000-4000-8000-000000000002"
const EDGE_POOL_A_ID = "f4000000-0000-4000-8000-000000000003"
const EDGE_POOL_B_ID = "f4000000-0000-4000-8000-000000000004"
const UNLOCK_EXTRA_STAMP_ID = "f5000000-0000-4000-8000-000000000001"
let birthdayWasEnabled = false

const args = parseArgs(process.argv.slice(2))
const M = args.contenders

const env = {
  ...readEnvFile(join(projectDir, ".env.local")),
  ...readEnvFile(join(projectDir, ".env")),
  ...process.env,
}

const dbUrl = env.SUPABASE_DB_URL?.trim()
if (!dbUrl) {
  console.error("SUPABASE_DB_URL is required for mutation stress.")
  process.exit(1)
}
assertWriteTargetIsSafe(dbUrl)

const sql = postgres(dbUrl, { max: Math.max(48, M + 8) })

const runStartedAt = new Date()
const violations = []
const scenarios = []

try {
  await sql`select 1 as ok`
  await assertFixture()
  await setupFixtures()

  await scenarioStampSingleWinner()
  await scenarioStampUnlockRace()
  await scenarioStampFanout()
  await scenarioJoinIdempotent()
  await scenarioJoinQrIdempotent()
  await scenarioTokenMintRace()
  await scenarioTokenCollectRace()
  await scenarioTokenMintCollectDeadlockProbe()
  await scenarioReferralAwardRace()
  await scenarioReferralDrainAwardRace()
  await scenarioReferralPoolGuard()
  await scenarioBirthdayIdempotentRace()

  if (!args.keep) await cleanupFixtures()

  printSummary()
  process.exitCode = violations.length ? 1 : 0
} catch (error) {
  console.error("Mutation stress failed to complete.")
  console.error(error instanceof Error ? error.stack ?? error.message : error)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}

// ---------------------------------------------------------------------------
// RPC plumbing: one transaction per call with PostgREST-equivalent GUCs.
// ---------------------------------------------------------------------------

async function rpc(role, sub, callSql) {
  const claims = JSON.stringify(
    sub ? { sub, role, email: "stress@example.test" } : { role }
  )
  const started = performance.now()
  try {
    const rows = await sql.begin(async (trx) => {
      await trx.unsafe(
        `select set_config('role', $1, true), set_config('request.jwt.claims', $2, true)`,
        [role, claims]
      )
      return trx.unsafe(callSql)
    })
    return { ok: true, rows, ms: performance.now() - started }
  } catch (error) {
    return {
      ok: false,
      code: error?.code ?? "UNKNOWN",
      message: (error?.message ?? String(error)).slice(0, 90),
      ms: performance.now() - started,
    }
  }
}

async function race(label, calls) {
  const started = performance.now()
  const results = await Promise.all(calls.map((make) => make()))
  const wallMs = performance.now() - started

  const successes = results.filter((r) => r.ok)
  const failures = results.filter((r) => !r.ok)
  const byMessage = {}
  for (const f of failures) {
    byMessage[f.message] = (byMessage[f.message] ?? 0) + 1
  }
  const deadlocks = failures.filter((f) => f.code === "40P01").length
  const serializationFailures = failures.filter((f) => f.code === "40001").length
  const latencies = results.map((r) => r.ms).sort((a, b) => a - b)

  const summary = {
    scenario: label,
    contenders: calls.length,
    successes: successes.length,
    failures: failures.length,
    deadlocks,
    serializationFailures,
    wallMs: +wallMs.toFixed(1),
    callMsMedian: +latencies[Math.floor(latencies.length / 2)].toFixed(1),
    callMsMax: +latencies[latencies.length - 1].toFixed(1),
    errorBreakdown: byMessage,
  }
  scenarios.push(summary)
  if (!args.json) console.log(JSON.stringify(summary))

  if (deadlocks > 0) {
    violate(label, `${deadlocks} deadlock(s) (SQLSTATE 40P01) under contention`)
  }
  if (serializationFailures > 0) {
    violate(label, `${serializationFailures} serialization failure(s) (SQLSTATE 40001)`)
  }
  return { results, successes, failures, summary }
}

function violate(scenario, detail) {
  violations.push({ scenario, detail })
}

async function expectCount(scenario, description, expected, query) {
  const [row] = await sql.unsafe(query)
  const actual = Number(row?.n ?? NaN)
  if (actual !== expected) {
    violate(scenario, `${description}: expected ${expected}, got ${actual}`)
  }
  return actual
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function allFixtureIndexes() {
  return [
    IDX.stampRace,
    IDX.stampUnlock,
    ...IDX.stampFanout,
    IDX.tokenCollect,
    IDX.tokenDeadlock,
    IDX.refAwardReferrer,
    IDX.refAwardFriend,
    IDX.refDrainFriend,
    IDX.refDrainReferrer,
    IDX.refPoolFriendA,
    IDX.refPoolFriendB,
    IDX.refPoolReferrer,
    IDX.birthday,
  ]
}

async function assertFixture() {
  const [merchant] = await sql`
    select business_slug from public.merchants where id = ${MERCHANT_ID}
  `
  if (!merchant) throw new Error("Merchant fixture missing. Run pnpm db:setup.")
  const [{ n }] = await sql`
    select count(*)::int as n from public.customer_memberships where merchant_id = ${MERCHANT_ID}
  `
  if (Number(n) < 1000) {
    throw new Error(`Only ${n} members seeded. Run pnpm db:seed:stress first.`)
  }
}

// customers has a guard trigger that blocks auth_user_id/verified-contact
// changes; app.customer_erasure is its sanctioned bypass (same flag the
// admin_purge_stale_customer_pii RPC sets). Fixture-only, transaction-local.
async function updateCustomersUnguarded(statement) {
  await sql.begin(async (trx) => {
    await trx.unsafe(`select set_config('app.customer_erasure', 'true', true)`)
    await trx.unsafe(statement)
  })
}

async function setupFixtures() {
  const indexes = allFixtureIndexes()

  // Link an auth.users row to every fixture customer so auth.uid()-based
  // ownership checks pass for authenticated-role calls.
  for (const index of indexes) {
    const authId = fixtureAuthId(index)
    await sql.unsafe(`
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_token, recovery_token,
        email_change_token_new, email_change, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data, is_super_admin
      ) values (
        '00000000-0000-0000-0000-000000000000', '${authId}', 'authenticated',
        'authenticated', 'stress+auth${index}@example.test', '',
        now(), '', '', '', '', now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false
      ) on conflict (id) do nothing
    `)
    await updateCustomersUnguarded(`
      update public.customers set auth_user_id = '${authId}', updated_at = now()
      where id = '${stressCustomerId(index)}'
    `)
  }

  // Fresh customer for the join race (no membership yet).
  await sql.unsafe(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_token, recovery_token,
      email_change_token_new, email_change, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data, is_super_admin
    ) values (
      '00000000-0000-0000-0000-000000000000', '${JOIN_RACE_AUTH_ID}', 'authenticated',
      'authenticated', 'stress+joinrace@example.test', '',
      now(), '', '', '', '', now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false
    ) on conflict (id) do nothing
  `)
  await updateCustomersUnguarded(`
    insert into public.customers (id, auth_user_id, email, email_verified_at, full_name, date_of_birth)
    values ('${JOIN_RACE_CUSTOMER_ID}', '${JOIN_RACE_AUTH_ID}', 'stress+joinrace@example.test', now(), 'Join Race', '1990-01-01')
    on conflict (id) do update set auth_user_id = excluded.auth_user_id, email_verified_at = excluded.email_verified_at
  `)
  await sql.unsafe(`
    delete from public.customer_memberships
    where merchant_id = '${MERCHANT_ID}' and customer_id = '${JOIN_RACE_CUSTOMER_ID}'
  `)

  // Card is 3 stamps; unlock-race member sits at 2/3 so one stamp unlocks.
  // The stamp RPC derives the cycle count from stamp_events (not the counter
  // column), so the second stamp must be a real event row.
  await sql.unsafe(`
    insert into public.stamp_events (
      id, merchant_id, customer_id, membership_id, loyalty_card_id, location_id,
      event_type, stamps_delta, cycle_number, earned_business_date, metadata
    ) values (
      '${UNLOCK_EXTRA_STAMP_ID}', '${MERCHANT_ID}', '${stressCustomerId(IDX.stampUnlock)}',
      '${stressMembershipId(IDX.stampUnlock)}', '${LOYALTY_CARD_ID}', '${LOCATION_ID}',
      'earned', 1, 1, public.uk_business_date(now()) - 1,
      '{"source":"stress_mutation"}'::jsonb
    ) on conflict (id) do nothing
  `)
  await sql.unsafe(`
    update public.customer_memberships
    set current_stamp_count = 2, total_stamps_earned = 2, updated_at = now()
    where id = '${stressMembershipId(IDX.stampUnlock)}'
  `)

  // Birthday sweep only issues when the card has a birthday reward configured.
  // Remember the prior flag so cleanup can put it back.
  const [cardBefore] = await sql.unsafe(`
    select birthday_reward_enabled from public.loyalty_cards where id = '${LOYALTY_CARD_ID}'
  `)
  birthdayWasEnabled = cardBefore?.birthday_reward_enabled === true
  await sql.unsafe(`
    update public.loyalty_cards
    set birthday_reward_enabled = true,
        birthday_reward_name = coalesce(birthday_reward_name, 'Stress Birthday Treat'),
        birthday_reward_terms = coalesce(birthday_reward_terms, 'Stress terms'),
        updated_at = now()
    where id = '${LOYALTY_CARD_ID}'
  `)

  // Reward-token scenarios: full card + fabricated unlocked stamp_cycle reward.
  for (const [index, rewardId] of [
    [IDX.tokenCollect, TOKEN_REWARD_ID],
    [IDX.tokenDeadlock, TOKEN_DEADLOCK_REWARD_ID],
  ]) {
    await sql.unsafe(`
      update public.customer_memberships
      set current_stamp_count = 3, total_stamps_earned = 3, updated_at = now()
      where id = '${stressMembershipId(index)}'
    `)
    await sql.unsafe(`
      insert into public.reward_events (
        id, merchant_id, customer_id, membership_id, loyalty_card_id,
        status, metadata, reward_name, reward_terms, source, cycle_number
      ) values (
        '${rewardId}', '${MERCHANT_ID}', '${stressCustomerId(index)}',
        '${stressMembershipId(index)}', '${LOYALTY_CARD_ID}',
        'unlocked', '{"source":"stress_mutation"}'::jsonb,
        'Stress Mystery Reward', 'Stress terms', 'stamp_cycle', 1
      ) on conflict (id) do nothing
    `)
  }

  // Referral edges. Friends (referred) already have one earned stamp from the
  // seed, which satisfies the "friend has visited" gate.
  const edges = [
    [EDGE_AWARD_ID, IDX.refAwardFriend, IDX.refAwardReferrer],
    [EDGE_DRAIN_ID, IDX.refDrainFriend, IDX.refDrainReferrer],
    [EDGE_POOL_A_ID, IDX.refPoolFriendA, IDX.refPoolReferrer],
    [EDGE_POOL_B_ID, IDX.refPoolFriendB, IDX.refPoolReferrer],
  ]
  for (const [edgeId, friendIdx, referrerIdx] of edges) {
    await sql.unsafe(`
      insert into public.referrals (id, referred_membership_id, referrer_membership_id, referral_code_used)
      values ('${edgeId}', '${stressMembershipId(friendIdx)}', '${stressMembershipId(referrerIdx)}', 'STRESSREF')
      on conflict (referred_membership_id) do nothing
    `)
  }

  // Pool-guard referrer has exactly one slot left (2 of 3).
  await sql.unsafe(`
    update public.customer_memberships
    set current_stamp_count = 2, total_stamps_earned = 2, updated_at = now()
    where id = '${stressMembershipId(IDX.refPoolReferrer)}'
  `)

  if (!args.json) console.log("# fixtures ready")
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

function stampCall(index) {
  return () =>
    rpc(
      "authenticated",
      fixtureAuthId(index),
      `select * from public.issue_self_service_stamp(
         '${stressMembershipId(index)}'::uuid, '${stressCustomerId(index)}'::uuid,
         '${JOIN_QR_ID}', null, null, null, null, null
       )`
    )
}

async function scenarioStampSingleWinner() {
  const index = IDX.stampRace
  const contenders = Math.max(M, 32)
  const { successes } = await race(
    "stamp:single-winner",
    Array.from({ length: contenders }, () => stampCall(index))
  )

  if (successes.length !== 1) {
    violate(
      "stamp:single-winner",
      `expected exactly 1 successful stamp, got ${successes.length}`
    )
  }
  await expectCount(
    "stamp:single-winner",
    "earned stamps today for the raced membership",
    1,
    `select count(*)::int as n from public.stamp_events
     where membership_id = '${stressMembershipId(index)}'
       and event_type = 'earned'
       and earned_business_date = public.uk_business_date(now())`
  )
  await expectCount(
    "stamp:single-winner",
    "membership stamp count after +1 on seeded 1",
    2,
    `select current_stamp_count::int as n from public.customer_memberships
     where id = '${stressMembershipId(index)}'`
  )
  await expectCount(
    "stamp:single-winner",
    "active cycle number unchanged",
    1,
    `select active_cycle_number::int as n from public.customer_memberships
     where id = '${stressMembershipId(index)}'`
  )
}

async function scenarioStampUnlockRace() {
  const index = IDX.stampUnlock
  const { successes } = await race(
    "stamp:unlock-race",
    Array.from({ length: 8 }, () => stampCall(index))
  )

  if (successes.length !== 1) {
    violate("stamp:unlock-race", `expected 1 winner, got ${successes.length}`)
  }
  const winner = successes[0]?.rows?.[0]
  if (winner && winner.reward_unlocked !== true) {
    violate("stamp:unlock-race", "winning stamp did not report reward_unlocked")
  }
  await expectCount(
    "stamp:unlock-race",
    "stamp_cycle rewards unlocked for the raced membership",
    1,
    `select count(*)::int as n from public.reward_events
     where membership_id = '${stressMembershipId(index)}'
       and source = 'stamp_cycle' and status = 'unlocked'`
  )
  await expectCount(
    "stamp:unlock-race",
    "membership at cycle cap (3/3), never past it",
    3,
    `select current_stamp_count::int as n from public.customer_memberships
     where id = '${stressMembershipId(index)}'`
  )
}

async function scenarioStampFanout() {
  const { successes, summary } = await race(
    "stamp:32-distinct-members",
    IDX.stampFanout.map((index) => stampCall(index))
  )
  if (successes.length !== IDX.stampFanout.length) {
    violate(
      "stamp:32-distinct-members",
      `expected all ${IDX.stampFanout.length} distinct-member stamps to succeed, got ${successes.length}`
    )
  }
  if (!args.json) {
    console.log(
      `# distinct-member write throughput: ${(summary.contenders / (summary.wallMs / 1000)).toFixed(1)} stamps/s`
    )
  }
}

async function scenarioJoinIdempotent() {
  const { successes } = await race(
    "join:idempotent",
    Array.from({ length: 24 }, () => () =>
      rpc(
        "authenticated",
        JOIN_RACE_AUTH_ID,
        `select * from public.join_customer_membership(
           '${JOIN_RACE_CUSTOMER_ID}'::uuid, '${MERCHANT_SLUG}', '${JOIN_QR_ID}', false, 'stress-test'
         )`
      )
    )
  )

  await expectCount(
    "join:idempotent",
    "memberships for the raced (merchant, customer)",
    1,
    `select count(*)::int as n from public.customer_memberships
     where merchant_id = '${MERCHANT_ID}' and customer_id = '${JOIN_RACE_CUSTOMER_ID}'`
  )
  const createdFlags = successes.filter((r) => r.rows?.[0]?.created_membership === true)
  if (createdFlags.length !== 1) {
    violate(
      "join:idempotent",
      `expected exactly 1 call to report created_membership=true, got ${createdFlags.length}`
    )
  }
  const nullResults = successes.filter((r) => !r.rows?.[0]?.membership_id)
  if (nullResults.length > 0) {
    violate(
      "join:idempotent",
      `${nullResults.length} successful call(s) returned a NULL membership_id (ON CONFLICT DO NOTHING snapshot race)`
    )
  }
}

async function scenarioJoinQrIdempotent() {
  const { successes } = await race(
    "join-qr:idempotent",
    Array.from({ length: 16 }, () => () =>
      rpc(
        "authenticated",
        OWNER_AUTH_USER_ID,
        `select * from public.create_or_get_join_qr('${MERCHANT_ID}'::uuid, '${LOYALTY_CARD_ID}'::uuid)`
      )
    )
  )

  await expectCount(
    "join-qr:idempotent",
    "active join QRs for the merchant location",
    1,
    `select count(*)::int as n from public.qr_codes
     where merchant_id = '${MERCHANT_ID}' and location_id = '${LOCATION_ID}'
       and destination_type = 'join' and is_active`
  )
  const distinctQrs = new Set(successes.map((r) => r.rows?.[0]?.qr_code_uuid))
  if (distinctQrs.size > 1) {
    violate("join-qr:idempotent", `calls returned ${distinctQrs.size} distinct QR ids`)
  }
}

async function scenarioTokenMintRace() {
  const { successes } = await race(
    "reward-token:mint-race",
    Array.from({ length: 16 }, () => () =>
      rpc(
        "service_role",
        null,
        `select * from public.create_reward_scan_token(
           '${TOKEN_REWARD_ID}'::uuid, '${stressCustomerId(IDX.tokenCollect)}'::uuid
         )`
      )
    )
  )

  const distinctTokens = new Set(successes.map((r) => r.rows?.[0]?.scan_token))
  if (distinctTokens.size !== 1) {
    violate(
      "reward-token:mint-race",
      `expected all mints to converge on 1 reusable token, got ${distinctTokens.size} distinct live tokens`
    )
  }
  await expectCount(
    "reward-token:mint-race",
    "unconsumed live tokens for the reward",
    1,
    `select count(*)::int as n from public.reward_scan_tokens
     where reward_event_id = '${TOKEN_REWARD_ID}' and consumed_at is null`
  )
}

async function scenarioTokenCollectRace() {
  const [{ scan_token: token }] = await sql.unsafe(`
    select id as scan_token from public.reward_scan_tokens
    where reward_event_id = '${TOKEN_REWARD_ID}' and consumed_at is null
    order by created_at desc limit 1
  `)

  const { successes } = await race(
    "reward-token:collect-race",
    Array.from({ length: 16 }, () => () =>
      rpc(
        "service_role",
        null,
        `select * from public.collect_reward_scan_token('${token}'::uuid, '${MERCHANT_ID}'::uuid)`
      )
    )
  )

  if (successes.length !== 1) {
    violate(
      "reward-token:collect-race",
      `expected exactly 1 successful collect, got ${successes.length}`
    )
  }
  await expectCount(
    "reward-token:collect-race",
    "reward redeemed exactly once",
    1,
    `select count(*)::int as n from public.reward_events
     where id = '${TOKEN_REWARD_ID}' and status = 'redeemed'`
  )
  await expectCount(
    "reward-token:collect-race",
    "cycle advanced exactly once on redemption",
    2,
    `select active_cycle_number::int as n from public.customer_memberships
     where id = '${stressMembershipId(IDX.tokenCollect)}'`
  )
  await expectCount(
    "reward-token:collect-race",
    "stamp count reset after cycle completion",
    0,
    `select current_stamp_count::int as n from public.customer_memberships
     where id = '${stressMembershipId(IDX.tokenCollect)}'`
  )
}

async function scenarioTokenMintCollectDeadlockProbe() {
  const mint = await rpc(
    "service_role",
    null,
    `select * from public.create_reward_scan_token(
       '${TOKEN_DEADLOCK_REWARD_ID}'::uuid, '${stressCustomerId(IDX.tokenDeadlock)}'::uuid
     )`
  )
  if (!mint.ok) {
    violate("reward-token:mint-collect-probe", `pre-mint failed: ${mint.message}`)
    return
  }
  const token = mint.rows[0].scan_token

  await race("reward-token:mint-collect-probe", [
    ...Array.from({ length: 8 }, () => () =>
      rpc(
        "service_role",
        null,
        `select * from public.collect_reward_scan_token('${token}'::uuid, '${MERCHANT_ID}'::uuid)`
      )
    ),
    ...Array.from({ length: 8 }, () => () =>
      rpc(
        "service_role",
        null,
        `select * from public.create_reward_scan_token(
           '${TOKEN_DEADLOCK_REWARD_ID}'::uuid, '${stressCustomerId(IDX.tokenDeadlock)}'::uuid
         )`
      )
    ),
  ])

  await expectCount(
    "reward-token:mint-collect-probe",
    "deadlock-probe reward redeemed exactly once",
    1,
    `select count(*)::int as n from public.reward_events
     where id = '${TOKEN_DEADLOCK_REWARD_ID}' and status = 'redeemed'`
  )
}

async function scenarioReferralAwardRace() {
  const friendMembership = stressMembershipId(IDX.refAwardFriend)
  const referrerMembership = stressMembershipId(IDX.refAwardReferrer)

  await race(
    "referral:award-race",
    Array.from({ length: 16 }, () => () =>
      rpc(
        "service_role",
        null,
        `select public.award_referrer_bonus_stamp('${friendMembership}'::uuid, null)`
      )
    )
  )

  await expectCount(
    "referral:award-race",
    "bonus stamps on the referrer for this edge",
    1,
    `select count(*)::int as n from public.stamp_events
     where membership_id = '${referrerMembership}'
       and metadata ->> 'source' = 'referral_bonus'`
  )
  await expectCount(
    "referral:award-race",
    "edge marked awarded exactly once",
    1,
    `select count(*)::int as n from public.referrals
     where id = '${EDGE_AWARD_ID}' and referrer_bonus_awarded_at is not null`
  )
  await expectCount(
    "referral:award-race",
    "referrer stamp count 1 seed + 1 bonus",
    2,
    `select current_stamp_count::int as n from public.customer_memberships
     where id = '${referrerMembership}'`
  )
}

async function scenarioReferralDrainAwardRace() {
  const friendMembership = stressMembershipId(IDX.refDrainFriend)
  const referrerMembership = stressMembershipId(IDX.refDrainReferrer)

  await race("referral:drain-vs-award", [
    ...Array.from({ length: 4 }, () => () =>
      rpc("service_role", null, `select public.drain_due_referrer_bonuses()`)
    ),
    ...Array.from({ length: 8 }, () => () =>
      rpc(
        "service_role",
        null,
        `select public.award_referrer_bonus_stamp('${friendMembership}'::uuid, null)`
      )
    ),
  ])

  await expectCount(
    "referral:drain-vs-award",
    "bonus stamps on the drain-race referrer",
    1,
    `select count(*)::int as n from public.stamp_events
     where membership_id = '${referrerMembership}'
       and metadata ->> 'source' = 'referral_bonus'`
  )
  await expectCount(
    "referral:drain-vs-award",
    "drain-race edge awarded exactly once",
    1,
    `select count(*)::int as n from public.referrals
     where id = '${EDGE_DRAIN_ID}' and referrer_bonus_awarded_at is not null`
  )
}

async function scenarioReferralPoolGuard() {
  const referrerMembership = stressMembershipId(IDX.refPoolReferrer)
  const friendA = stressMembershipId(IDX.refPoolFriendA)
  const friendB = stressMembershipId(IDX.refPoolFriendB)

  await race("referral:pool-guard", [
    ...Array.from({ length: 6 }, (_, i) => () =>
      rpc(
        "service_role",
        null,
        `select public.award_referrer_bonus_stamp('${i % 2 === 0 ? friendA : friendB}'::uuid, null)`
      )
    ),
  ])

  await expectCount(
    "referral:pool-guard",
    "referrer with 1 slot free gained exactly 1 bonus stamp",
    1,
    `select count(*)::int as n from public.stamp_events
     where membership_id = '${referrerMembership}'
       and metadata ->> 'source' = 'referral_bonus'`
  )
  await expectCount(
    "referral:pool-guard",
    "referrer card capped at 3/3 (never overdrawn)",
    3,
    `select current_stamp_count::int as n from public.customer_memberships
     where id = '${referrerMembership}'`
  )
  await expectCount(
    "referral:pool-guard",
    "exactly one of the two competing edges awarded",
    1,
    `select count(*)::int as n from public.referrals
     where id in ('${EDGE_POOL_A_ID}', '${EDGE_POOL_B_ID}')
       and referrer_bonus_awarded_at is not null`
  )
  await expectCount(
    "referral:pool-guard",
    "the losing edge is still owed (held due, not lost)",
    1,
    `select count(*)::int as n from public.referrals
     where id in ('${EDGE_POOL_A_ID}', '${EDGE_POOL_B_ID}')
       and referrer_bonus_awarded_at is null`
  )
}

async function scenarioBirthdayIdempotentRace() {
  const customerId = stressCustomerId(IDX.birthday)

  await race(
    "birthday:idempotent-race",
    Array.from({ length: 8 }, () => () =>
      rpc(
        "service_role",
        null,
        `select public.issue_birthday_rewards(now(), '${customerId}'::uuid)`
      )
    )
  )

  await expectCount(
    "birthday:idempotent-race",
    "birthday rewards for the raced customer this year",
    1,
    `select count(*)::int as n from public.reward_events
     where customer_id = '${customerId}' and source = 'birthday_month'
       and birthday_year = extract(year from now())::int`
  )
  // Two-rail invariant: an issued (birthday) reward must not touch the
  // stamp-cycle rail.
  await expectCount(
    "birthday:idempotent-race",
    "stamp-cycle rail untouched by issued reward (count still seeded 1)",
    1,
    `select current_stamp_count::int as n from public.customer_memberships
     where id = '${stressMembershipId(IDX.birthday)}'`
  )
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

async function cleanupFixtures() {
  const indexes = allFixtureIndexes()
  const memberships = indexes.map((i) => `'${stressMembershipId(i)}'`).join(",")
  const customers = indexes.map((i) => `'${stressCustomerId(i)}'`).join(",")
  const authIds = [...indexes.map((i) => `'${fixtureAuthId(i)}'`), `'${JOIN_RACE_AUTH_ID}'`].join(",")

  await sql.unsafe(`
    delete from public.notification_events
    where customer_id in (${customers}, '${JOIN_RACE_CUSTOMER_ID}')
  `)
  await sql.unsafe(`
    delete from public.reward_scan_tokens where membership_id in (${memberships})
  `)
  await sql.unsafe(`
    delete from public.reward_events where membership_id in (${memberships})
  `)
  await sql.unsafe(`
    delete from public.referrals
    where id in ('${EDGE_AWARD_ID}','${EDGE_DRAIN_ID}','${EDGE_POOL_A_ID}','${EDGE_POOL_B_ID}')
  `)
  await sql.unsafe(`
    delete from public.stamp_events
    where membership_id in (${memberships})
      and (metadata ->> 'source' in ('referral_bonus', 'stress_mutation')
        or earned_business_date = public.uk_business_date(now()))
  `)
  if (!birthdayWasEnabled) {
    await sql.unsafe(`
      update public.loyalty_cards
      set birthday_reward_enabled = false, updated_at = now()
      where id = '${LOYALTY_CARD_ID}'
    `)
  }
  await sql.unsafe(`
    delete from public.rate_limit_buckets
    where bucket_key like 'selfstamp:%'
  `)
  await sql.unsafe(`
    delete from public.fraud_flags
    where merchant_id = '${MERCHANT_ID}' and created_at >= '${runStartedAt.toISOString()}'
  `)
  // Restore seeded membership state (1 stamp, cycle 1).
  await sql.unsafe(`
    update public.customer_memberships
    set current_stamp_count = 1, total_stamps_earned = 1, active_cycle_number = 1, updated_at = now()
    where id in (${memberships})
  `)
  await updateCustomersUnguarded(`
    update public.customers set auth_user_id = null
    where id in (${customers}, '${JOIN_RACE_CUSTOMER_ID}')
  `)
  // Join-race membership + customer ride the stress+% cleanup in
  // db:clean:stress; the fabricated auth.users rows do not, so drop them here.
  await sql.unsafe(`delete from auth.users where id in (${authIds})`)

  if (!args.json) console.log("# fixtures cleaned")
}

// ---------------------------------------------------------------------------
// Reporting + argument/env helpers
// ---------------------------------------------------------------------------

function printSummary() {
  const summary = {
    contendersDefault: M,
    scenarios: scenarios.length,
    totalDeadlocks: scenarios.reduce((sum, s) => sum + s.deadlocks, 0),
    totalSerializationFailures: scenarios.reduce(
      (sum, s) => sum + s.serializationFailures,
      0
    ),
    violations,
    pass: violations.length === 0,
  }
  console.log(JSON.stringify({ MUTATION_STRESS_SUMMARY: summary }, null, 2))
}

function parseArgs(argv) {
  const parsed = { contenders: 16, keep: false, json: false }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === "--keep") parsed.keep = true
    else if (token === "--json") parsed.json = true
    else if (token === "--contenders") {
      const value = Number.parseInt(argv[index + 1], 10)
      if (!Number.isFinite(value) || value < 2 || value > 64) {
        throw new Error("--contenders must be an integer between 2 and 64")
      }
      parsed.contenders = value
      index += 1
    } else {
      throw new Error(`Unknown argument: ${token}`)
    }
  }
  return parsed
}

function readEnvFile(path) {
  if (!existsSync(path)) return {}
  const parsed = {}
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const equalsIndex = trimmed.indexOf("=")
    if (equalsIndex === -1) continue
    const key = trimmed.slice(0, equalsIndex).trim()
    let value = trimmed.slice(equalsIndex + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    parsed[key] = value
  }
  return parsed
}

function assertWriteTargetIsSafe(dbUrl) {
  let host = ""
  try {
    host = new URL(dbUrl).hostname.toLowerCase()
  } catch {
    console.error("Refusing to run mutation stress: unparseable SUPABASE_DB_URL.")
    process.exit(1)
  }
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    console.error(`Refusing to run mutation stress against non-local host "${host}".`)
    console.error("Point SUPABASE_DB_URL at a local disposable database.")
    process.exit(1)
  }
}
