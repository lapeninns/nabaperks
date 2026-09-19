begin read only;
do $$
begin
  if (select count(*) from public.billing_customers b join (values ('cus_synthetic_upgrade_1','trialing'),('cus_synthetic_upgrade_2','active'),('cus_synthetic_upgrade_3','past_due')) expected(customer_id,state) on b.stripe_customer_id=expected.customer_id where b.status=expected.state and b.stripe_subscription_status=expected.state and b.unit_amount=4900 and b.currency='gbp' and b.billing_interval='month') <> 3 then
    raise exception 'Synthetic subscription states changed';
  end if;
  if not exists (
    select 1 from public.customer_memberships m
    join public.reward_events r on r.membership_id=m.id and r.merchant_id=m.merchant_id and r.customer_id=m.customer_id
    where m.id='ee600000-0000-4000-8000-000000000001' and m.total_stamps_earned=3
      and m.current_stamp_count=case when exists (select 1 from supabase_migrations.schema_migrations where version='20260924100000') then 0 else 3 end
      and m.active_cycle_number=case when exists (select 1 from supabase_migrations.schema_migrations where version='20260924100000') then 2 else 1 end
      and r.id='ee800000-0000-4000-8000-000000000001' and r.status='unlocked' and r.source='stamp_cycle'
      and (select sum(stamps_delta) from public.stamp_events where membership_id=m.id)=3
  ) then raise exception 'Synthetic stamp and reward relationship changed'; end if;
  if (select count(*) from public.stripe_webhook_events where stripe_event_id='evt_synthetic_upgrade_done' and processed_at is not null and failed_at is null and attempt_count=1 and not livemode) <> 1
    or (select count(*) from public.stripe_webhook_events where stripe_event_id='evt_synthetic_upgrade_retry' and processed_at is null and failed_at is not null and attempt_count=1 and not livemode) <> 1 then
    raise exception 'Synthetic webhook idempotency and retry state changed';
  end if;
end $$;
select json_build_object('fixtureRows',
  (select count(*) from auth.users where email in ('upgrade-owner@example.test','upgrade-owner-2@example.test','upgrade-owner-3@example.test','upgrade-customer@example.test')) +
  (select count(*) from public.merchants where business_slug like 'synthetic-upgrade-%') +
  (select count(*) from public.billing_customers where stripe_customer_id like 'cus_synthetic_upgrade_%') +
  (select count(*) from public.merchant_locations where id='ee300000-0000-4000-8000-000000000001') +
  (select count(*) from public.loyalty_cards where id='ee400000-0000-4000-8000-000000000001') +
  (select count(*) from public.customers where id='ee500000-0000-4000-8000-000000000001') +
  (select count(*) from public.customer_memberships where id='ee600000-0000-4000-8000-000000000001') +
  (select count(*) from public.stamp_events where id='ee700000-0000-4000-8000-000000000001') +
  (select count(*) from public.reward_events where id='ee800000-0000-4000-8000-000000000001') +
  (select count(*) from public.stripe_webhook_events where stripe_event_id in ('evt_synthetic_upgrade_done','evt_synthetic_upgrade_retry')),
  'subscriptions',3,'memberships',1,'stampEvents',1,'rewards',1,'webhooks',2,
  'cycle', (select json_build_object('currentStampCount', current_stamp_count, 'activeCycleNumber', active_cycle_number) from public.customer_memberships where id='ee600000-0000-4000-8000-000000000001'),
  'stampRows', (select jsonb_agg(jsonb_build_object('id',s.id,'merchantId',s.merchant_id,'customerId',s.customer_id,'membershipId',s.membership_id,'cardId',s.loyalty_card_id,'locationId',s.location_id,'eventType',s.event_type,'delta',s.stamps_delta,'earnedBusinessDate',s.earned_business_date,'cycle',s.cycle_number,'metadata',s.metadata,'createdAt',s.created_at) order by s.id) from public.stamp_events s where membership_id='ee600000-0000-4000-8000-000000000001'),
  'rewardRows', (select jsonb_agg(jsonb_build_object('id',r.id,'merchantId',r.merchant_id,'customerId',r.customer_id,'membershipId',r.membership_id,'cardId',r.loyalty_card_id,'name',r.reward_name,'terms',r.reward_terms,'redeemableFrom',r.redeemable_from,'expiresAt',r.expires_at,'redeemedAt',r.redeemed_at,'status',r.status,'source',r.source,'cycle',r.cycle_number,'metadata',r.metadata,'createdAt',r.created_at) order by r.id) from public.reward_events r where membership_id='ee600000-0000-4000-8000-000000000001'),
  'seededAuditRows', (select jsonb_agg(jsonb_build_object('id',a.id,'actorType',a.actor_type,'actorId',a.actor_id,'merchantId',a.merchant_id,'customerId',a.customer_id,'targetTable',a.target_table,'targetId',a.target_id,'action',a.action,'metadata',a.metadata) order by a.id) from public.audit_logs a where a.target_id='ee800000-0000-4000-8000-000000000001'),
  'cutoverAuditRows', (select jsonb_agg(jsonb_build_object('actorType',a.actor_type,'actorId',a.actor_id,'merchantId',a.merchant_id,'customerId',a.customer_id,'targetTable',a.target_table,'targetId',a.target_id,'action',a.action,'metadata',a.metadata) order by a.id) from public.audit_logs a where a.target_id='ee600000-0000-4000-8000-000000000001' and a.action='cycle_opened_at_policy_cutover'));
commit;
