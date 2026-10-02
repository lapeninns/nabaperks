import { randomUUID } from "node:crypto"
import { createRewardPoolFixture } from "./reward-pool-fixture.mjs"

export async function createStampCollectionFixture(sql) {
  return sql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
    const f = await createRewardPoolFixture(tx)
    await tx`update customers set date_of_birth_verified_at=now(), date_of_birth_verification_source='trusted_database' where id=${f.customerId}`
    await tx`update customer_memberships set current_stamp_count=2,total_stamps_earned=2 where id=${f.membershipId}`
    for (const days of [2, 3]) {
      await tx`insert into stamp_events(merchant_id,customer_id,membership_id,loyalty_card_id,location_id,event_type,stamps_delta,cycle_number,earned_business_date,metadata,created_at)
        values(${f.merchantId},${f.customerId},${f.membershipId},${f.cardId},${f.locationId},'earned',1,1,public.uk_business_date(now())-${days}::integer,'{"source":"self_service_qr"}',now()-make_interval(days=>${days}::integer))`
    }
    for (let i = 0; i < 3; i++) {
      await tx`insert into reward_pool_items(merchant_id,location_id,loyalty_card_id,reward_name,reward_terms,weight,is_active,requires_age_check)
        values(${f.merchantId},${f.locationId},${f.cardId},${`Lock proof ${i}`},'Preserved reward terms',1,true,false)`
    }
    f.qrId = `lock-proof-${randomUUID()}`
    await tx`insert into qr_codes(qr_id,merchant_id,location_id,loyalty_card_id,destination_type,is_active)
      values(${f.qrId},${f.merchantId},${f.locationId},${f.cardId},'join',true)`
    await tx`insert into reward_events(id,merchant_id,customer_id,membership_id,loyalty_card_id,status,source,reward_name,reward_terms,redeemable_from,reward_policy_version,available_from)
      values(${f.rewardEventId},${f.merchantId},${f.customerId},${f.membershipId},${f.cardId},'unlocked','merchant_direct','Original direct reward','Immutable direct terms',public.uk_business_date(now()),'v2',now()-interval '1 hour')`
    const [token] =
      await tx`select * from create_reward_scan_token(${f.rewardEventId},${f.customerId})`
    f.token = token.scan_token
    await tx`insert into customer_loyalty_terms_acceptances(membership_id,customer_id,merchant_id,loyalty_card_id,policy_version,source,terms_snapshot,terms_sha256)
      values(${f.membershipId},${f.customerId},${f.merchantId},${f.cardId},'lock-proof','customer_join','{"terms":"immutable"}',repeat('a',64))`
    return f
  })
}
