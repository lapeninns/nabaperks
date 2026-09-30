import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { after, test } from "node:test"
import postgres from "postgres"

import {
  closeDb,
  db,
  dbUrl,
  inRolledBackTxn,
  isLiveDbReady,
} from "./helpers/db.mjs"
import {
  cleanupRewardPoolFixture,
  createRewardPoolFixture,
} from "./helpers/reward-pool-fixture.mjs"

const ready = await isLiveDbReady()
const options = { skip: ready ? false : "local database unavailable" }
after(closeDb)

test(
  "Given an in-flight stamp When linking starts Then the stamp and link finish without deadlock",
  options,
  async () => {
    const sql = db()
    const connections = [
      postgres(dbUrl(), { max: 1 }),
      postgres(dbUrl(), { max: 1 }),
    ]
    let f
    let stampReady
    const ready = new Promise((resolve) => {
      stampReady = resolve
    })
    try {
      f = await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.role','service_role',true)`
        const created = await fixture(tx)
        await stamps(
          tx,
          created,
          created.customerId,
          created.membershipId,
          [8, 7]
        )
        await stamps(tx, created, created.emailId, created.emailMembership, [6])
        return created
      })
      const stamp = connections[0].begin(async (tx) => {
        await tx`set local statement_timeout='5s'`
        await tx`select id from public.customer_memberships where id=${f.membershipId}::uuid for update`
        stampReady()
        await tx`select pg_sleep(0.1)`
        await tx`insert into public.stamp_events(merchant_id,customer_id,membership_id,loyalty_card_id,location_id,event_type,stamps_delta,earned_business_date,cycle_number) values(${f.merchantId}::uuid,${f.customerId}::uuid,${f.membershipId}::uuid,${f.cardId}::uuid,${f.locationId}::uuid,'earned',1,current_date-5,1)`
        await tx`update public.customer_memberships set current_stamp_count=current_stamp_count+1,total_stamps_earned=total_stamps_earned+1 where id=${f.membershipId}::uuid`
      })
      await ready
      const linking = connections[1].begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.role','service_role',true)`
        await tx`set local statement_timeout='5s'`
        return link(tx, f)
      })
      const [, result] = await Promise.all([stamp, linking])
      assert.equal(result.status, "linked")
      const [membership] =
        await sql`select current_stamp_count,total_stamps_earned from public.customer_memberships where id=${f.membershipId}::uuid`
      assert.equal(membership.current_stamp_count, 1)
      assert.equal(membership.total_stamps_earned, 4)
    } finally {
      await Promise.all(
        connections.map((connection) => connection.end({ timeout: 5 }))
      )
      if (f) {
        await sql`delete from public.customers where id=${f.emailId}::uuid`
        await cleanupRewardPoolFixture(sql, f)
      }
    }
  }
)

test(
  "Given a retired wallet When a stale request creates a membership Then it is refused",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      const second = await createRewardPoolFixture(tx)
      assert.equal((await link(tx, f)).status, "linked")
      await assert.rejects(
        () =>
          tx.savepoint(async (nested) => {
            await nested`insert into public.customer_memberships(merchant_id,customer_id) values(${second.merchantId}::uuid,${f.emailId}::uuid)`
          }),
        { code: "23514" }
      )
      const [rows] =
        await tx`select count(*)::integer n from public.customer_memberships where customer_id=${f.emailId}::uuid`
      assert.equal(rows.n, 0)
    })
  }
)

async function fixture(tx) {
  const f = await createRewardPoolFixture(tx)
  f.emailId = randomUUID()
  f.emailMembership = randomUUID()
  f.session = randomUUID()
  f.otherSession = randomUUID()
  f.email = `link-${f.emailId}@example.test`
  f.emailHmac = f.emailId.replaceAll("-", "").repeat(2)
  f.phoneHmac = f.customerId.replaceAll("-", "").repeat(2)
  await tx`select set_config('app.customer_erasure','true',true)`
  await tx`update public.customers set email=null,email_hmac=null,email_verified_at=null
    where id=${f.customerId}::uuid`
  await tx`select set_config('app.customer_erasure','false',true)`
  await tx`update public.customer_memberships set current_stamp_count=0,total_stamps_earned=0
    where id=${f.membershipId}::uuid`
  await tx`insert into public.customers(id,email,email_hmac,email_verified_at,full_name)
    values(${f.emailId}::uuid,${f.email},${f.emailHmac},now(),'Email Customer')`
  await tx`update public.customers set date_of_birth='1990-01-01' where id=${f.emailId}::uuid`
  await tx`update public.customers set date_of_birth_verified_at=null,
    date_of_birth_verification_source=null,date_of_birth_verified_by=null where id=${f.emailId}::uuid`
  await tx`insert into public.customer_memberships(id,merchant_id,customer_id)
    values(${f.emailMembership}::uuid,${f.merchantId}::uuid,${f.emailId}::uuid)`
  await tx`insert into public.customer_sessions(id,customer_id,expires_at,device_hash)
    values(${f.session}::uuid,${f.emailId}::uuid,'infinity',${"a".repeat(64)}),
          (${f.otherSession}::uuid,${f.customerId}::uuid,'infinity',${"b".repeat(64)})`
  for (let i = 0; i < 3; i++) {
    await tx`insert into public.reward_pool_items(merchant_id,location_id,loyalty_card_id,
      reward_name,reward_terms,weight,is_active,display_order,requires_age_check)
      values(${f.merchantId}::uuid,${f.locationId}::uuid,${f.cardId}::uuid,
        ${`Test reward ${i}`},'Subject to house rules and availability.',1,true,${i},false)`
  }
  return f
}

async function stamps(tx, f, owner, membership, days, cycle = 1) {
  const ids = []
  for (const day of days) {
    const id = randomUUID()
    ids.push(id)
    await tx`insert into public.stamp_events(id,merchant_id,customer_id,membership_id,
      loyalty_card_id,location_id,event_type,stamps_delta,earned_business_date,cycle_number)
      values(${id}::uuid,${f.merchantId}::uuid,${owner}::uuid,${membership}::uuid,
        ${f.cardId}::uuid,${f.locationId}::uuid,'earned',1,current_date-${day}::integer,${cycle})`
  }
  await tx`update public.customer_memberships set current_stamp_count=${days.length},
    total_stamps_earned=total_stamps_earned+${days.length} where id=${membership}::uuid`
  return ids
}

async function link(tx, f, method = "phone") {
  const [result] = await tx`select * from public.link_verified_customer_wallets(
    ${method === "phone" ? f.emailId : f.customerId}::uuid,
    ${method === "phone" ? f.session : f.otherSession}::uuid,${method},
    ${method === "phone" ? f.phoneHmac : f.emailHmac})`
  return result
}

test(
  "Given two complementary wallets When the phone is proven Then stamps combine and a single reward is unlocked",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      const original = await stamps(tx, f, f.customerId, f.membershipId, [8, 7])
      const later = await stamps(tx, f, f.emailId, f.emailMembership, [6])
      assert.equal((await link(tx, f)).status, "linked")
      const [m] =
        await tx`select * from public.customer_memberships where id=${f.membershipId}::uuid`
      assert.equal(m.total_stamps_earned, 3)
      assert.equal(m.active_cycle_number, 2)
      assert.equal(m.current_stamp_count, 0)
      const rows =
        await tx`select id,customer_id,membership_id from public.stamp_events
      where id in ${tx([...original, ...later])}`
      assert.equal(rows.length, 3)
      assert.ok(
        rows.every(
          (r) =>
            r.customer_id === f.customerId && r.membership_id === f.membershipId
        )
      )
      const rewards =
        await tx`select * from public.reward_events where customer_id=${f.customerId}::uuid`
      assert.equal(rewards.length, 1)
      assert.equal(rewards[0].status, "unlocked")
      const [customer] =
        await tx`select email,email_verified_at,phone_verified_at from public.customers
      where id=${f.customerId}::uuid`
      assert.equal(customer.email, f.email)
      assert.ok(customer.email_verified_at && customer.phone_verified_at)
      const sessions = await tx`select revoked_at from public.customer_sessions
      where id in ${tx([f.session, f.otherSession])}`
      assert.ok(sessions.every((s) => s.revoked_at))
      const [audit] = await tx`select count(*)::integer n from public.audit_logs
      where action='customer_wallets_linked' and customer_id=${f.customerId}::uuid`
      assert.equal(audit.n, 1)
    })
  }
)

test(
  "Given four unspent stamps across wallets When linked Then one reward and the remaining stamp survive",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await stamps(tx, f, f.customerId, f.membershipId, [8, 7])
      await stamps(tx, f, f.emailId, f.emailMembership, [6, 5])
      assert.equal((await link(tx, f)).status, "linked")
      const [m] =
        await tx`select current_stamp_count,total_stamps_earned from public.customer_memberships
      where id=${f.membershipId}::uuid`
      assert.equal(m.current_stamp_count, 1)
      assert.equal(m.total_stamps_earned, 4)
    })
  }
)

test(
  "Given a phone session and a newly proven email When linked Then the same original wallet survives",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await stamps(tx, f, f.customerId, f.membershipId, [8])
      await stamps(tx, f, f.emailId, f.emailMembership, [6])
      const r = await link(tx, f, "email")
      assert.equal(r.status, "linked")
      assert.equal(r.customer_id, f.customerId)
      const [m] =
        await tx`select current_stamp_count from public.customer_memberships where id=${f.membershipId}::uuid`
      assert.equal(m.current_stamp_count, 2)
    })
  }
)

test(
  "Given overlapping visit dates When linking is attempted Then both histories remain untouched for review",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await stamps(tx, f, f.customerId, f.membershipId, [8])
      await stamps(tx, f, f.emailId, f.emailMembership, [8])
      assert.equal((await link(tx, f)).status, "requires_review")
      const rows =
        await tx`select customer_id,current_stamp_count from public.customer_memberships
      where customer_id in ${tx([f.customerId, f.emailId])}`
      assert.equal(rows.length, 2)
      assert.ok(rows.every((m) => m.current_stamp_count === 1))
      const [links] =
        await tx`select count(*)::integer n from private.customer_wallet_links`
      assert.equal(links.n, 0)
    })
  }
)

for (const condition of ["stale", "revoked", "wrong_owner"]) {
  test(
    `Given a ${condition} session When linking is attempted Then no identity changes`,
    options,
    async () => {
      await inRolledBackTxn(async (tx) => {
        const f = await fixture(tx)
        if (condition === "stale")
          await tx`update public.customer_sessions set created_at=now()-interval '11 minutes' where id=${f.session}::uuid`
        if (condition === "revoked")
          await tx`update public.customer_sessions set revoked_at=now() where id=${f.session}::uuid`
        if (condition === "wrong_owner") f.session = f.otherSession
        assert.equal((await link(tx, f)).status, "reauthenticate")
        const [c] =
          await tx`select email_verified_at from public.customers where id=${f.customerId}::uuid`
        assert.equal(c.email_verified_at, null)
      })
    }
  )
}

test(
  "Given an already linked wallet When the spent session retries Then no rewards are issued twice",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await stamps(tx, f, f.customerId, f.membershipId, [8, 7])
      await stamps(tx, f, f.emailId, f.emailMembership, [6])
      assert.equal((await link(tx, f)).status, "linked")
      assert.equal((await link(tx, f)).status, "reauthenticate")
      const [r] =
        await tx`select count(*)::integer n from public.reward_events where customer_id=${f.customerId}::uuid`
      assert.equal(r.n, 1)
    })
  }
)

for (const condition of [
  "counter_mismatch",
  "verified_birth_date",
  "quiet_hours",
]) {
  test(
    `Given ${condition} When linking is attempted Then reconciliation is required without changes`,
    options,
    async () => {
      await inRolledBackTxn(async (tx) => {
        const f = await fixture(tx)
        if (condition === "counter_mismatch")
          await tx`update public.customer_memberships set current_stamp_count=2 where id=${f.membershipId}::uuid`
        if (condition === "verified_birth_date")
          await tx`update public.customers set date_of_birth_verified_at=now(),date_of_birth_verification_source='trusted_database' where id=${f.emailId}::uuid`
        if (condition === "quiet_hours") {
          await tx`insert into public.notification_preferences(customer_id,quiet_hours_start) values(${f.customerId}::uuid,'20:00'),(${f.emailId}::uuid,'21:00')`
        }
        assert.equal((await link(tx, f)).status, "requires_review")
        const [c] =
          await tx`select email from public.customers where id=${f.emailId}::uuid`
        assert.equal(c.email, f.email)
      })
    }
  )
}

test(
  "Given stricter consent and a source profile When linked Then consent stays restricted and the retired profile is cleared",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await tx`insert into public.notification_preferences(customer_id,marketing_enabled) values(${f.customerId}::uuid,true),(${f.emailId}::uuid,false)`
      assert.equal((await link(tx, f)).status, "linked")
      const [p] =
        await tx`select marketing_enabled from public.notification_preferences where customer_id=${f.customerId}::uuid`
      assert.equal(p.marketing_enabled, false)
      const [c] =
        await tx`select full_name,date_of_birth,email from public.customers where id=${f.emailId}::uuid`
      assert.equal(c.full_name, null)
      assert.equal(c.date_of_birth, null)
      assert.equal(c.email, `linked+${f.emailId}@privacy.invalid`)
    })
  }
)

test(
  "Given an authenticated API caller When invoking wallet linking Then execute privilege is denied",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const [permissions] =
        await tx`select has_function_privilege('authenticated','public.link_verified_customer_wallets(uuid,uuid,text,text)','EXECUTE') authenticated,has_function_privilege('anon','public.link_verified_customer_wallets(uuid,uuid,text,text)','EXECUTE') anon`
      assert.equal(permissions.authenticated, false)
      assert.equal(permissions.anon, false)
    })
  }
)

for (const status of ["unlocked", "redeemed", "expired", "cancelled"]) {
  test(
    `Given an existing ${status} reward When wallets link Then its identity and status survive`,
    options,
    async () => {
      await inRolledBackTxn(async (tx) => {
        const f = await fixture(tx)
        await stamps(tx, f, f.emailId, f.emailMembership, [12, 11, 10])
        const [completed] =
          await tx`select private.complete_cycle_if_full(${f.emailMembership}::uuid,'test') id`
        assert.ok(completed.id)
        // A redeemed reward on this email-only wallet predates the verified
        // phone rule (20261009100300, QA BUG-008), which now refuses the
        // transition itself; seed that legacy row with triggers suspended
        // for this one statement only.
        if (status === "redeemed")
          await tx`set local session_replication_role = replica`
        await tx`update public.reward_events set status=${status},
          redeemed_at=case when ${status}='redeemed' then now() else null end,
          expired_at=case when ${status}='expired' then now() else null end,
          cancelled_reason=case when ${status}='cancelled' then 'Test cancellation' else null end
          where id=${completed.id}::uuid`
        await tx`set local session_replication_role = origin`
        const [before] =
          await tx`select reward_name,reward_terms,expires_at,created_at from public.reward_events where id=${completed.id}::uuid`
        await stamps(tx, f, f.customerId, f.membershipId, [8, 7])
        await stamps(tx, f, f.emailId, f.emailMembership, [6], 2)
        assert.equal((await link(tx, f)).status, "linked")
        const [after] =
          await tx`select reward_name,reward_terms,expires_at,created_at,status,customer_id,membership_id from public.reward_events where id=${completed.id}::uuid`
        assert.equal(after.status, status)
        assert.equal(after.customer_id, f.customerId)
        assert.equal(after.membership_id, f.membershipId)
        for (const key of Object.keys(before))
          assert.deepEqual(after[key], before[key])
        const [count] =
          await tx`select count(*)::integer n from public.reward_events where customer_id=${f.customerId}::uuid`
        assert.equal(count.n, 2)
      })
    }
  )
}

test(
  "Given an audit insert failure When wallets link Then the entire reconciliation rolls back",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await stamps(tx, f, f.customerId, f.membershipId, [8, 7])
      await stamps(tx, f, f.emailId, f.emailMembership, [6])
      await tx`alter table public.audit_logs add constraint wallet_link_test_audit_failure check(action <> 'customer_wallets_linked') not valid`
      assert.equal((await link(tx, f)).status, "requires_review")
      const memberships =
        await tx`select id,current_stamp_count from public.customer_memberships where id in ${tx([f.membershipId, f.emailMembership])}`
      assert.equal(memberships.length, 2)
      assert.equal(
        memberships.find((m) => m.id === f.membershipId).current_stamp_count,
        2
      )
      const [rewards] =
        await tx`select count(*)::integer n from public.reward_events where customer_id in ${tx([f.customerId, f.emailId])}`
      assert.equal(rewards.n, 0)
      const [c] =
        await tx`select email from public.customers where id=${f.emailId}::uuid`
      assert.equal(c.email, f.email)
    })
  }
)

test(
  "Given concurrent proofs from both wallets When linking races Then exactly one link and one new reward commit",
  options,
  async () => {
    const sql = db()
    const connections = [
      postgres(dbUrl(), { max: 1 }),
      postgres(dbUrl(), { max: 1 }),
    ]
    let f
    try {
      f = await sql.begin(async (tx) => {
        await tx`select set_config('request.jwt.claim.role','service_role',true)`
        const created = await fixture(tx)
        await stamps(
          tx,
          created,
          created.customerId,
          created.membershipId,
          [8, 7]
        )
        await stamps(tx, created, created.emailId, created.emailMembership, [6])
        return created
      })
      const results = await Promise.all(
        connections.map((connection, index) =>
          connection.begin(async (tx) => {
            await tx`select set_config('request.jwt.claim.role','service_role',true)`
            await tx`set local statement_timeout='5s'`
            return link(tx, f, index === 0 ? "phone" : "email")
          })
        )
      )
      assert.equal(results.filter((r) => r.status === "linked").length, 1)
      assert.ok(
        results.every((r) =>
          ["linked", "conflict", "reauthenticate"].includes(r.status)
        )
      )
      const [rewards] =
        await sql`select count(*)::integer n from public.reward_events where customer_id=${f.customerId}::uuid`
      assert.equal(rewards.n, 1)
      const [links] =
        await sql`select count(*)::integer n from private.customer_wallet_links where source_customer_id=${f.emailId}::uuid`
      assert.equal(links.n, 1)
    } finally {
      await Promise.all(
        connections.map((connection) => connection.end({ timeout: 5 }))
      )
      if (f) {
        await sql`delete from public.customers where id=${f.emailId}::uuid`
        await cleanupRewardPoolFixture(sql, f)
      }
    }
  }
)

test(
  "Given cards at different venues When wallets link Then each venue keeps its own stamp balance",
  options,
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      const second = await createRewardPoolFixture(tx)
      const membership = randomUUID()
      await tx`insert into public.customer_memberships(id,merchant_id,customer_id) values(${membership}::uuid,${second.merchantId}::uuid,${f.emailId}::uuid)`
      await stamps(tx, f, f.customerId, f.membershipId, [8, 7])
      await stamps(tx, second, f.emailId, membership, [6])
      assert.equal((await link(tx, f)).status, "linked")
      const memberships =
        await tx`select merchant_id,current_stamp_count from public.customer_memberships where customer_id=${f.customerId}::uuid order by merchant_id`
      assert.equal(memberships.length, 2)
      assert.equal(
        memberships.find((m) => m.merchant_id === f.merchantId)
          .current_stamp_count,
        2
      )
      assert.equal(
        memberships.find((m) => m.merchant_id === second.merchantId)
          .current_stamp_count,
        1
      )
    })
  }
)
