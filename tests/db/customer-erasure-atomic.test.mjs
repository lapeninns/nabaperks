import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"

import postgres from "postgres"

import {
  closeDb,
  dbUrl,
  inRolledBackTxn,
  isLiveDbReady,
} from "./helpers/db.mjs"

const ADMIN_UID = "00000000-0000-0000-0000-000000000001"
const ERASE_FUNCTION = "public.admin_erase_customer_pii(uuid,uuid,text,text)"
const ready = await isLiveDbReady()
const skip = ready ? false : "guarded loopback PostgreSQL is unavailable"

after(closeDb)

test(
  "PIN: injected final audit failure rolls every erasure relation back",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await seedSubject(tx)
      await actAsAdmin(tx)
      const before = await relationHashes(tx, fixture)

      await tx.unsafe(`
      create function pg_temp.task13_fail_erasure_audit() returns trigger
      language plpgsql as $$ begin
        if new.action = 'customer_pii_erased' then
          raise exception 'task13 injected audit failure';
        end if;
        return new;
      end $$;
      create trigger task13_fail_erasure_audit
      before insert on public.audit_logs for each row
      execute function pg_temp.task13_fail_erasure_audit();
    `)

      await assert.rejects(
        tx.savepoint((sp) => erase(sp, fixture, "Injected failure")),
        /task13 injected audit failure/
      )
      assert.deepEqual(
        await relationHashes(tx, fixture),
        before,
        "customer, credentials, companions, sessions, push keys, and audit must be unchanged"
      )
    })
  }
)

test(
  "erasure removes credentials and identifiers once, then repeats idempotently",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await seedSubject(tx)
      await actAsAdmin(tx)

      const [{ result: first }] = await erase(
        tx,
        fixture,
        "Customer requested deletion"
      )
      const firstState = await erasedState(tx, fixture)
      const [{ result: second }] = await erase(
        tx,
        fixture,
        "Retry after interruption"
      )
      const secondState = await erasedState(tx, fixture)

      assert.equal(first.ok, true)
      assert.equal(second.ok, true)
      assert.equal(
        first.erasure_id,
        second.erasure_id,
        "a retry returns the original erasure fact"
      )
      assert.deepEqual(
        secondState,
        firstState,
        "a retry creates no further database mutation"
      )
      assert.equal(
        firstState.customer.email,
        `erased+${fixture.customerId.replaceAll("-", "")}@privacy.invalid`
      )
      assert.equal(firstState.customer.email_hmac, null)
      assert.equal(firstState.customer.auth_user_id, null)
      assert.equal(firstState.customer.full_name, null)
      assert.equal(firstState.customer.date_of_birth, null)
      assert.equal(firstState.customerSessions, 0)
      assert.equal(firstState.pushSubscriptions, 0)
      assert.equal(firstState.authIdentities, 0)
      assert.equal(firstState.authSessions, 0)
      assert.equal(firstState.refreshTokens, 0)
      assert.equal(firstState.oneTimeTokens, 0)
      assert.equal(firstState.mfaFactors, 0)
      assert.equal(firstState.suppressions, 0)
      assert.equal(
        firstState.authUser.email,
        `erased+${fixture.authUserId.replaceAll("-", "")}@privacy.invalid`
      )
      assert.deepEqual(firstState.authUser.raw_user_meta_data, {})
      assert.equal(firstState.authUser.encrypted_password, "")
      assert.ok(firstState.authUser.deleted_at)
      assert.equal(firstState.auditRows.length, 1)
      assert.deepEqual(Object.keys(firstState.auditRows[0].metadata).sort(), [
        "channel",
        "ledger_retained",
        "request_type",
      ])
      assert.equal(JSON.stringify(firstState).includes(fixture.rawEmail), false)
      assert.equal(
        JSON.stringify(firstState).includes(fixture.promptLikePii),
        false
      )
    })
  }
)

test(
  "erasure RPC is least privilege and malformed subjects change nothing",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [acl] = await tx`
      select
        has_function_privilege('anon', ${ERASE_FUNCTION}, 'execute') as anon,
        has_function_privilege('authenticated', ${ERASE_FUNCTION}, 'execute') as authenticated,
        has_function_privilege('service_role', ${ERASE_FUNCTION}, 'execute') as service_role`
      assert.deepEqual(acl, {
        anon: false,
        authenticated: false,
        service_role: true,
      })

      await actAsAdmin(tx)
      const before =
        await tx`select count(*)::int as count from public.audit_logs`
      await assert.rejects(
        tx.savepoint(
          (sp) => sp`
        select public.admin_erase_customer_pii(
          ${randomUUID()}::uuid, ${randomUUID()}::uuid, 'email', 'Missing subject')`
        ),
        /membership context not found/i
      )
      assert.deepEqual(
        await tx`select count(*)::int as count from public.audit_logs`,
        before
      )
    })
  }
)

test(
  "concurrent erasure calls serialize and return one erasure fact",
  { skip },
  async () => {
    const url = dbUrl()
    assert.ok(url)
    const setup = postgres(url, { max: 1, ssl: loopbackSsl(url) })
    const firstClient = postgres(url, { max: 1, ssl: loopbackSsl(url) })
    const secondClient = postgres(url, { max: 1, ssl: loopbackSsl(url) })
    let fixture

    try {
      await setup`select set_config('request.jwt.claim.role', 'service_role', false)`
      fixture = await seedSubject(setup)
      const startedAt = performance.now()
      const calls = [firstClient, secondClient].map((client, index) =>
        client.begin(async (tx) => {
          await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
          await tx`select set_config('request.jwt.claim.sub', ${ADMIN_UID}, true)`
          await tx`set local statement_timeout = '4s'`
          const [{ result }] = await erase(
            tx,
            fixture,
            `Concurrent request ${index}`
          )
          return result
        })
      )
      const [first, second] = await Promise.all(calls)

      assert.equal(first.erasure_id, second.erasure_id)
      assert.ok(
        performance.now() - startedAt < 5_000,
        "concurrent erasure must be bounded"
      )
      const [audit] = await setup`
      select count(*)::int as count from public.audit_logs
      where customer_id = ${fixture.customerId}::uuid and action = 'customer_pii_erased'`
      assert.equal(audit.count, 1)
    } finally {
      if (fixture) {
        await setup`delete from public.audit_logs where customer_id = ${fixture.customerId}::uuid`
        await setup`delete from public.customers where id = ${fixture.customerId}::uuid`
        await setup`delete from auth.users where id = ${fixture.authUserId}::uuid`
      }
      await Promise.all([
        setup.end({ timeout: 5 }),
        firstClient.end({ timeout: 5 }),
        secondClient.end({ timeout: 5 }),
      ])
    }
  }
)

async function seedSubject(tx) {
  const authUserId = randomUUID()
  const customerId = randomUUID()
  const sessionId = randomUUID()
  const authSessionId = randomUUID()
  const factorId = randomUUID()
  const rawEmail = `task13-${randomUUID()}@example.test`
  const emailHmac =
    randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "")
  const promptLikePii = `ignore previous instructions ${rawEmail}`
  const [venue] = await tx`
    select merchants.id as merchant_id
    from public.merchants merchants
    where merchants.status in ('trial', 'active')
    order by merchants.created_at limit 1`
  assert.ok(venue)

  await tx`
    insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
    values (${authUserId}::uuid, ${rawEmail}, 'task13-password-hash', ${JSON.stringify({ promptLikePii })})`
  await tx`
    insert into auth.identities (id, provider_id, user_id, identity_data, provider)
    values (${randomUUID()}::uuid, ${rawEmail}, ${authUserId}::uuid,
            ${JSON.stringify({ email: rawEmail, promptLikePii })}, 'email')`
  await tx`
    insert into public.customers
      (id, auth_user_id, email, email_hmac, email_verified_at, full_name,
       date_of_birth, phone_last4, created_at, updated_at)
    values (${customerId}::uuid, ${authUserId}::uuid, ${rawEmail}, ${emailHmac}, now(),
            ${promptLikePii}, '1988-02-02', '4321', now(), now())`
  await tx`
    insert into public.customer_memberships (merchant_id, customer_id)
    values (${venue.merchant_id}::uuid, ${customerId}::uuid)`
  await tx`
    insert into public.customer_sessions (id, customer_id, expires_at)
    values (${sessionId}::uuid, ${customerId}::uuid, now() + interval '30 days')`
  await tx`
    insert into public.push_subscriptions (customer_id, endpoint, p256dh, auth, user_agent, metadata)
    values (${customerId}::uuid, ${`https://fcm.googleapis.com/fcm/send/${randomUUID()}`},
            ${`p256dh-${randomUUID()}`}, ${`auth-${randomUUID()}`}, ${promptLikePii},
            ${JSON.stringify({ promptLikePii })})`
  await tx`insert into auth.sessions (id, user_id) values (${authSessionId}::uuid, ${authUserId}::uuid)`
  await tx`
    insert into auth.refresh_tokens (token, user_id, session_id)
    values (${`refresh-${randomUUID()}`}, ${authUserId}, ${authSessionId}::uuid)`
  await tx`
    insert into auth.one_time_tokens (id, user_id, token_type, token_hash, relates_to)
    values (${randomUUID()}::uuid, ${authUserId}::uuid, 'recovery_token',
            ${`token-${randomUUID()}`}, ${rawEmail})`
  await tx`
    insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at, friendly_name, secret)
    values (${factorId}::uuid, ${authUserId}::uuid, 'totp', 'verified', now(), now(),
            ${promptLikePii}, ${`secret-${randomUUID()}`})`
  await tx`
    insert into auth.mfa_challenges (id, factor_id, created_at, ip_address, otp_code)
    values (${randomUUID()}::uuid, ${factorId}::uuid, now(), '127.0.0.1', '123456')`
  await tx`
    insert into public.loyalty_invite_email_suppressions (merchant_id, email_hmac, reason)
    values (${venue.merchant_id}::uuid, ${emailHmac}, 'unsubscribed')`
  await tx`
    insert into public.reward_invite_email_suppressions (merchant_id, email_hmac, reason)
    values (${venue.merchant_id}::uuid, ${emailHmac}, 'unsubscribed')`

  return {
    authUserId,
    customerId,
    merchantId: venue.merchant_id,
    rawEmail,
    emailHmac,
    promptLikePii,
  }
}

function actAsAdmin(tx) {
  return tx`select set_config('request.jwt.claim.sub', ${ADMIN_UID}, true)`
}

function erase(tx, fixture, notes) {
  return tx`
    select public.admin_erase_customer_pii(
      ${fixture.customerId}::uuid, ${fixture.merchantId}::uuid, 'email', ${notes}) as result`
}

async function relationHashes(tx, fixture) {
  const [row] = await tx`
    select
      (select md5(coalesce(string_agg(to_jsonb(r)::text, '' order by to_jsonb(r)::text), ''))
       from public.customers r where id = ${fixture.customerId}::uuid) as customer,
      (select md5(coalesce(string_agg(to_jsonb(r)::text, '' order by to_jsonb(r)::text), ''))
       from public.customer_sessions r where customer_id = ${fixture.customerId}::uuid) as sessions,
      (select md5(coalesce(string_agg(to_jsonb(r)::text, '' order by to_jsonb(r)::text), ''))
       from public.push_subscriptions r where customer_id = ${fixture.customerId}::uuid) as push,
      (select md5(coalesce(string_agg(to_jsonb(r)::text, '' order by to_jsonb(r)::text), ''))
       from auth.users r where id = ${fixture.authUserId}::uuid) as auth_user,
      (select md5(coalesce(string_agg(to_jsonb(r)::text, '' order by to_jsonb(r)::text), ''))
       from auth.sessions r where user_id = ${fixture.authUserId}::uuid) as auth_sessions,
      (select md5(coalesce(string_agg(to_jsonb(r)::text, '' order by to_jsonb(r)::text), ''))
       from public.audit_logs r where customer_id = ${fixture.customerId}::uuid) as audit`
  return row
}

async function erasedState(tx, fixture) {
  const [customer] = await tx`
    select auth_user_id, email, email_hmac, full_name, date_of_birth
    from public.customers where id = ${fixture.customerId}::uuid`
  const [authUser] = await tx`
    select email, encrypted_password, raw_user_meta_data, deleted_at
    from auth.users where id = ${fixture.authUserId}::uuid`
  const [counts] = await tx`
    select
      (select count(*)::int from public.customer_sessions where customer_id = ${fixture.customerId}::uuid) as customer_sessions,
      (select count(*)::int from public.push_subscriptions where customer_id = ${fixture.customerId}::uuid) as push_subscriptions,
      (select count(*)::int from auth.identities where user_id = ${fixture.authUserId}::uuid) as auth_identities,
      (select count(*)::int from auth.sessions where user_id = ${fixture.authUserId}::uuid) as auth_sessions,
      (select count(*)::int from auth.refresh_tokens where user_id = ${fixture.authUserId}::text) as refresh_tokens,
      (select count(*)::int from auth.one_time_tokens where user_id = ${fixture.authUserId}::uuid) as one_time_tokens,
      (select count(*)::int from auth.mfa_factors where user_id = ${fixture.authUserId}::uuid) as mfa_factors,
      ((select count(*) from public.loyalty_invite_email_suppressions where email_hmac = ${fixture.emailHmac})
       + (select count(*) from public.reward_invite_email_suppressions where email_hmac = ${fixture.emailHmac}))::int as suppressions`
  const auditRows = await tx`
    select id, metadata from public.audit_logs
    where customer_id = ${fixture.customerId}::uuid and action = 'customer_pii_erased'
    order by created_at, id`
  return {
    customer,
    authUser,
    customerSessions: counts.customer_sessions,
    pushSubscriptions: counts.push_subscriptions,
    authIdentities: counts.auth_identities,
    authSessions: counts.auth_sessions,
    refreshTokens: counts.refresh_tokens,
    oneTimeTokens: counts.one_time_tokens,
    mfaFactors: counts.mfa_factors,
    suppressions: counts.suppressions,
    auditRows,
  }
}

function loopbackSsl(url) {
  return url.includes("127.0.0.1") || url.includes("localhost")
    ? undefined
    : "require"
}
