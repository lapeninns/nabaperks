-- Loyalty invitation claims say which email conflict refused them.
--
-- private.claim_loyalty_invite_legacy_v1 answers 'email_conflict' in two
-- different situations:
--
--  * the wallet already holds a verified email that is not the invited one;
--  * the wallet holds no verified email, but another wallet already holds the
--    invited address (checked up front, or a concurrent bind that hit the
--    verified-email unique index).
--
-- The app showed one sentence for both ("sent to a different email than your
-- account uses"), which is wrong for a wallet with no email at all (QA
-- BUG-048, 38c42a1..2c45031). The public wrapper now adds conflict_reason:
-- 'wallet_email_differs' or 'email_held_elsewhere', read from the wallet in the
-- same transaction. Every other column and status is unchanged, so the
-- deployed app, which reads only status and membership_id, keeps working. The
-- private body is not touched.
--
-- Adding an output column needs drop and create (create or replace cannot
-- change a function's result type). Security definer, search_path and grants
-- are those of the wrapper in 20260924100000_open_next_cycle_on_completion.sql.
-- Forward-only and re-runnable.

drop function if exists public.claim_loyalty_invite(uuid,text,text,boolean,text,text);

create function public.claim_loyalty_invite(
  p_customer_id uuid, p_claim_token_hash text, p_policy_version text,
  p_marketing_opt_in boolean, p_verified_email text, p_verified_email_hmac text
)
returns table (
  status text,
  membership_id uuid,
  stamps_awarded integer,
  conflict_reason text
)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare v_result record;
begin
  select * into v_result from private.claim_loyalty_invite_legacy_v1(
    p_customer_id, p_claim_token_hash, p_policy_version, p_marketing_opt_in,
    p_verified_email, p_verified_email_hmac
  );
  if v_result.membership_id is not null then
    perform private.complete_cycle_if_full(v_result.membership_id, 'loyalty_invite', '{}');
  end if;
  status := v_result.status; membership_id := v_result.membership_id;
  stamps_awarded := v_result.stamps_awarded; conflict_reason := null;

  if v_result.status = 'email_conflict' then
    select case
             when cu.email_verified_at is not null
              and cu.email_hmac is not null
              and cu.email_hmac is distinct from p_verified_email_hmac
               then 'wallet_email_differs'
             else 'email_held_elsewhere'
           end
    into conflict_reason
    from public.customers cu
    where cu.id = p_customer_id;
  end if;

  return next;
end;
$function$;

revoke all on function public.claim_loyalty_invite(uuid,text,text,boolean,text,text)
  from public, anon, authenticated;
grant execute on function public.claim_loyalty_invite(uuid,text,text,boolean,text,text)
  to service_role;

comment on function public.claim_loyalty_invite(uuid,text,text,boolean,text,text) is
  'Claims a two-stamp loyalty invitation. On email_conflict, conflict_reason is wallet_email_differs (the wallet holds another verified email) or email_held_elsewhere (another wallet holds the invited address). Service role only.';

notify pgrst, 'reload schema';
