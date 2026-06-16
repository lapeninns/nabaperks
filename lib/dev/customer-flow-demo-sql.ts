import type postgres from "postgres"

import { CustomerFlowDemoError } from "./customer-flow-demo-error.ts"
import {
  assertAdvancePreconditions,
  CUSTOMER_FLOW_DEMO,
  customerFlowStatusFromRow,
  type AdvanceResult,
  type CustomerFlowCommandInput,
  type CustomerFlowCommandResult,
  type CustomerFlowRewardRow,
  type CustomerFlowStatus,
  type CustomerFlowStatusRow,
  type MakeRedeemableResult,
  type RemoveStampResult,
  type ResetResult,
  type StampEventRow,
} from "./customer-flow-demo-types.ts"

type CustomerFlowSql = postgres.Sql

export async function runCustomerFlowSqlCommand(
  sql: CustomerFlowSql,
  input: CustomerFlowCommandInput,
  phoneHmac: string
): Promise<CustomerFlowCommandResult> {
  switch (input.command) {
    case "reset":
      return resetCustomer(sql, input.phone, phoneHmac)
    case "status":
      return getStatus(sql, input.phone, phoneHmac)
    case "advance":
      return advanceCustomer(sql, input.phone, phoneHmac, input.stamps)
    case "make-redeemable":
      return makeRedeemable(sql, input.phone, phoneHmac)
    case "remove-stamp":
      return removeStamp(sql, input.phone, phoneHmac)
    default:
      return assertNever(input)
  }
}

async function resetCustomer(
  sql: CustomerFlowSql,
  phone: string,
  phoneHmac: string
): Promise<ResetResult> {
  const customerId = await customerIdForPhone(sql, phoneHmac)

  await sql.begin(async (tx) => {
    if (customerId) {
      await tx`delete from public.product_events where customer_id = ${customerId}`
      await tx`delete from public.audit_logs where customer_id = ${customerId}`
      await tx`delete from public.fraud_flags where customer_id = ${customerId}`
      await tx`delete from public.customers where id = ${customerId}`
    }

    await tx`truncate table public.rate_limit_buckets`
  })

  return {
    phone,
    customerId,
    merchantSlug: CUSTOMER_FLOW_DEMO.merchantSlug,
    qrId: CUSTOMER_FLOW_DEMO.qrId,
    message: customerId
      ? "Customer reset."
      : "No customer found; rate limits cleared.",
  }
}

async function getStatus(
  sql: CustomerFlowSql,
  phone: string,
  phoneHmac: string
): Promise<CustomerFlowStatus> {
  const rows = await sql<CustomerFlowStatusRow[]>`
    select
      customers.id as customer_id,
      memberships.id as membership_id,
      memberships.current_stamp_count,
      memberships.total_stamps_earned,
      (
        select max(stamp_events.earned_business_date)::text
        from public.stamp_events
        where stamp_events.membership_id = memberships.id
          and stamp_events.event_type = 'earned'
      ) as latest_business_date
    from public.customers
    left join public.customer_memberships memberships
      on memberships.customer_id = customers.id
      and memberships.merchant_id = ${CUSTOMER_FLOW_DEMO.merchantId}
    where customers.phone_hmac = ${phoneHmac}
    limit 1
  `
  const row = rows[0] ?? null
  const reward = row?.membership_id
    ? await latestReward(sql, row.membership_id)
    : null

  return customerFlowStatusFromRow({ phone, row, latestReward: reward })
}

async function advanceCustomer(
  sql: CustomerFlowSql,
  phone: string,
  phoneHmac: string,
  stamps: number
): Promise<AdvanceResult> {
  const status = await getStatus(sql, phone, phoneHmac)
  const membershipId = status.membershipId
  const stampRows = membershipId
    ? await sql<StampEventRow[]>`
        select id
        from public.stamp_events
        where membership_id = ${membershipId}
          and event_type = 'earned'
        order by created_at asc, id asc
      `
    : []

  assertAdvancePreconditions(status, stampRows.length, stamps)
  const confirmedMembershipId = status.membershipId

  await sql.begin(async (tx) => {
    for (const [index, stamp] of stampRows.entries()) {
      const daysAgo = stamps - index
      await tx`
        update public.stamp_events
        set
          earned_business_date = public.uk_business_date(now() - (${daysAgo}::text || ' days')::interval),
          created_at = now() - (${daysAgo}::text || ' days')::interval
        where id = ${stamp.id}
      `
    }

    await tx`
      update public.customer_memberships
      set
        current_stamp_count = ${stamps},
        total_stamps_earned = greatest(total_stamps_earned, ${stamps}),
        last_visit_at = case when ${stamps} > 0 then now() - interval '1 day' else last_visit_at end
      where id = ${confirmedMembershipId}
    `
  })

  return {
    phone,
    membershipId: confirmedMembershipId,
    stamps,
    message: "Customer advanced.",
  }
}

async function makeRedeemable(
  sql: CustomerFlowSql,
  phone: string,
  phoneHmac: string
): Promise<MakeRedeemableResult> {
  const status = await getStatus(sql, phone, phoneHmac)
  const rewardId = status.latestReward?.id

  if (!rewardId) {
    throw new CustomerFlowDemoError(
      "No unlocked reward found for this customer."
    )
  }

  await sql`
    update public.reward_events
    set redeemable_from = public.uk_business_date(now())
    where id = ${rewardId}
  `

  return {
    phone,
    membershipId: status.membershipId,
    rewardId,
    message: "Reward made redeemable.",
  }
}

async function removeStamp(
  sql: CustomerFlowSql,
  phone: string,
  phoneHmac: string
): Promise<RemoveStampResult> {
  const status = await getStatus(sql, phone, phoneHmac)

  if (!status.membershipId) {
    throw new CustomerFlowDemoError(
      "Customer membership does not exist. Run the join phase first."
    )
  }

  if (status.currentStampCount <= 0) {
    throw new CustomerFlowDemoError("Customer has no stamps to remove.")
  }

  const membershipId = status.membershipId

  const result = await sql.begin(async (tx) => {
    const deleted = await tx`
      delete from public.stamp_events
      where id = (
        select id
        from public.stamp_events
        where membership_id = ${membershipId}
          and event_type = 'earned'
        order by created_at desc, id desc
        limit 1
      )
      returning id
    `

    const updated = await tx<{ current_stamp_count: number }[]>`
      update public.customer_memberships
      set
        current_stamp_count = greatest(current_stamp_count - 1, 0),
        total_stamps_earned = greatest(total_stamps_earned - 1, 0),
        updated_at = now()
      where id = ${membershipId}
      returning current_stamp_count
    `

    const cancelled = await tx`
      update public.reward_events
      set status = 'cancelled', updated_at = now()
      where membership_id = ${membershipId}
        and status = 'unlocked'
      returning id
    `

    return {
      deletedCount: deleted.length,
      currentStampCount: updated[0]?.current_stamp_count ?? 0,
      cancelledRewards: cancelled.length,
    }
  })

  if (result.deletedCount === 0) {
    throw new CustomerFlowDemoError("No earned stamp row found to remove.")
  }

  return {
    phone,
    membershipId,
    currentStampCount: result.currentStampCount,
    cancelledRewards: result.cancelledRewards,
    message: "One stamp removed.",
  }
}

async function customerIdForPhone(
  sql: CustomerFlowSql,
  phoneHmac: string
): Promise<string | null> {
  const rows = await sql<{ readonly id: string }[]>`
    select id
    from public.customers
    where phone_hmac = ${phoneHmac}
    limit 1
  `

  return rows[0]?.id ?? null
}

async function latestReward(
  sql: CustomerFlowSql,
  membershipId: string
): Promise<CustomerFlowRewardRow | null> {
  const rows = await sql<CustomerFlowRewardRow[]>`
    select id, status, reward_name, redeemable_from::text
    from public.reward_events
    where membership_id = ${membershipId}
    order by created_at desc, id desc
    limit 1
  `

  return rows[0] ?? null
}

function assertNever(value: never): never {
  throw new CustomerFlowDemoError(`Unsupported customer-flow command: ${value}`)
}
