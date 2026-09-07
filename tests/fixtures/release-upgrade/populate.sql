-- Synthetic reserved IDs and example.test addresses only. This fixture targets
-- the real Nabaperks schema at baselines containing billing_state_durability.
-- No source database, dump, live token or external provider is consulted.
begin;
insert into auth.users (id, email) values
('ee000000-0000-4000-8000-000000000001','upgrade-owner@example.test'),
('ee000000-0000-4000-8000-000000000002','upgrade-customer@example.test');
insert into public.merchants (id,owner_user_id,business_name,business_slug,business_type,email)
select ('ee100000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
'ee000000-0000-4000-8000-000000000001','Synthetic upgrade fixture '||n,'synthetic-upgrade-'||n,'pub','upgrade-owner@example.test'
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
insert into public.stamp_events(id,merchant_id,customer_id,membership_id,loyalty_card_id,event_type,stamps_delta,metadata) values
('ee700000-0000-4000-8000-000000000001','ee100000-0000-4000-8000-000000000001','ee500000-0000-4000-8000-000000000001','ee600000-0000-4000-8000-000000000001','ee400000-0000-4000-8000-000000000001','earned',3,'{"synthetic_upgrade":true}');
insert into public.reward_events(id,merchant_id,customer_id,membership_id,loyalty_card_id,status,source,metadata) values
('ee800000-0000-4000-8000-000000000001','ee100000-0000-4000-8000-000000000001','ee500000-0000-4000-8000-000000000001','ee600000-0000-4000-8000-000000000001','ee400000-0000-4000-8000-000000000001','unlocked','stamp_cycle','{"synthetic_upgrade":true}');
insert into public.stripe_webhook_events(stripe_event_id,event_type,livemode,processed_at,failed_at,last_error,attempt_count) values
('evt_synthetic_upgrade_done','customer.subscription.updated',false,'2026-08-01T00:00:00Z',null,null,1),
('evt_synthetic_upgrade_retry','customer.subscription.updated',false,null,'2026-08-01T00:00:00Z','synthetic retry fixture',1);
commit;
