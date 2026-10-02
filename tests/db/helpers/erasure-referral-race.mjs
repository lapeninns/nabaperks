import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import postgres from "postgres"
import { createStampCollectionFixture } from "./stamp-collection-fixture.mjs"
import { cleanupRewardPoolFixture } from "./reward-pool-fixture.mjs"
import { actAsActivatedInternalAdmin } from "./admin-auth.mjs"
export async function runErasureReferralRace(url, first) {
  const prefix = `erase-referral-${randomUUID().slice(0, 8)}`
  const clients = ["observe", "hold", "erase", "settle"].map((label) =>
    postgres(url, {
      max: 1,
      onnotice: () => {},
      connection: { application_name: `${prefix}-${label}` },
    })
  )
  const [sql, holder, eraser, settler] = clients
  const release = Promise.withResolvers(),
    held = Promise.withResolvers()
  let f,
    holding,
    jobs = []
  const evidence = { first, at: new Date().toISOString() }
  try {
    f = await createStampCollectionFixture(sql)
    f.friendId = randomUUID()
    f.friendMembershipId = randomUUID()
    f.edgeId = randomUUID()
    f.sessionId = randomUUID()
    await sql.begin(async (tx) => {
      await tx`insert into customers(id,email,email_hmac,email_verified_at,phone_hmac,phone_verified_at) values(${f.friendId},${`erasure-friend-${f.friendId}@example.test`},repeat(replace(${f.friendId},'-',''),2),now(),repeat(replace(${f.friendId},'-',''),2),now())`
      await tx`insert into customer_memberships(id,customer_id,merchant_id,current_stamp_count,total_stamps_earned) values(${f.friendMembershipId},${f.friendId},${f.merchantId},1,1)`
      const [visit] =
        await tx`insert into stamp_events(merchant_id,customer_id,membership_id,loyalty_card_id,location_id,event_type,stamps_delta,earned_business_date,cycle_number,metadata) values(${f.merchantId},${f.friendId},${f.friendMembershipId},${f.cardId},${f.locationId},'earned',1,public.uk_business_date(now()),1,'{"source":"merchant_qr_action"}') returning id`
      const [member] =
        await tx`select referral_code from customer_memberships where id=${f.membershipId}`
      await tx`insert into referrals(id,venue_id,referral_code_used,referrer_customer_id,referred_customer_id,referrer_membership_id,referred_membership_id,status,qualified_at,qualifying_stamp_id,referrer_bonus_due_at) values(${f.edgeId},${f.merchantId},${member.referral_code},${f.customerId},${f.friendId},${f.membershipId},${f.friendMembershipId},'qualified',now(),${visit.id},now())`
      await tx`insert into customer_sessions(id,customer_id,expires_at,device_hash) values(${f.sessionId},${f.customerId},now()+interval '1 hour',repeat('e',64))`
    })
    evidence.before = {
      terms:
        await sql`select * from customer_loyalty_terms_acceptances where membership_id=${f.membershipId}`,
      rewards:
        await sql`select id,reward_name,reward_terms,status from reward_events where membership_id=${f.membershipId}`,
    }
    holding = holder.begin(async (tx) => {
      await tx`set local statement_timeout='15s'`
      if (first === "erase")
        await tx`select id from reward_scan_tokens where id=${f.token} for update`
      else
        await tx`select id from customers where id=${f.customerId} for update`
      held.resolve((await tx`select pg_backend_pid() pid`)[0].pid)
      await release.promise
    })
    const holderPid = await held.promise
    const startErase = () =>
      eraser.begin(async (tx) => {
        await tx`set local statement_timeout='15s'`
        await actAsActivatedInternalAdmin(tx, f.adminUserId)
        await tx`select set_config('request.jwt.claim.role','service_role',true)`
        return tx`select public.admin_erase_customer_pii(${f.customerId},${f.merchantId},'other','Synthetic adversarial referral erasure proof') result`
      })
    const startSettle = () =>
      settler.begin(async (tx) => {
        await tx`set local statement_timeout='15s'`
        await tx`select set_config('request.jwt.claim.role','service_role',true)`
        return tx`select public.settle_referral_bonus(${f.edgeId}) result`
      })
    const waitFor = async (labels) => {
      const deadline = Date.now() + 5000
      while (true) {
        const rows =
          await sql`select pid,application_name,wait_event_type,wait_event,pg_blocking_pids(pid) blockers,query from pg_stat_activity where application_name=any(${labels.map((l) => `${prefix}-${l}`)}) and state='active' and wait_event_type='Lock'`
        if (rows.length === labels.length) return rows
        assert.ok(Date.now() < deadline, "Required real DB waits missing")
        await new Promise((r) => setTimeout(r, 10))
      }
    }
    jobs.push((first === "erase" ? startErase : startSettle)())
    await waitFor([first])
    jobs.push((first === "erase" ? startSettle : startErase)())
    evidence.waits = await waitFor(["erase", "settle"])
    evidence.holderPid = holderPid
    release.resolve()
    await holding
    evidence.outcomes = (await Promise.allSettled(jobs)).map((r) =>
      r.status === "fulfilled"
        ? r
        : { status: r.status, code: r.reason.code, message: r.reason.message }
    )
    evidence.after = {
      friend:
        await sql`select email,phone_hmac,email_verified_at,phone_verified_at from customers where id=${f.friendId}`,
      friendMembership:
        await sql`select current_stamp_count,total_stamps_earned from customer_memberships where id=${f.friendMembershipId}`,
      customer:
        await sql`select email,phone_hmac,email_hmac,date_of_birth,date_of_birth_verified_at from customers where id=${f.customerId}`,
      membership:
        await sql`select current_stamp_count,total_stamps_earned,total_rewards_redeemed,active_cycle_number from customer_memberships where id=${f.membershipId}`,
      referral:
        await sql`select status,hold_reason,last_error,referrer_bonus_awarded_at from referrals where id=${f.edgeId}`,
      terms:
        await sql`select * from customer_loyalty_terms_acceptances where membership_id=${f.membershipId}`,
      rewards:
        await sql`select id,reward_name,reward_terms,status from reward_events where membership_id=${f.membershipId}`,
      notifications:
        await sql`select event_type,status,cancelled_at,metadata from notification_events where customer_id=${f.customerId}`,
      tokens:
        await sql`select superseded_at,consumed_at,expires_at from reward_scan_tokens where customer_id=${f.customerId}`,
      session:
        await sql`select revoked_at from customer_sessions where id=${f.sessionId}`,
      receipts:
        await sql`select count(*)::int count from private.merchant_counter_collection_receipts where customer_id=${f.customerId}`,
      bonusStamps:
        await sql`select id from stamp_events where membership_id=${f.membershipId} and metadata->>'source'='referral_bonus'`,
    }
  } catch (error) {
    evidence.error = { message: error.message, code: error.code }
    throw error
  } finally {
    release.resolve()
    await Promise.allSettled([holding, ...jobs].filter(Boolean))
    if (f) {
      await cleanupRewardPoolFixture(sql, f)
      await sql`delete from customers where id=${f.friendId}`
      evidence.cleaned = true
    }
    await Promise.all(clients.map((c) => c.end()))
  }
  return evidence
}
