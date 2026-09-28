-- One wallet per verified email.
--
-- Email sign-in looks a wallet up by `email_hmac` among verified rows only, so a
-- verified email must identify exactly one customer, as `phone_hmac` already
-- does. Two unique partial indexes enforce it:
--
-- - customers_verified_email_hmac_unique_idx on verified `email_hmac`, the key
--   email sign-in resolves;
-- - customers_verified_email_address_unique_idx on verified
--   lower(btrim(email)), so a second wallet cannot verify the same address
--   under a different or stale HMAC (for example a row whose HMAC predates a
--   key rotation or an HMAC repair). Erased placeholder addresses
--   ('erased+<id>@privacy.invalid', written by every erasure path) are
--   excluded, as the erasure and retention functions already exclude them.
--
-- Release ordering and compatibility: the application build with the
-- conflict-safe markCustomerEmailVerified (lib/customer/profile.ts, "Step 0"
-- PR, branch codex/email-step0-prompt) should be live before this migration is
-- applied. That build pre-checks for another wallet holding the email and maps
-- SQLSTATE 23505 from either index to a `conflict` outcome. The release
-- pipeline applies migrations before promoting the app, so an older build may
-- briefly run against these indexes. It then fails closed: confirming an email
-- already verified on another wallet raises 23505 as a generic error and
-- changes nothing, where without the index it would silently create a second
-- verified wallet for the same address. The refusal is the intended outcome in
-- both builds; only the message differs.
--
-- prevent_verified_customer_contact_change is deliberately left as it is: the
-- locked-email re-confirmation path (markCustomerEmailVerified) rewrites
-- `email_hmac` on a verified row to repair a missing or stale HMAC, so freezing
-- the HMAC here would break that repair. The repair leaves `email` unchanged,
-- so the address index does not affect it.
--
-- Pre-flight (pattern 20260710100000_atomic_merchant_onboarding.sql): while
-- either index is absent, lock `customers` and abort with SQLSTATE 23505 when
-- verified rows would collide or could not be covered by the indexes. Nothing
-- is merged or rewritten automatically; duplicates are resolved by support
-- first.
--
-- Forward-only and re-runnable: the pre-flight runs only while an index is
-- missing, and each index is created conditionally and its definition
-- verified.

do $verified_email_preflight$
declare
  v_group_count bigint;
begin
  if to_regclass('public.customers_verified_email_hmac_unique_idx') is null
     or to_regclass('public.customers_verified_email_address_unique_idx') is null then
    lock table public.customers in share row exclusive mode;

    select count(*)
    into v_group_count
    from (
      select customers.email_hmac
      from public.customers
      where customers.email_verified_at is not null
        and customers.email_hmac is not null
      group by customers.email_hmac
      having count(*) > 1
    ) duplicates;

    if v_group_count > 0 then
      raise exception using
        errcode = '23505',
        message = format(
          'Cannot enforce one customer per verified email: %s duplicate email_hmac group(s) exist',
          v_group_count
        ),
        hint = 'Resolve duplicate verified customer emails through support before replaying this migration.';
    end if;

    select count(*)
    into v_group_count
    from (
      select lower(btrim(customers.email))
      from public.customers
      where customers.email_verified_at is not null
        and customers.email is not null
        and customers.email not like 'erased+%@privacy.invalid'
      group by lower(btrim(customers.email))
      having count(*) > 1
    ) duplicates;

    if v_group_count > 0 then
      raise exception using
        errcode = '23505',
        message = format(
          'Cannot enforce one customer per verified email: %s duplicate verified email address group(s) exist',
          v_group_count
        ),
        hint = 'Resolve duplicate verified customer emails through support before replaying this migration.';
    end if;

    select count(*)
    into v_group_count
    from public.customers
    where customers.email_verified_at is not null
      and customers.email_hmac is null;

    if v_group_count > 0 then
      raise exception using
        errcode = '23505',
        message = format(
          'Cannot enforce one customer per verified email: %s verified customer(s) have no email_hmac',
          v_group_count
        ),
        hint = 'Backfill email_hmac for every verified customer email before replaying this migration.';
    end if;
  end if;
end;
$verified_email_preflight$;

create unique index if not exists customers_verified_email_hmac_unique_idx
  on public.customers (email_hmac)
  where email_verified_at is not null
    and email_hmac is not null;

create unique index if not exists customers_verified_email_address_unique_idx
  on public.customers ((lower(btrim(email))))
  where email_verified_at is not null
    and email is not null
    and email not like 'erased+%@privacy.invalid';

do $verified_email_index_contract$
begin
  if not exists (
    select 1
    from pg_catalog.pg_index indexes
    where indexes.indexrelid = 'public.customers_verified_email_hmac_unique_idx'::regclass
      and indexes.indrelid = 'public.customers'::regclass
      and indexes.indisunique
      and indexes.indisvalid
      and indexes.indisready
      and indexes.indnkeyatts = 1
      and pg_catalog.pg_get_indexdef(indexes.indexrelid, 1, false) = 'email_hmac'
      and pg_catalog.pg_get_expr(indexes.indpred, indexes.indrelid)
        = '((email_verified_at IS NOT NULL) AND (email_hmac IS NOT NULL))'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Index customers_verified_email_hmac_unique_idx exists with an incompatible definition';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_index indexes
    where indexes.indexrelid = 'public.customers_verified_email_address_unique_idx'::regclass
      and indexes.indrelid = 'public.customers'::regclass
      and indexes.indisunique
      and indexes.indisvalid
      and indexes.indisready
      and indexes.indnkeyatts = 1
      and pg_catalog.pg_get_indexdef(indexes.indexrelid, 1, false) = 'lower(btrim(email))'
      and pg_catalog.pg_get_expr(indexes.indpred, indexes.indrelid)
        = '((email_verified_at IS NOT NULL) AND (email IS NOT NULL) AND (email !~~ ''erased+%@privacy.invalid''::text))'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Index customers_verified_email_address_unique_idx exists with an incompatible definition';
  end if;
end;
$verified_email_index_contract$;

comment on index public.customers_verified_email_hmac_unique_idx is
  'One customer per verified email. Email sign-in resolves a wallet by verified email_hmac, so a second verified row with the same HMAC must be refused.';

comment on index public.customers_verified_email_address_unique_idx is
  'One customer per verified email address. Refuses a second verified row for the same lower(btrim(email)) even when its email_hmac differs or is stale. Erased placeholder addresses are excluded.';

notify pgrst, 'reload schema';
