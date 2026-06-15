-- Customer-managed marketing consent from the /home profile.
--
-- Consent is recorded per merchant (append-only) at join time. The profile lets a
-- customer set a *global* channel preference (Email / SMS / WhatsApp) that applies
-- across every venue they belong to: one call writes one consent_records row per
-- membership, so the per-merchant audit trail stays intact and the latest row per
-- channel reflects the customer's standing wish.
--
-- The server resolves the customer from the trusted first-party session and calls
-- this via the service-role client, so there is no auth.uid ownership check here —
-- the caller is already trusted. Inputs are still validated defensively, mirroring
-- admin_record_consent_opt_out.
--
-- Idempotent: create or replace + grant are safe to re-apply on every db:migrate.

create or replace function public.record_customer_marketing_consent(
  p_customer_id uuid,
  p_channel text,
  p_consent_status text,
  p_policy_version text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_membership record;
begin
  if p_customer_id is null then
    raise exception 'Customer is required';
  end if;

  if p_channel not in ('email', 'sms', 'whatsapp') then
    raise exception 'Unsupported consent channel';
  end if;

  if p_consent_status not in ('opted_in', 'opted_out') then
    raise exception 'Unsupported consent status';
  end if;

  if length(trim(coalesce(p_policy_version, ''))) < 4 then
    raise exception 'Policy version is required';
  end if;

  -- One append-only record per membership keeps each merchant's consent trail
  -- complete while presenting the customer a single global toggle per channel.
  for v_membership in
    select merchant_id
    from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
  loop
    insert into public.consent_records (
      merchant_id,
      customer_id,
      channel,
      consent_status,
      source,
      policy_version,
      metadata
    )
    values (
      v_membership.merchant_id,
      p_customer_id,
      p_channel,
      p_consent_status,
      'customer_profile',
      trim(p_policy_version),
      jsonb_build_object('scope', 'all_memberships')
    );
  end loop;
end;
$$;

grant execute on function public.record_customer_marketing_consent(uuid, text, text, text)
  to service_role;
