-- db privacy lifecycle — Wave-3 blocker 3: verified customers with no
-- membership are undiscoverable.
--
-- Every admin customer lookup queries FROM public.customer_memberships, so a
-- verified customer who never joined a venue is invisible to support. PostgREST
-- cannot express "parent rows with no child rows" cleanly, so the anti-join
-- lives in a service-role-only view the admin service-role client reads through.
--
-- The view excludes erased surrogates (erased+…@privacy.invalid) and carries a
-- verification flag so the console can highlight verified subjects. Read-only,
-- service_role only — the admin reads already run under the service-role client.
--
-- Idempotent: CREATE OR REPLACE VIEW with a fixed column list; the grants are
-- declarative and re-runnable.

create or replace view public.customers_unaffiliated
with (security_barrier = true) as
select
  c.id,
  c.email,
  c.phone_last4,
  c.email_verified_at,
  c.phone_verified_at,
  (c.email_verified_at is not null or c.phone_verified_at is not null) as is_verified,
  c.created_at,
  c.updated_at
from public.customers c
where not exists (
    select 1
    from public.customer_memberships m
    where m.customer_id = c.id
  )
  and coalesce(c.email, '') not like 'erased+%@privacy.invalid';

revoke all on public.customers_unaffiliated from public, anon, authenticated;
grant select on public.customers_unaffiliated to service_role;
