import assert from "node:assert/strict"
import { createHmac, randomUUID } from "node:crypto"
import { pathToFileURL } from "node:url"

import postgres from "postgres"

const HTTP_TIMEOUT_MS = 15_000
const ROLLBACK = Symbol("staging-journey-rollback")
const HOSTED_MODE = "hosted"
const EPHEMERAL_MODE = "ephemeral"

if (isMainModule()) {
  await runStagingReleaseProof(process.env)
}

export async function runStagingReleaseProof(env) {
  const config = resolveConfig(env)
  const sql = postgres(config.dbUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
    ssl: config.mode === HOSTED_MODE ? "require" : false,
  })

  try {
    await proveDatabaseTarget(sql, config)
    await proveStagingProbes(config)
    await proveRolledBackLoyaltyJourney(sql, config)
    await proveStripeWebhookReplay(sql, config)
    await proveResendWebhookReplay(config)
    console.log("Staging release proof passed.")
  } finally {
    await sql.end({ timeout: 5 })
  }
}

export function resolveConfig(env) {
  const mode = env.STAGING_MODE?.trim() || HOSTED_MODE
  assert.ok(
    mode === HOSTED_MODE || mode === EPHEMERAL_MODE,
    "staging mode must be hosted or ephemeral"
  )

  const revision = required(env, "STAGING_EXPECTED_REVISION")
  assert.match(
    revision,
    /^[a-f\d]{40}$/i,
    "expected revision must be a full Git SHA"
  )

  const appUrl = parseOrigin(
    required(env, "STAGING_APP_URL"),
    "staging app URL"
  )

  const dbUrl = required(env, "STAGING_SUPABASE_DB_URL")
  const parsedDbUrl = new URL(dbUrl)
  assert.match(
    parsedDbUrl.protocol,
    /^postgres(?:ql)?:$/,
    "staging DB URL must use PostgreSQL"
  )

  let bypassSecret = ""
  let projectRef = "local-ephemeral"
  if (mode === HOSTED_MODE) {
    projectRef = required(env, "STAGING_SUPABASE_PROJECT_REF")
    assert.match(
      projectRef,
      /^[a-z\d]{20}$/,
      "invalid staging Supabase project ref"
    )
    assert.equal(appUrl.protocol, "https:", "staging app must use HTTPS")
    assert.match(
      appUrl.hostname,
      /\.vercel\.app$/,
      "staging proof must use an immutable Vercel deployment URL"
    )
    assert.notEqual(
      parsedDbUrl.hostname,
      "localhost",
      "hosted staging DB must not be local"
    )
    assert.notEqual(
      parsedDbUrl.hostname,
      "127.0.0.1",
      "hosted staging DB must not be local"
    )
    assert.ok(
      parsedDbUrl.hostname.includes(projectRef) ||
        parsedDbUrl.username.endsWith(`.${projectRef}`),
      "staging DB URL must identify the configured staging project ref"
    )
    bypassSecret = required(env, "STAGING_VERCEL_AUTOMATION_BYPASS_SECRET")
  } else {
    assert.equal(
      appUrl.href,
      "http://127.0.0.1:3000/",
      "ephemeral staging app must use the fixed loopback origin"
    )
    assert.equal(
      parsedDbUrl.hostname,
      "127.0.0.1",
      "ephemeral staging DB must use loopback"
    )
    assert.equal(
      parsedDbUrl.port,
      "54322",
      "ephemeral staging DB must use the Supabase CLI port"
    )
    assert.equal(
      parsedDbUrl.pathname,
      "/postgres",
      "ephemeral staging DB must use the local postgres database"
    )
  }

  const stripeWebhookSecret = required(env, "STAGING_STRIPE_WEBHOOK_SECRET")
  assert.match(
    stripeWebhookSecret,
    /^whsec_[A-Za-z\d_]+$/,
    "invalid staging Stripe webhook secret"
  )

  const resendWebhookSecret = required(env, "STAGING_RESEND_WEBHOOK_SECRET")
  assert.ok(
    standardWebhookKey(resendWebhookSecret).length > 0,
    "invalid staging Resend webhook secret"
  )

  return {
    appUrl,
    bypassSecret,
    dbUrl,
    mode,
    monitorSecret: required(env, "STAGING_MONITOR_SECRET"),
    projectRef,
    resendWebhookSecret,
    revision,
    runId: required(env, "STAGING_RUN_ID"),
    stripeWebhookSecret,
  }
}

async function proveDatabaseTarget(sql, config) {
  const [row] = await sql`
    select
      current_database() as database_name,
      current_user as database_user,
      exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'join_customer_membership_with_first_stamp'
      ) as has_join,
      exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'issue_self_service_stamp'
      ) as has_stamp
  `
  assert.ok(row, "staging database identity query returned no row")
  assert.equal(row.has_join, true, "staging join RPC is missing")
  assert.equal(row.has_stamp, true, "staging stamp RPC is missing")
  console.log(
    `Staging database ${row.database_name} is current for ${config.projectRef}.`
  )
}

export async function proveStagingProbes(config) {
  const expectedRevision = config.revision
  const bypassHeaders = protectionHeaders(config)
  const health = await getJson(
    new URL("/api/health", config.appUrl),
    bypassHeaders
  )
  assert.equal(health.status, "ok", "staging liveness is not healthy")
  assert.equal(health.scope, "liveness", "staging liveness scope is wrong")
  assert.equal(
    health.revision,
    expectedRevision,
    "staging liveness revision is wrong"
  )
  assert.equal(
    health.environment,
    "preview",
    "custom staging must remain outside production"
  )
  assert.equal(
    health.targetEnvironment,
    "staging",
    "Vercel custom target is not staging"
  )

  const readiness = await getJson(new URL("/api/readiness", config.appUrl), {
    Authorization: `Bearer ${config.monitorSecret}`,
    ...bypassHeaders,
  })
  assert.equal(readiness.status, "ready", "staging dependencies are not ready")
  assert.equal(readiness.scope, "readiness", "staging readiness scope is wrong")
  assert.equal(
    readiness.checks?.database,
    "ok",
    "staging app cannot reach its database"
  )
  assert.equal(
    readiness.revision,
    expectedRevision,
    "staging readiness revision is wrong"
  )
  assert.equal(
    readiness.environment,
    "preview",
    "staging readiness resolved as production"
  )
  assert.equal(
    readiness.targetEnvironment,
    "staging",
    "staging readiness target is wrong"
  )
}

export async function proveRolledBackLoyaltyJourney(sql, config) {
  const ownerUserId = randomUUID()
  const customerId = randomUUID()
  const suffix = randomUUID().replaceAll("-", "").slice(0, 10)
  const ownerEmail = `release-${suffix}@example.invalid`
  const businessSlug = `release-proof-${suffix}`

  try {
    await sql.begin(async (tx) => {
      await tx`
        insert into auth.users (
          id, email, aud, role, email_confirmed_at, created_at, updated_at
        ) values (
          ${ownerUserId}::uuid,
          ${ownerEmail},
          'authenticated',
          'authenticated',
          now(),
          now(),
          now()
        )
      `
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await tx`select set_config('request.jwt.claim.sub', ${ownerUserId}, true)`

      const [merchant] = await tx`
        select * from public.create_merchant_onboarding(
          ${ownerUserId}::uuid,
          ${ownerEmail},
          ${`Release Proof ${suffix}`},
          ${businessSlug},
          'cafe',
          '+447700900000',
          'Release proof venue'
        )
      `
      assert.ok(merchant?.merchant_id, "staging merchant onboarding failed")

      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      await tx`
        update public.merchants
        set requires_billing = false
        where id = ${merchant.merchant_id}::uuid
      `
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await tx`select set_config('request.jwt.claim.sub', ${ownerUserId}, true)`

      const [card] = await tx`
        select * from public.save_loyalty_card(
          ${merchant.merchant_id}::uuid,
          null,
          'Release proof card',
          3,
          'Release proof reward',
          'Valid for the isolated staging release proof only.',
          true
        )
      `
      assert.ok(card?.loyalty_card_id, "staging loyalty-card creation failed")

      const presets = [
        {
          preset_id: "release-proof-one",
          reward_name: "Release proof one",
          reward_terms: "Valid for this isolated staging proof only.",
        },
        {
          preset_id: "release-proof-two",
          reward_name: "Release proof two",
          reward_terms: "Valid for this isolated staging proof only.",
        },
        {
          preset_id: "release-proof-three",
          reward_name: "Release proof three",
          reward_terms: "Valid for this isolated staging proof only.",
        },
      ]
      const rewards = await tx`
        select * from public.add_reward_pool_presets(
          ${merchant.merchant_id}::uuid,
          ${card.loyalty_card_id}::uuid,
          ${tx.json(presets)}::jsonb
        )
      `
      assert.equal(rewards.length, 3, "staging reward-pool setup failed")

      const [qr] = await tx`
        select * from public.create_or_get_join_qr(
          ${merchant.merchant_id}::uuid,
          ${card.loyalty_card_id}::uuid
        )
      `
      assert.ok(qr?.qr_public_id, "staging join-QR creation failed")

      await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
      await tx`select set_config('request.jwt.claim.sub', '', true)`
      await tx`
        insert into public.customers (
          id, email, email_verified_at, full_name, date_of_birth, created_at, updated_at
        ) values (
          ${customerId}::uuid,
          ${`customer-${suffix}@example.invalid`},
          now(),
          'Release Proof Customer',
          '1990-01-01',
          now(),
          now()
        )
      `

      const [joined] = await tx`
        select * from public.join_customer_membership_with_first_stamp(
          ${customerId}::uuid,
          ${businessSlug},
          ${qr.qr_public_id},
          false,
          'staging-release-v1'
        )
      `
      assert.equal(
        joined?.created_membership,
        true,
        "staging membership was not created"
      )
      assert.equal(
        joined?.first_stamp_issued,
        true,
        "staging first stamp was not issued"
      )

      const membershipId = joined.membership_id
      await ageEarnedStamps(tx, membershipId)
      const [second] = await tx`
        select * from public.issue_self_service_stamp(
          ${membershipId}::uuid,
          ${customerId}::uuid,
          ${qr.qr_public_id},
          null,
          null,
          null,
          null,
          null
        )
      `
      assert.equal(second?.new_stamp_count, 2, "staging second stamp failed")

      await ageEarnedStamps(tx, membershipId)
      const [third] = await tx`
        select * from public.issue_self_service_stamp(
          ${membershipId}::uuid,
          ${customerId}::uuid,
          ${qr.qr_public_id},
          null,
          null,
          null,
          null,
          null
        )
      `
      assert.equal(third?.new_stamp_count, 3, "staging third stamp failed")
      assert.equal(
        third?.reward_unlocked,
        true,
        "staging reward did not unlock"
      )

      const [joinedAgain] = await tx`
        select * from public.join_customer_membership_with_first_stamp(
          ${customerId}::uuid,
          ${businessSlug},
          ${qr.qr_public_id},
          false,
          'staging-release-v1'
        )
      `
      assert.equal(
        joinedAgain?.created_membership,
        false,
        "staging re-join was not idempotent"
      )
      assert.equal(
        joinedAgain?.membership_id,
        membershipId,
        "staging re-join changed membership"
      )

      const [ledger] = await tx`
        select
          (select count(*)::int from public.customer_memberships where id = ${membershipId}::uuid) as memberships,
          (select count(*)::int from public.stamp_events where membership_id = ${membershipId}::uuid and event_type = 'earned') as stamps,
          (select count(*)::int from public.reward_events where membership_id = ${membershipId}::uuid and status = 'unlocked') as rewards
      `
      assert.deepEqual(
        {
          memberships: ledger.memberships,
          rewards: ledger.rewards,
          stamps: ledger.stamps,
        },
        { memberships: 1, rewards: 1, stamps: 3 },
        "staging loyalty ledger is inconsistent"
      )

      throw ROLLBACK
    })
  } catch (error) {
    if (error !== ROLLBACK) throw error
  }

  const [cleanup] = await sql`
    select
      (select count(*)::int from auth.users where id = ${ownerUserId}::uuid) as users,
      (select count(*)::int from public.customers where id = ${customerId}::uuid) as customers
  `
  assert.deepEqual(
    cleanup,
    { customers: 0, users: 0 },
    "staging journey did not roll back"
  )
  console.log(
    `Rolled-back staging loyalty journey passed for ${config.revision.slice(0, 12)}.`
  )
}

async function ageEarnedStamps(tx, membershipId) {
  await tx`
    update public.stamp_events
    set earned_business_date = earned_business_date - 2
    where membership_id = ${membershipId}::uuid
      and event_type = 'earned'
  `
}

async function proveStripeWebhookReplay(sql, config) {
  const safeRunId = config.runId.replace(/[^a-z\d]/gi, "").slice(0, 24)
  const eventId = `evt_staging_${config.revision.slice(0, 12)}_${safeRunId}`
  const timestamp = Math.floor(Date.now() / 1000)
  const body = JSON.stringify({
    api_version: "2025-06-30.basil",
    created: timestamp,
    data: { object: {} },
    id: eventId,
    livemode: false,
    object: "event",
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "staging.release.probe",
  })
  const digest = createHmac("sha256", config.stripeWebhookSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex")
  const headers = {
    "content-type": "application/json",
    "stripe-signature": `t=${timestamp},v1=${digest}`,
    ...protectionHeaders(config),
  }

  try {
    const first = await postJson(
      new URL("/api/stripe/webhook", config.appUrl),
      body,
      headers
    )
    assert.equal(
      first.received,
      true,
      "staging Stripe webhook was not accepted"
    )
    assert.notEqual(
      first.duplicate,
      true,
      "fresh staging Stripe event was already present"
    )

    const replay = await postJson(
      new URL("/api/stripe/webhook", config.appUrl),
      body,
      headers
    )
    assert.equal(
      replay.received,
      true,
      "staging Stripe replay was not acknowledged"
    )
    assert.equal(
      replay.duplicate,
      true,
      "staging Stripe replay was not deduplicated"
    )

    const [ledger] = await sql`
      select attempt_count, processed_at is not null as processed
      from public.stripe_webhook_events
      where stripe_event_id = ${eventId}
    `
    assert.equal(
      ledger?.processed,
      true,
      "staging Stripe ledger did not complete"
    )
    assert.equal(
      ledger?.attempt_count,
      1,
      "staging Stripe replay changed attempt count"
    )
  } finally {
    await sql`delete from public.stripe_webhook_events where stripe_event_id = ${eventId}`
  }
}

async function proveResendWebhookReplay(config) {
  const timestamp = String(Math.floor(Date.now() / 1000))
  const webhookId = `msg_staging_${randomUUID()}`
  const body = JSON.stringify({
    data: { email_id: `email_staging_${config.revision.slice(0, 12)}` },
    type: "email.sent",
  })
  const signature = createHmac(
    "sha256",
    standardWebhookKey(config.resendWebhookSecret)
  )
    .update(`${webhookId}.${timestamp}.${body}`)
    .digest("base64")
  const headers = {
    "content-type": "application/json",
    "svix-id": webhookId,
    "svix-signature": `v1,${signature}`,
    "svix-timestamp": timestamp,
    ...protectionHeaders(config),
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await postJson(
      new URL("/api/resend/webhook", config.appUrl),
      body,
      headers
    )
    assert.deepEqual(
      response,
      { ignored: true, ok: true },
      "staging Resend webhook replay failed"
    )
  }
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  const body = await response.json().catch(() => null)
  assert.equal(
    response.ok,
    true,
    `${url.pathname} returned HTTP ${response.status}`
  )
  assert.ok(
    body && typeof body === "object",
    `${url.pathname} returned invalid JSON`
  )
  return body
}

async function postJson(url, body, headers) {
  const response = await fetch(url, {
    body,
    headers,
    method: "POST",
    signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
  })
  const responseBody = await response.json().catch(() => null)
  assert.equal(
    response.ok,
    true,
    `${url.pathname} returned HTTP ${response.status}`
  )
  assert.ok(
    responseBody && typeof responseBody === "object",
    `${url.pathname} returned invalid JSON`
  )
  return responseBody
}

function standardWebhookKey(secret) {
  return Buffer.from(
    secret.replace(/^v1,/, "").replace(/^whsec_/, ""),
    "base64"
  )
}

function protectionHeaders(config) {
  return config.bypassSecret
    ? { "x-vercel-protection-bypass": config.bypassSecret }
    : {}
}

function parseOrigin(value, label) {
  const url = new URL(value)
  assert.equal(url.username, "", `${label} must not contain credentials`)
  assert.equal(url.password, "", `${label} must not contain credentials`)
  assert.equal(url.pathname, "/", `${label} must be an origin without a path`)
  assert.equal(url.search, "", `${label} must not contain a query`)
  assert.equal(url.hash, "", `${label} must not contain a fragment`)
  return url
}

function required(env, name) {
  const value = env[name]?.trim()
  assert.ok(value, `${name} is required for staging proof`)
  return value
}

function isMainModule() {
  return Boolean(
    process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
  )
}
