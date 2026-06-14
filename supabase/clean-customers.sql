-- Remove all customer loyalty data and customer auth users.
-- Preserves merchants, staff, admins, and merchant billing records.

begin;

delete from public.product_events
where customer_id is not null;

delete from public.audit_logs
where customer_id is not null;

delete from public.fraud_flags
where customer_id is not null;

delete from public.customers;

delete from auth.users
where id not in (select owner_user_id from public.merchants)
  and id not in (select user_id from public.internal_admins)
  and id not in (
    select auth_user_id
    from public.staff_users
    where auth_user_id is not null
  );

truncate table public.rate_limit_buckets;

commit;
