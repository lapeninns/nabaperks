-- Join-time marketing consent is recorded only for channels the customer holds.
--
-- 20260927100100_phone_marketing_consent.sql made an opted-in join record SMS
-- and WhatsApp opt-in rows for every customer. A wallet created by email has no
-- phone, so it would carry phone-channel consent evidence for a number that
-- does not exist. SMS and WhatsApp rows are now written only when the customer
-- has a phone (`phone_hmac is not null`); the email row keeps its existing
-- condition. Explicit opt-outs and the replay guard are unchanged.
--
-- Patched in place with the same exact-fragment check as the migration above;
-- stops for review if the fragment has changed, and is re-runnable.

do $migration$
declare
  v_definition text;
  v_old text := $old$    from (values ('email'), ('sms'), ('whatsapp')) phone_consent(channel)
    where (phone_consent.channel <> 'email' or customer_record.email is not null)
      and not public.join_consent_already_granted($old$;
  v_new text := $new$    from (values ('email'), ('sms'), ('whatsapp')) phone_consent(channel)
    where (
        (phone_consent.channel = 'email' and customer_record.email is not null)
        or (phone_consent.channel <> 'email' and customer_record.phone_hmac is not null)
      )
      and not public.join_consent_already_granted($new$;
begin
  select pg_get_functiondef('public.join_customer_membership(uuid,text,text,boolean,text)'::regprocedure)
    into v_definition;
  if position(v_new in v_definition) > 0 then return; end if;
  if position(v_old in v_definition) = 0 then
    raise exception 'join_customer_membership consent insertion changed; review join consent phone migration';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$migration$;

revoke all on function public.join_customer_membership(uuid, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.join_customer_membership(uuid, text, text, boolean, text)
  to service_role;

notify pgrst, 'reload schema';
