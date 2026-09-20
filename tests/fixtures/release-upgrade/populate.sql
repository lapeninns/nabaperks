-- Synthetic reserved IDs and example.test addresses only. This fixture targets
-- the real Nabaperks schema at baselines containing billing_state_durability.
-- No source database, dump, live token or external provider is consulted.
begin;
insert into auth.users (id, email) values
('ee000000-0000-4000-8000-000000000001','upgrade-owner@example.test'),
('ee000000-0000-4000-8000-000000000002','upgrade-customer@example.test'),
('ee000000-0000-4000-8000-000000000003','upgrade-owner-2@example.test'),
('ee000000-0000-4000-8000-000000000004','upgrade-owner-3@example.test');
insert into public.merchants (id,owner_user_id,business_name,business_slug,business_type,email)
select ('ee100000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
('ee000000-0000-4000-8000-' || lpad((case when n=1 then 1 else n+1 end)::text,12,'0'))::uuid,'Synthetic upgrade fixture '||n,'synthetic-upgrade-'||n,'pub','upgrade-owner@example.test'
from generate_series(1,3) n;
insert into public.billing_customers
(id,merchant_id,stripe_customer_id,stripe_subscription_id,status,stripe_subscription_status,
stripe_subscription_created_at,stripe_price_id,billing_interval,unit_amount,currency,current_period_end,cancel_at_period_end)
select ('ee200000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
('ee100000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
'cus_synthetic_upgrade_'||n,'sub_synthetic_upgrade_'||n,state,state,
'2026-08-01T00:00:00Z','price_synthetic_upgrade','month',4900,'gbp','2027-01-01T00:00:00Z',false
from (values(1,'trialing'),(2,'active'),(3,'past_due')) fixture(n,state);
insert into public.merchant_locations(id,merchant_id,name) values
('ee300000-0000-4000-8000-000000000001','ee100000-0000-4000-8000-000000000001','Synthetic fixture location');
insert into public.loyalty_cards(id,merchant_id,location_id,card_name,stamps_required,reward_name,reward_terms) values
('ee400000-0000-4000-8000-000000000001','ee100000-0000-4000-8000-000000000001','ee300000-0000-4000-8000-000000000001','Synthetic fixture card',3,'Synthetic fixture reward','Synthetic upgrade only');
insert into public.customers(id,auth_user_id,email) values
('ee500000-0000-4000-8000-000000000001','ee000000-0000-4000-8000-000000000002','upgrade-customer@example.test');
insert into public.customer_memberships(id,merchant_id,customer_id,current_stamp_count,total_stamps_earned) values
('ee600000-0000-4000-8000-000000000001','ee100000-0000-4000-8000-000000000001','ee500000-0000-4000-8000-000000000001',3,3);
insert into public.stamp_events(id,merchant_id,customer_id,membership_id,loyalty_card_id,location_id,event_type,stamps_delta,earned_business_date,cycle_number,created_at,metadata) values
('ee700000-0000-4000-8000-000000000001','ee100000-0000-4000-8000-000000000001','ee500000-0000-4000-8000-000000000001','ee600000-0000-4000-8000-000000000001','ee400000-0000-4000-8000-000000000001','ee300000-0000-4000-8000-000000000001','earned',3,'2026-08-01',1,'2026-08-01T12:00:00Z','{"synthetic_upgrade":true}');
insert into public.reward_events(id,merchant_id,customer_id,membership_id,loyalty_card_id,reward_name,reward_terms,redeemable_from,expires_at,status,source,cycle_number,created_at,metadata) values
('ee800000-0000-4000-8000-000000000001','ee100000-0000-4000-8000-000000000001','ee500000-0000-4000-8000-000000000001','ee600000-0000-4000-8000-000000000001','ee400000-0000-4000-8000-000000000001','Synthetic fixture reward','Synthetic upgrade only','2026-08-04','2026-09-01T12:00:00Z','unlocked','stamp_cycle',1,'2026-08-01T12:00:00Z','{"synthetic_upgrade":true}');
insert into public.stripe_webhook_events(stripe_event_id,event_type,livemode,processed_at,failed_at,last_error,attempt_count) values
('evt_synthetic_upgrade_done','customer.subscription.updated',false,'2026-08-01T00:00:00Z',null,null,1),
('evt_synthetic_upgrade_retry','customer.subscription.updated',false,null,'2026-08-01T00:00:00Z','synthetic retry fixture',1);
insert into public.audit_logs(actor_type,actor_id,merchant_id,customer_id,target_table,target_id,action,metadata) values
('system','system','ee100000-0000-4000-8000-000000000001','ee500000-0000-4000-8000-000000000001','reward_events','ee800000-0000-4000-8000-000000000001','reward_unlocked','{"synthetic_upgrade":true}');
-- A baseline that already contains the cycle-opening migration must model the
-- state that migration produced. Pre-activation baselines remain at 3/1 so the
-- candidate migration itself must perform and audit the transition.
do $$
begin
  if exists (
    select 1
    from supabase_migrations.schema_migrations
    where version = '20260924100000'
  ) then
    update public.customer_memberships
    set current_stamp_count = 0,
        active_cycle_number = 2,
        policy_cutover_notice_at = '2026-08-02T00:00:00Z'
    where id = 'ee600000-0000-4000-8000-000000000001';

    insert into public.audit_logs (
      actor_type, actor_id, merchant_id, customer_id,
      target_table, target_id, action, metadata
    ) values (
      'system', 'system',
      'ee100000-0000-4000-8000-000000000001',
      'ee500000-0000-4000-8000-000000000001',
      'customer_memberships',
      'ee600000-0000-4000-8000-000000000001',
      'cycle_opened_at_policy_cutover',
      '{"cycle_number":1}'
    );
  end if;
end $$;
commit;
