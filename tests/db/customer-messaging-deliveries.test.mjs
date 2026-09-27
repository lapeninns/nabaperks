import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import { createRewardPoolFixture } from "./helpers/reward-pool-fixture.mjs"
import "../support/register-alias.mjs"

const { deliverCustomerPhoneChannel } =
  await import("../../lib/notifications/customer-message-delivery.ts")

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"
after(closeDb)

async function fixture(tx) {
  const hmac = randomUUID().replaceAll("-", "").repeat(2)
  const [customer] = await tx`
    insert into public.customers (email, phone_hmac)
    values (${`messaging-${randomUUID()}@test.local`}, ${hmac}) returning id`
  const [merchant] = await tx`select id from public.merchants limit 1`
  assert.ok(merchant, "local seeded merchant required")
  await tx`insert into public.customer_memberships (customer_id, merchant_id)
    values (${customer.id}, ${merchant.id})`
  const [event] = await tx`
    insert into public.notification_events
      (event_type, category, customer_id, merchant_id, dedupe_key, status)
    values ('reward_ready', 'transactional', ${customer.id}, ${merchant.id},
      ${randomUUID()}, 'delivering') returning id`
  return { customer: customer.id, merchant: merchant.id, event: event.id, hmac }
}

async function begin(tx, f, channel = "whatsapp") {
  const [row] = await tx`select public.begin_notification_message_delivery(
    ${f.event}, ${f.customer}, ${channel}, 1, '1234') as id`
  return row.id
}

function transactionServiceClient(tx) {
  return {
    from(table) {
      assert.equal(table, "notification_deliveries")
      const filters = {}
      const query = {
        select() {
          return query
        },
        eq(column, value) {
          filters[column] = value
          return query
        },
        order() {
          return query
        },
        async limit() {
          const rows = await tx`select attempt_number
            from public.notification_deliveries
            where notification_event_id = ${filters.notification_event_id}
              and channel = ${filters.channel}
            order by attempt_number desc
            limit 1`
          return { data: [...rows], error: null }
        },
      }
      return query
    },
    async rpc(name, args) {
      assert.equal(name, "admit_notification_message_delivery")
      try {
        let deliveryId
        await tx.savepoint(async (sql) => {
          const [row] =
            await sql`select public.admit_notification_message_delivery(
              ${args.p_notification_event_id}, ${args.p_customer_id},
              ${args.p_channel}, ${args.p_attempt_number},
              ${args.p_recipient_last4}) as id`
          deliveryId = row.id
        })
        return { data: deliveryId, error: null }
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          "message" in error
        ) {
          return {
            data: null,
            error: { code: error.code, message: error.message },
          }
        }
        throw error
      }
    },
  }
}

function phoneDeliveryInput(tx, f) {
  return {
    supabase: transactionServiceClient(tx),
    event: {
      id: f.event,
      event_type: "reward_ready",
      customer_id: f.customer,
      merchant_id: f.merchant,
      payload: {},
    },
    channel: "sms",
    recipient: { e164: "+447700900123", last4: "0123" },
    category: "transactional",
    copy: { smsBody: "Fixture", whatsappVariables: {} },
    dryRun: false,
  }
}

async function messagingBudgetSnapshot(tx) {
  const rows = await tx`select bucket_key, count, reset_at, updated_at
    from public.rate_limit_buckets
    where bucket_key like 'customer-messaging:%'
    order by bucket_key`
  return [...rows].map((row) => ({
    bucketKey: row.bucket_key,
    count: row.count,
    resetAt: row.reset_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }))
}

test(
  "replayed delivery boundary leaves every budget bucket unchanged and makes no provider call",
  { skip },
  async (t) => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await tx`delete from public.rate_limit_buckets where bucket_key like 'customer-messaging:%'`
      await tx`select public.admit_notification_message_delivery(
        ${f.event}, ${f.customer}, 'sms', 1, '0123')`
      const before = await messagingBudgetSnapshot(tx)
      const provider = t.mock.method(globalThis, "fetch", () => {
        throw new Error("Unexpected provider attempt")
      })

      const outcome = await deliverCustomerPhoneChannel(
        phoneDeliveryInput(tx, f)
      )

      assert.equal(outcome.status, "defer")
      assert.deepEqual(await messagingBudgetSnapshot(tx), before)
      assert.equal(provider.mock.callCount(), 0)
      const [{ pending }] = await tx`select count(*)::int as pending
        from public.notification_deliveries
        where notification_event_id = ${f.event}
          and channel = 'sms'
          and status = 'pending'`
      assert.equal(pending, 1)
    })
  }
)

test(
  "budget-refused delivery boundary leaves no pending fence and makes no provider call",
  { skip },
  async (t) => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await tx`delete from public.rate_limit_buckets where bucket_key like 'customer-messaging:%'`
      await tx`insert into public.rate_limit_buckets (bucket_key, count, reset_at)
        values ('customer-messaging:global:minute:v1', 60, now() + interval '1 hour')`
      const before = await messagingBudgetSnapshot(tx)
      const provider = t.mock.method(globalThis, "fetch", () => {
        throw new Error("Unexpected provider attempt")
      })

      const outcome = await deliverCustomerPhoneChannel(
        phoneDeliveryInput(tx, f)
      )

      assert.equal(outcome.status, "defer")
      assert.deepEqual(await messagingBudgetSnapshot(tx), before)
      assert.equal(provider.mock.callCount(), 0)
      const [{ pending }] = await tx`select count(*)::int as pending
        from public.notification_deliveries
        where notification_event_id = ${f.event}
          and channel = 'sms'
          and status = 'pending'`
      assert.equal(pending, 0)
    })
  }
)

test(
  "delivery insert conflict rolls back every budget debit",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await tx`delete from public.rate_limit_buckets where bucket_key like 'customer-messaging:%'`
      await tx`insert into public.notification_deliveries
        (notification_event_id, customer_id, channel, status, attempt_number, recipient_last4)
        values (${f.event}, ${f.customer}, 'sms', 'retryable_failure', 1, '0123')`
      const before = await messagingBudgetSnapshot(tx)

      await assert.rejects(
        tx.savepoint(
          (sql) => sql`select public.admit_notification_message_delivery(
            ${f.event}, ${f.customer}, 'sms', 1, '0123')`
        ),
        { code: "NBM01" }
      )

      assert.deepEqual(await messagingBudgetSnapshot(tx), before)
      const [{ pending }] = await tx`select count(*)::int as pending
        from public.notification_deliveries
        where notification_event_id = ${f.event}
          and channel = 'sms'
          and status = 'pending'`
      assert.equal(pending, 0)
    })
  }
)

test(
  "atomic delivery admission derives the marketing venue budget from the locked event",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await tx`delete from public.rate_limit_buckets where bucket_key like 'customer-messaging:%'`
      await tx`update public.notification_events
        set event_type = 'venue_announcement', category = 'transactional'
        where id = ${f.event}`

      await tx`select public.admit_notification_message_delivery(
        ${f.event}, ${f.customer}, 'sms', 1, '0123')`

      const [venueBucket] = await tx`select count
        from public.rate_limit_buckets
        where bucket_key = ${`customer-messaging:merchant:${f.merchant}:day:v1`}`
      assert.equal(venueBucket.count, 1)
    })
  }
)

test(
  "phone attempt fence rejects duplicate attempts and invalid channels",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await begin(tx, f)
      await assert.rejects(
        tx.savepoint((sql) => begin(sql, f)),
        { code: "NBM01" }
      )
      await assert.rejects(tx.savepoint((sql) => begin(sql, f, "email")))
      await begin(tx, f, "sms")
    })
  }
)

test(
  "callbacks bind SID, advance monotonically and only requeue eligible WhatsApp failures",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      const id = await begin(tx, f)
      const sid = `SM${randomUUID().replaceAll("-", "")}`
      await tx`select public.finish_notification_message_delivery(${id}, 'sent', ${sid}, 'queued')`
      const [mismatch] =
        await tx`select public.apply_twilio_message_status(${id}, 'SMwrong', 'delivered') as applied`
      assert.equal(mismatch.applied, false)
      const [advanced] =
        await tx`select public.apply_twilio_message_status(${id}, ${sid}, 'delivered') as applied`
      const [duplicate] =
        await tx`select public.apply_twilio_message_status(${id}, ${sid}, 'delivered') as applied`
      const [stale] =
        await tx`select public.apply_twilio_message_status(${id}, ${sid}, 'sent') as applied`
      const [terminalAfterDelivery] =
        await tx`select public.apply_twilio_message_status(${id}, ${sid}, 'failed', '63003') as applied`
      assert.equal(advanced.applied, true)
      assert.equal(duplicate.applied, true)
      assert.equal(stale.applied, true)
      assert.equal(terminalAfterDelivery.applied, true)
      const [delivered] =
        await tx`select provider_status, delivered_at from public.notification_deliveries where id = ${id}`
      assert.equal(delivered.provider_status, "delivered")
      assert.ok(delivered.delivered_at)
      const second = await fixture(tx)
      const secondId = await begin(tx, second)
      const secondSid = `SM${randomUUID().replaceAll("-", "")}`
      await tx`select public.finish_notification_message_delivery(${secondId}, 'sent', ${secondSid}, 'queued')`
      await tx`update public.notification_events
        set status = 'sent', sent_at = now()
        where id = ${second.event}`
      await tx`select public.apply_twilio_message_status(${secondId}, ${secondSid}, 'failed', '63024')`
      const [fallback] =
        await tx`select status, metadata from public.notification_events where id = ${second.event}`
      assert.equal(fallback.status, "queued")
      assert.equal(fallback.metadata.fallback_from, "whatsapp")
      const [preferences] =
        await tx`select whatsapp_unavailable_at from public.notification_preferences where customer_id = ${second.customer}`
      assert.ok(preferences.whatsapp_unavailable_at)

      const canceled = await fixture(tx)
      const canceledId = await begin(tx, canceled)
      const canceledSid = `SM${randomUUID().replaceAll("-", "")}`
      await tx`select public.finish_notification_message_delivery(${canceledId}, 'sent', ${canceledSid}, 'queued')`
      await tx`update public.notification_events
        set status = 'sent', sent_at = now()
        where id = ${canceled.event}`
      await tx`select public.apply_twilio_message_status(${canceledId}, ${canceledSid}, 'canceled', '63003')`
      const [canceledDelivery] =
        await tx`select status, provider_status from public.notification_deliveries where id = ${canceledId}`
      assert.deepEqual(canceledDelivery, {
        status: "permanent_failure",
        provider_status: "canceled",
      })
      const [canceledEvent] =
        await tx`select status, metadata from public.notification_events where id = ${canceled.event}`
      assert.equal(canceledEvent.status, "sent")
      assert.equal(canceledEvent.metadata.fallback_from, undefined)
    })
  }
)

test(
  "STOP is idempotent, denies both phone marketing channels, and START never restores consent",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await tx`insert into public.consent_records
      (customer_id, merchant_id, channel, consent_status, source, policy_version, created_at)
      values (${f.customer}, ${f.merchant}, 'sms', 'opted_in', 'test', 'v1', now() - interval '1 day')`
      const before =
        await tx`select * from public.customer_phone_marketing_consent(${f.customer}, ${f.merchant})`
      assert.ok(before.length === 2 && before.every((row) => row.opted_in))
      const sid = `SM${randomUUID().replaceAll("-", "")}`
      await tx`select public.record_customer_messaging_inbound(${sid}, 'sms', ${f.hmac}, 'stop')`
      await tx`select public.record_customer_messaging_inbound(${sid}, 'sms', ${f.hmac}, 'stop')`
      const [{ n }] =
        await tx`select count(*)::int as n from public.consent_records where customer_id = ${f.customer} and source = 'inbound_stop'`
      assert.equal(n, 2)
      await tx`select public.record_customer_messaging_inbound(${`SM${randomUUID().replaceAll("-", "")}`}, 'sms', ${f.hmac}, 'start')`
      const after =
        await tx`select * from public.customer_phone_marketing_consent(${f.customer}, ${f.merchant})`
      assert.ok(after.every((row) => !row.opted_in))
      const [preferences] =
        await tx`select phone_messages_enabled from public.notification_preferences where customer_id = ${f.customer}`
      assert.equal(preferences.phone_messages_enabled, true)
    })
  }
)

test(
  "phone erasure scrubs delivery last4 and inbound phone hashes",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      const id = await begin(tx, f)
      await tx`select public.record_customer_messaging_inbound(${`SM${randomUUID().replaceAll("-", "")}`}, 'sms', ${f.hmac}, 'help')`
      // Every erasure path writes the placeholder email in the same statement.
      await tx`update public.customers
        set phone_hmac = null,
            email = ${`erased+${f.customer.replaceAll("-", "")}@privacy.invalid`}
        where id = ${f.customer}`
      const [delivery] =
        await tx`select recipient_last4 from public.notification_deliveries where id = ${id}`
      assert.equal(delivery.recipient_last4, null)
      const [{ n }] =
        await tx`select count(*)::int as n from public.customer_inbound_messages where phone_hmac = ${f.hmac}`
      assert.equal(n, 0)
      await assert.rejects(
        tx.savepoint((sql) => begin(sql, f, "sms")),
        /Customer phone identity required/
      )
      const [late] = await tx`select public.record_notification_delivery(
        ${f.event}, null, ${f.customer}, 'skipped', 2, null, 'channel_disabled', '{}', 'sms', '1234') as id`
      const [lateDelivery] =
        await tx`select recipient_last4 from public.notification_deliveries where id = ${late.id}`
      assert.equal(lateDelivery.recipient_last4, null)
    })
  }
)

test(
  "dispatch budgets refuse the 61st minute send without consuming other buckets",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await tx`delete from public.rate_limit_buckets where bucket_key like 'customer-messaging:%'`
      for (let index = 0; index < 60; index += 1) {
        const [row] =
          await tx`select public.admit_customer_message_dispatch(${f.merchant}, 'transactional') as admitted`
        assert.equal(row.admitted, true)
      }
      const [denied] =
        await tx`select public.admit_customer_message_dispatch(${f.merchant}, 'transactional') as admitted`
      assert.equal(denied.admitted, false)
      const [hour] =
        await tx`select count from public.rate_limit_buckets where bucket_key = 'customer-messaging:global:hour:v1'`
      assert.equal(hour.count, 60)
    })
  }
)

test(
  "merchant phone messaging defaults off and messaging RPCs are service-only",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await createRewardPoolFixture(tx)
      const [merchant] =
        await tx`select customer_messaging_enabled from public.merchants where id = ${f.merchantId}`
      assert.equal(merchant.customer_messaging_enabled, false)
      await tx`update public.merchants set customer_messaging_enabled = true where id = ${f.merchantId}`
      await tx`update public.merchants set customer_messaging_enabled = true where id = ${f.merchantId}`
      const audits = await tx`select metadata from public.audit_logs
        where merchant_id = ${f.merchantId} and action = 'customer_messaging_enabled_changed'`
      assert.equal(audits.length, 1)
      assert.deepEqual(audits[0].metadata, { previous: false, enabled: true })
      const functions = [
        "begin_notification_message_delivery(uuid,uuid,text,integer,text)",
        "finish_notification_message_delivery(uuid,text,text,text,text,integer,text)",
        "apply_twilio_message_status(uuid,text,text,text)",
        "record_customer_messaging_inbound(text,text,text,text)",
        "admit_customer_message_dispatch(uuid,text)",
        "customer_phone_marketing_consent(uuid,uuid)",
        "update_customer_phone_messaging_preferences(uuid,boolean,text)",
        "list_pending_loyalty_terms_updates(integer)",
      ]
      for (const fn of functions) {
        const [privileges] = await tx`select
        has_function_privilege('anon', ${`public.${fn}`}, 'EXECUTE') as anon,
        has_function_privilege('authenticated', ${`public.${fn}`}, 'EXECUTE') as authenticated,
        has_function_privilege('service_role', ${`public.${fn}`}, 'EXECUTE') as service`
        assert.deepEqual(privileges, {
          anon: false,
          authenticated: false,
          service: true,
        })
      }
    })
  }
)

test(
  "policy cutover candidates are bounded and disappear after a deduped event exists",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await tx`update public.customer_memberships set policy_cutover_notice_at = now()
        where customer_id = ${f.customer} and merchant_id = ${f.merchant}`
      const candidates =
        await tx`select * from public.list_pending_loyalty_terms_updates(100)
          where customer_id = ${f.customer} and merchant_id = ${f.merchant}`
      assert.equal(candidates.length, 1)
      const candidate = candidates[0]
      await tx`select public.enqueue_notification_event(
        'loyalty_terms_updated', ${f.customer}, ${f.merchant}, ${candidate.membership_id},
        ${null}::uuid, ${candidate.active_cycle_number}::integer, current_date, now(),
        ${`loyalty_terms_updated:${candidate.membership_id}:${candidate.policy_cutover_notice_at.toISOString()}`},
        '{"title":"Loyalty terms updated","body":"Fixture","url":"/home"}',
        jsonb_build_object('source', 'policy_cutover', 'policy_cutover_notice_at', ${candidate.policy_cutover_notice_at.toISOString()}::timestamptz)
      )`
      const after =
        await tx`select * from public.list_pending_loyalty_terms_updates(100)
          where customer_id = ${f.customer} and merchant_id = ${f.merchant}`
      assert.equal(after.length, 0)
    })
  }
)

test(
  "join opt-in writes both phone channels once and preserves optional email consent",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await createRewardPoolFixture(tx)
      // Phone-channel consent needs a phone; the fixture customer is email-only.
      await tx`update public.customers
        set phone_hmac = ${randomUUID().replaceAll("-", "").repeat(2)},
            phone_verified_at = now()
        where id = ${f.customerId}`
      const [merchant] =
        await tx`select business_slug from public.merchants where id = ${f.merchantId}`
      for (let index = 0; index < 2; index += 1) {
        await tx`select * from public.join_customer_membership(${f.customerId}, ${merchant.business_slug}, null, true, 'phone-test-v1')`
      }
      const rows =
        await tx`select channel, count(*)::int as count from public.consent_records
      where customer_id = ${f.customerId} and merchant_id = ${f.merchantId}
        and source = 'customer_join' and policy_version = 'phone-test-v1'
      group by channel order by channel`
      assert.deepEqual(
        [...rows],
        [
          { channel: "email", count: 1 },
          { channel: "sms", count: 1 },
          { channel: "whatsapp", count: 1 },
        ]
      )
    })
  }
)

test(
  "explicit phone channel opt-out wins over consent inherited from its sibling",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      await tx`insert into public.consent_records
      (customer_id, merchant_id, channel, consent_status, source, policy_version, created_at)
      values (${f.customer}, ${f.merchant}, 'sms', 'opted_in', 'test', 'v1', now()),
        (${f.customer}, ${f.merchant}, 'whatsapp', 'opted_out', 'test', 'v1', now() - interval '1 day')`
      const rows =
        await tx`select channel, opted_in from public.customer_phone_marketing_consent(${f.customer}, ${f.merchant}) order by channel`
      assert.deepEqual(
        [...rows],
        [
          { channel: "sms", opted_in: true },
          { channel: "whatsapp", opted_in: false },
        ]
      )
    })
  }
)

test(
  "late WhatsApp failures do not requeue events after the fallback window",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      const id = await begin(tx, f)
      const sid = `SM${randomUUID().replaceAll("-", "")}`
      await tx`select public.finish_notification_message_delivery(${id}, 'sent', ${sid}, 'sent')`
      await tx`update public.notification_deliveries set provider_attempted_at = now() - interval '25 hours' where id = ${id}`
      await tx`update public.notification_events
        set status = 'sent', sent_at = now()
        where id = ${f.event}`
      await tx`select public.apply_twilio_message_status(${id}, ${sid}, 'undelivered', '63003')`
      const [event] =
        await tx`select status, metadata from public.notification_events where id = ${f.event}`
      assert.equal(event.status, "sent")
      assert.equal(event.metadata.fallback_from, undefined)
    })
  }
)

test(
  "hour, day and venue marketing limits each refuse atomically",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      const cases = [
        ["customer-messaging:global:hour:v1", 600, "transactional"],
        ["customer-messaging:global:day:v1", 3000, "transactional"],
        [`customer-messaging:merchant:${f.merchant}:day:v1`, 500, "marketing"],
      ]
      for (const [key, count, category] of cases) {
        await tx`delete from public.rate_limit_buckets where bucket_key like 'customer-messaging:%'`
        await tx`insert into public.rate_limit_buckets (bucket_key, count, reset_at)
        values (${key}, ${count}, now() + interval '1 day')`
        const [result] =
          await tx`select public.admit_customer_message_dispatch(${f.merchant}, ${category}) as admitted`
        assert.equal(result.admitted, false)
        const [{ n }] =
          await tx`select count(*)::int as n from public.rate_limit_buckets where bucket_key like 'customer-messaging:%'`
        assert.equal(n, 1, "failed admission rolls back earlier bucket debits")
      }
    })
  }
)

test(
  "push delivery rows retain their append-only audit contract",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const f = await fixture(tx)
      const [row] =
        await tx`select public.record_notification_delivery(${f.event}, null, ${f.customer}, 'sent') as id`
      await assert.rejects(
        tx.savepoint(
          (sql) =>
            sql`update public.notification_deliveries set status = 'permanent_failure' where id = ${row.id}`
        ),
        /append-only/
      )
    })
  }
)
