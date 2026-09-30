-- Join-time marketing consent is recorded only for contacts the customer has
-- verified (QA BUG-033 and BUG-034, 38c42a1..2c45031).
--
-- 20261006100300 wrote the SMS and WhatsApp rows when the wallet held a phone
-- (`phone_hmac is not null`) and the email row when it held an address
-- (`email is not null`). A wallet can hold either contact unverified: a phone
-- staged by the add-phone sequence or a legacy row, and an email saved on the
-- profile but never confirmed. The join then stored opt-in evidence for a
-- contact the customer never proved. Everywhere else (profile, completion,
-- the reward gate, message sending) an unverified contact counts as absent.
--
-- WHAT CHANGES
--   * The email row needs `email_verified_at is not null`.
--   * The SMS and WhatsApp rows need `phone_hmac is not null and
--     phone_verified_at is not null`.
--   Only that predicate in public.join_customer_membership changes. Explicit
--   opt-outs, the replay guard, the terms evidence and the function's
--   signature, owner, security and search_path are unchanged.
--
-- COMPATIBILITY
--   The deployed app (2c45031c) calls the function with the same arguments
--   and reads the same result. A join by a wallet with only unverified
--   contacts simply records fewer opt-in rows.
--
-- Patched in place with the same exact-fragment check as 20261006100300;
-- stops for review if the fragment has changed, and is re-runnable.

do $migration$
declare
  v_definition text;
  v_old text := $old$    where (
        (phone_consent.channel = 'email' and customer_record.email is not null)
        or (phone_consent.channel <> 'email' and customer_record.phone_hmac is not null)
      )
      and not public.join_consent_already_granted($old$;
  v_new text := $new$    where (
        (
          phone_consent.channel = 'email'
          and customer_record.email is not null
          and customer_record.email_verified_at is not null
        )
        or (
          phone_consent.channel <> 'email'
          and customer_record.phone_hmac is not null
          and customer_record.phone_verified_at is not null
        )
      )
      and not public.join_consent_already_granted($new$;
begin
  select pg_get_functiondef('public.join_customer_membership(uuid,text,text,boolean,text)'::regprocedure)
    into v_definition;
  if position(v_new in v_definition) > 0 then return; end if;
  if position(v_old in v_definition) = 0 then
    raise exception 'join_customer_membership consent insertion changed; review join consent verified-contact migration';
  end if;
  execute replace(v_definition, v_old, v_new);
end;
$migration$;

revoke all on function public.join_customer_membership(uuid, text, text, boolean, text)
  from public, anon, authenticated;
grant execute on function public.join_customer_membership(uuid, text, text, boolean, text)
  to service_role;

notify pgrst, 'reload schema';
