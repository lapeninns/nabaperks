-- QA BUG-045 (38c42a1..2c45031): an owner opening another venue's reward code
-- was refused exactly like a code that does not exist, so the staff page said
-- the code had "gone cold" instead of "belongs to another venue".
--
-- The refusal keeps its SQLSTATE (42501) and message, so the deployed app
-- (which maps 42501 to not-found) and every collect RPC that calls this helper
-- behave as before. Only a token that exists under a merchant this owner does
-- not own adds the machine-readable hint 'reward_scan_other_merchant'. A
-- nonexistent token keeps the plain refusal. The hint reveals only that an
-- unguessable token exists elsewhere; no reward, member or venue field is
-- returned.
create or replace function private.reward_scan_owner_merchant(p_scan_token uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_merchant_id uuid;
begin
  if auth.uid() is null or auth.role() is distinct from 'authenticated' then
    raise insufficient_privilege using message = 'Merchant owner access required';
  end if;
  select m.id into v_merchant_id
  from public.reward_scan_tokens t
  join public.merchants m on m.id = t.merchant_id
  where t.id = p_scan_token and m.owner_user_id = auth.uid();
  if v_merchant_id is null then
    if exists (
      select 1 from public.reward_scan_tokens t where t.id = p_scan_token
    ) then
      raise insufficient_privilege using
        message = 'Reward not available to this merchant',
        hint = 'reward_scan_other_merchant';
    end if;
    raise insufficient_privilege using message = 'Reward not available to this merchant';
  end if;
  return v_merchant_id;
end;
$function$;

revoke all on function private.reward_scan_owner_merchant(uuid)
  from public, anon, authenticated, service_role;
