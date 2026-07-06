-- MS-db-deletion-semantics: deletion semantics for customer identity.
--
-- Why: customers.auth_user_id was ON DELETE CASCADE, so a single auth-user
-- deletion (dashboard, Management API, script) cascaded through memberships
-- into stamp events, reward events, notifications, sessions, and consent
-- records — the mechanism of the 2026-07-04 prod incident, and a
-- contradiction of the deliberate erase-PII-keep-ledger design
-- (admin_erase_customer_pii). consent_records also cascaded away with the
-- customer row, destroying PECR/UK-GDPR consent evidence that audit_logs
-- (SET NULL) and fraud_flags (SET NULL) already survive.
--
-- After this migration:
--   * customers.auth_user_id is ON DELETE RESTRICT — deleting an auth user
--     that still owns a customers row fails; the sanctioned order is
--     erase PII -> delete the customers row -> delete the auth user.
--   * consent_records.customer_id is nullable and ON DELETE SET NULL —
--     deleting a customers row keeps the consent evidence with a nulled
--     customer reference. consent_records.merchant_id stays CASCADE (tenant
--     teardown removes the tenant's ledger).
--
-- Idempotent: re-running on an already-migrated database is a no-op.

do $$
declare
  v_delete_rule "char";
begin
  select confdeltype into v_delete_rule
  from pg_constraint
  where conname = 'customers_auth_user_id_fkey'
    and conrelid = 'public.customers'::regclass;

  if v_delete_rule is distinct from 'r' then
    alter table public.customers
      drop constraint if exists customers_auth_user_id_fkey;
    alter table public.customers
      add constraint customers_auth_user_id_fkey
      foreign key (auth_user_id) references auth.users (id) on delete restrict;
  end if;
end
$$;

alter table public.consent_records
  alter column customer_id drop not null;

do $$
declare
  v_delete_rule "char";
begin
  select confdeltype into v_delete_rule
  from pg_constraint
  where conname = 'consent_records_customer_id_fkey'
    and conrelid = 'public.consent_records'::regclass;

  if v_delete_rule is distinct from 'n' then
    alter table public.consent_records
      drop constraint if exists consent_records_customer_id_fkey;
    alter table public.consent_records
      add constraint consent_records_customer_id_fkey
      foreign key (customer_id) references public.customers (id) on delete set null;
  end if;
end
$$;
