-- The verified-address index matches the app's email normalisation.
--
-- customers_verified_email_address_unique_idx (20261006100000) keyed verified
-- rows on lower(btrim(email)). PostgreSQL btrim(text) strips only U+0020, so a
-- verified address stored with a leading or trailing tab, newline or
-- no-break space survived as a second verified wallet (QA BUG-024), and
-- neither the app nor the index applied Unicode normalisation, so the NFD form
-- of an NFC address ("e" + U+0301 against U+00E9) did too (QA BUG-054).
--
-- The index now keys on exactly what lib/customer/email-pii-core.ts
-- normalizeEmail produces: every Unicode edge whitespace that JavaScript
-- String.prototype.trim removes (tab, LF, VT, FF, CR, space, U+00A0, U+1680,
-- U+2000-U+200A, U+2028, U+2029, U+202F, U+205F, U+3000, U+FEFF) is stripped,
-- then lower(), then normalize(..., NFC). The class is listed explicitly
-- rather than as \s or [[:space:]], whose coverage beyond ASCII depends on the
-- database locale. tests/db/customer-verified-email-unicode-index.test.mjs
-- checks the index key against normalizeEmail for every variant.
--
-- HMAC impact: normalizeEmail now also applies NFC, so email_hmac changes only
-- for an address that is not already NFC (JavaScript trim already removed
-- every edge whitespace). A production read-only check on 2026-09-29 found 0
-- duplicate verified address groups and 0 verified emails with non-space edge
-- whitespace or a non-NFC form, so no stored HMAC is affected. A non-NFC
-- legacy row, if one ever appears, keeps its stored HMAC and is reached again
-- once the customer re-confirms the address (markCustomerEmailVerified repairs
-- a stale HMAC on the locked email).
--
-- Pre-flight (pattern 20261006100000): while the index still has the old key,
-- lock customers and abort with SQLSTATE 23505 when verified rows collide
-- under the new key. Nothing is merged or rewritten; support resolves
-- duplicates first. The new index is built under a temporary name before the
-- old one is dropped, then takes the old name, so the index refusal the app
-- maps to `conflict` (23505 naming customers_verified_email_address_unique_idx)
-- is unchanged. customers is small (about 819 rows in production), so the
-- build inside the migration transaction is brief.
--
-- Compatibility: the deployed app (2c45031c) normalises with trim + lower only.
-- Against this index it can store every address it could before; confirming
-- a variant of an address another wallet has verified is refused with 23505,
-- which that app already maps to a conflict. The predicate (verified,
-- non-null, not an erased placeholder) is unchanged.
--
-- Forward-only and re-runnable: once the index has the new key the pre-flight
-- and rebuild are skipped, and the definition is verified either way.

do $verified_email_address_unicode$
declare
  v_current text;
  v_group_count bigint;
begin
  select pg_catalog.pg_get_indexdef(indexes.indexrelid, 1, false)
  into v_current
  from pg_catalog.pg_index indexes
  where indexes.indexrelid = to_regclass('public.customers_verified_email_address_unique_idx');

  -- pg_get_indexdef deparses the call as NORMALIZE(...).
  if upper(v_current) like 'NORMALIZE(%' then
    return;
  end if;

  lock table public.customers in share row exclusive mode;

  select count(*)
  into v_group_count
  from (
    select normalize(lower(regexp_replace(customers.email, '^[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$', '', 'g')), NFC)
    from public.customers
    where customers.email_verified_at is not null
      and customers.email is not null
      and customers.email not like 'erased+%@privacy.invalid'
    group by 1
    having count(*) > 1
  ) duplicates;

  if v_group_count > 0 then
    raise exception using
      errcode = '23505',
      message = format(
        'Cannot enforce one customer per verified email: %s duplicate verified email address group(s) exist under Unicode whitespace and NFC normalisation',
        v_group_count
      ),
      hint = 'Resolve duplicate verified customer emails through support before replaying this migration.';
  end if;

  drop index if exists public.customers_verified_email_address_nfc_unique_idx;

  create unique index customers_verified_email_address_nfc_unique_idx
    on public.customers ((normalize(lower(regexp_replace(email, '^[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+|[\t\n\v\f\r \u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+$', '', 'g')), NFC)))
    where email_verified_at is not null
      and email is not null
      and email not like 'erased+%@privacy.invalid';

  drop index if exists public.customers_verified_email_address_unique_idx;

  alter index public.customers_verified_email_address_nfc_unique_idx
    rename to customers_verified_email_address_unique_idx;
end;
$verified_email_address_unicode$;

do $verified_email_address_unicode_contract$
begin
  if not exists (
    select 1
    from pg_catalog.pg_index indexes
    where indexes.indexrelid = 'public.customers_verified_email_address_unique_idx'::regclass
      and indexes.indrelid = 'public.customers'::regclass
      and indexes.indisunique
      and indexes.indisvalid
      and indexes.indisready
      and indexes.indnkeyatts = 1
      and pg_catalog.pg_get_indexdef(indexes.indexrelid, 1, false)
        like 'NORMALIZE(lower(regexp_replace(email, ''^[\t\n\v\f\r %, NFC)' escape ''
      and pg_catalog.pg_get_expr(indexes.indpred, indexes.indrelid)
        = '((email_verified_at IS NOT NULL) AND (email IS NOT NULL) AND (email !~~ ''erased+%@privacy.invalid''::text))'
  ) then
    raise exception using
      errcode = '55000',
      message = 'Index customers_verified_email_address_unique_idx exists with an incompatible definition';
  end if;
end;
$verified_email_address_unicode_contract$;

comment on index public.customers_verified_email_address_unique_idx is
  'One customer per verified email address. Keys on the address with Unicode edge whitespace trimmed, lower-cased and NFC-normalised (the same as normalizeEmail), so a second verified row for any variant is refused even when its email_hmac differs or is stale. Erased placeholder addresses are excluded.';

notify pgrst, 'reload schema';
