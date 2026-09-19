-- Phone marketing consent resolution and join-time channel evidence.
--
-- WHAT CHANGES
--   1. Resolves latest explicit SMS/WhatsApp decisions with legacy inheritance.
--   2. Records both SMS and WhatsApp opt-in rows on an opted-in customer join.
--
-- Forward-only and re-runnable. Explicit opt-out remains authoritative and
-- phone marketing does not inherit the browser-push marketing preference.

create index if not exists consent_records_phone_latest_idx
  on public.consent_records (customer_id, merchant_id, channel, created_at desc)
  where channel in ('whatsapp', 'sms');

create or replace function public.customer_phone_marketing_consent(
  p_customer_id uuid, p_merchant_id uuid
) returns table (channel text, opted_in boolean, source text, policy_version text)
language sql stable security definer set search_path = public, auth as $$
  with latest as (
    select distinct on (c.channel) c.channel, c.consent_status, c.source, c.policy_version
    from public.consent_records c
    where c.customer_id = p_customer_id and c.merchant_id = p_merchant_id
      and c.channel in ('whatsapp', 'sms')
    order by c.channel, c.created_at desc, (c.consent_status = 'opted_out') desc, c.id desc
  )
  select requested.channel,
    coalesce(coalesce(direct.consent_status, inherited.consent_status) = 'opted_in', false),
    coalesce(direct.source, inherited.source), coalesce(direct.policy_version, inherited.policy_version)
  from (values ('whatsapp'), ('sms')) requested(channel)
  left join latest direct on direct.channel = requested.channel
  left join latest inherited on inherited.channel <> requested.channel;
$$;
revoke all on function public.customer_phone_marketing_consent(uuid, uuid) from public, anon, authenticated;
grant execute on function public.customer_phone_marketing_consent(uuid, uuid) to service_role;

do $migration$
declare
  v_definition text;
  v_old text := $old$      case when customer_record.email is not null then 'email' else 'sms' end,
      'opted_in',
      'customer_join',
      btrim(p_policy_version),
      jsonb_build_object('qr_code_id', v_qr_code_uuid)
    where not public.join_consent_already_granted(
      v_merchant_id,
      p_customer_id,
      case when customer_record.email is not null then 'email' else 'sms' end,
      btrim(p_policy_version)
    );$old$;
  v_new text := $new$      phone_consent.channel,
      'opted_in',
      'customer_join',
      btrim(p_policy_version),
      jsonb_build_object('qr_code_id', v_qr_code_uuid)
    from (values ('email'), ('sms'), ('whatsapp')) phone_consent(channel)
    where (phone_consent.channel <> 'email' or customer_record.email is not null)
      and not public.join_consent_already_granted(
        v_merchant_id, p_customer_id, phone_consent.channel, btrim(p_policy_version)
      );$new$;
begin
  select pg_get_functiondef('public.join_customer_membership(uuid,text,text,boolean,text)'::regprocedure)
    into v_definition;
  if position(v_new in v_definition) > 0 then return; end if;
  if position(v_old in v_definition) = 0 then
    raise exception 'join_customer_membership consent insertion changed; review phone consent migration';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$migration$;

notify pgrst, 'reload schema';
