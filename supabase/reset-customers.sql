-- Wipe customer loyalty data only.
-- Merchants, staff, admin, QR assets, billing, and merchant-only events are preserved.

begin;

create temp table _customer_auth_users on commit drop as
select distinct auth_user_id as user_id
from public.customers
where auth_user_id is not null;

delete from public.product_events
where customer_id is not null
   or membership_id is not null;

delete from public.audit_logs
where customer_id is not null;

delete from public.fraud_flags
where customer_id is not null
   or membership_id is not null;

delete from public.customers;

delete from auth.users users
where users.id in (select user_id from _customer_auth_users);

truncate table public.rate_limit_buckets;

commit;
