-- MS-db-emergency-containment — Blocker 3a: reconcile customers.email_hmac.
--
-- `customers.email_hmac` and its partial index were introduced by EDITING an
-- already-applied migration (20260704095000) rather than by adding a new one.
-- Fresh replay therefore has the column, but the live database — which ran the
-- original, unedited file — does not. Meanwhile lib/customer/profile.ts reads
-- and writes email_hmac, so live is one edit behind the code that depends on it.
--
-- This forward-only migration guarantees the column and its index exist in every
-- database. It is a strict no-op wherever they already exist (fresh/local), and
-- the repair wherever they do not (live). The column carries no NOT NULL or
-- default, so adding it is a metadata-only, non-rewriting operation safe on a
-- populated table.

alter table public.customers
  add column if not exists email_hmac text;

create index if not exists customers_email_hmac_idx
  on public.customers (email_hmac)
  where email_hmac is not null;
