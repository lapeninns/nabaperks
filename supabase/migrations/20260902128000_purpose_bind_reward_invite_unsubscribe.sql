-- Current claim capabilities must never mutate email-consent state. Historical
-- claim-only links have no durable row marker and their former public query
-- route is no longer active, so accepting every claim hash as an unsubscribe
-- capability would silently weaken every newly issued purpose-separated link.

create or replace function public.suppress_reward_invite_email_by_token(
  p_unsubscribe_token_hash text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_invite record;
  v_email_hmac text;
begin
  if p_unsubscribe_token_hash is null or btrim(p_unsubscribe_token_hash) = '' then
    return false;
  end if;

  select merchant_id, email_hmac, attached_customer_id
  into v_invite
  from public.pending_reward_invites
  where unsubscribe_token_hash = p_unsubscribe_token_hash;

  if v_invite is null then return false; end if;

  v_email_hmac := v_invite.email_hmac;
  if v_email_hmac is null and v_invite.attached_customer_id is not null then
    select email_hmac into v_email_hmac
    from public.customers
    where id = v_invite.attached_customer_id;
  end if;

  if v_email_hmac is null then return false; end if;

  perform public.suppress_reward_invite_email(
    v_invite.merchant_id, v_email_hmac, 'unsubscribed');
  return true;
end;
$function$;

revoke all on function public.suppress_reward_invite_email_by_token(text)
  from public, anon, authenticated;
grant execute on function public.suppress_reward_invite_email_by_token(text)
  to service_role;

notify pgrst, 'reload schema';
