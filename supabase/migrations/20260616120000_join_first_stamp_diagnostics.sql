-- Operator diagnostics for the join-with-first-stamp wrapper.
--
-- The wrapper swallows a failed first stamp into first_stamp_issued=false so a
-- misconfigured card never breaks onboarding (the member still lands on a card).
-- Previously the swallowed reason was invisible, so a paused-merchant block, a
-- reward-pool misconfiguration, and a transient error all looked identical from
-- the `firststamp=pending` card. This redefinition keeps the exact same control
-- flow and table output but raises a WARNING carrying SQLERRM, so operators can
-- tell those cases apart in the Postgres logs. Behaviour is otherwise unchanged.
--
-- Idempotent (create or replace) per the repo's re-apply-every-run migrations.

create or replace function public.join_customer_membership_with_first_stamp(
  p_customer_id uuid,
  p_merchant_slug text,
  p_qr_id text,
  p_marketing_opt_in boolean,
  p_policy_version text,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns table (
  membership_id uuid,
  created_membership boolean,
  first_stamp_issued boolean,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  -- Reuse the existing join verbatim (raises if the card is unavailable).
  select j.membership_id, j.created_membership
  into membership_id, created_membership
  from public.join_customer_membership(
    p_customer_id,
    p_merchant_slug,
    p_qr_id,
    p_marketing_opt_in,
    p_policy_version
  ) j;

  first_stamp_issued := false;
  new_stamp_count := 0;
  reward_unlocked := false;
  geo_flagged := false;

  -- QR joins only: a fresh member who scanned the venue QR earns stamp #1 now.
  if created_membership and p_qr_id is not null and p_qr_id <> '' then
    begin
      select s.new_stamp_count, s.reward_unlocked, s.geo_flagged
      into new_stamp_count, reward_unlocked, geo_flagged
      from public.issue_self_service_stamp(
        membership_id,
        p_customer_id,
        p_latitude,
        p_longitude
      ) s;

      first_stamp_issued := true;
    exception
      when others then
        -- Keep the membership; the customer lands on a 0-stamp card and can
        -- stamp from the venue QR on their next visit. Surface the swallowed
        -- reason to the Postgres log so operators can distinguish a programme
        -- pause / reward-pool misconfiguration from a transient failure behind
        -- the `firststamp=pending` card.
        raise warning 'join first stamp skipped for membership % (customer %): %',
          membership_id, p_customer_id, sqlerrm;
        first_stamp_issued := false;
        new_stamp_count := 0;
        reward_unlocked := false;
        geo_flagged := false;
    end;
  end if;

  return next;
end;
$$;

revoke all on function public.join_customer_membership_with_first_stamp(
  uuid, text, text, boolean, text, numeric, numeric
) from public;

grant execute on function public.join_customer_membership_with_first_stamp(
  uuid, text, text, boolean, text, numeric, numeric
) to authenticated, service_role;
