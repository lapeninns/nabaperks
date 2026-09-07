begin read only;
do $$
begin
  if (select count(*) from public.billing_customers b join (values ('cus_synthetic_upgrade_1','trialing'),('cus_synthetic_upgrade_2','active'),('cus_synthetic_upgrade_3','past_due')) expected(customer_id,state) on b.stripe_customer_id=expected.customer_id where b.status=expected.state and b.stripe_subscription_status=expected.state and b.unit_amount=4900 and b.currency='gbp' and b.billing_interval='month') <> 3 then
    raise exception 'Synthetic subscription states changed';
  end if;
  if not exists (
    select 1 from public.customer_memberships m
    join public.reward_events r on r.membership_id=m.id and r.merchant_id=m.merchant_id and r.customer_id=m.customer_id
    where m.id='ee600000-0000-4000-8000-000000000001' and m.current_stamp_count=3 and m.total_stamps_earned=3
      and r.id='ee800000-0000-4000-8000-000000000001' and r.status='unlocked' and r.source='stamp_cycle'
      and (select sum(stamps_delta) from public.stamp_events where membership_id=m.id)=3
  ) then raise exception 'Synthetic stamp and reward relationship changed'; end if;
  if (select count(*) from public.stripe_webhook_events where stripe_event_id='evt_synthetic_upgrade_done' and processed_at is not null and failed_at is null and attempt_count=1 and not livemode) <> 1
    or (select count(*) from public.stripe_webhook_events where stripe_event_id='evt_synthetic_upgrade_retry' and processed_at is null and failed_at is not null and attempt_count=1 and not livemode) <> 1 then
    raise exception 'Synthetic webhook idempotency and retry state changed';
  end if;
end $$;
select json_build_object('fixtureRows',
  (select count(*) from auth.users where email in ('upgrade-owner@example.test','upgrade-customer@example.test')) +
  (select count(*) from public.merchants where business_slug like 'synthetic-upgrade-%') +
  (select count(*) from public.billing_customers where stripe_customer_id like 'cus_synthetic_upgrade_%') +
  (select count(*) from public.merchant_locations where id='ee300000-0000-4000-8000-000000000001') +
  (select count(*) from public.loyalty_cards where id='ee400000-0000-4000-8000-000000000001') +
  (select count(*) from public.customers where id='ee500000-0000-4000-8000-000000000001') +
  (select count(*) from public.customer_memberships where id='ee600000-0000-4000-8000-000000000001') +
  (select count(*) from public.stamp_events where id='ee700000-0000-4000-8000-000000000001') +
  (select count(*) from public.reward_events where id='ee800000-0000-4000-8000-000000000001') +
  (select count(*) from public.stripe_webhook_events where stripe_event_id in ('evt_synthetic_upgrade_done','evt_synthetic_upgrade_retry')),
  'subscriptions',3,'memberships',1,'stampEvents',1,'rewards',1,'webhooks',2);
commit;
