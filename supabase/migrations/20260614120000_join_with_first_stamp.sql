-- Join + first stamp in one atomic onboarding step.
--
-- Brand-new members used to join and then be bounced to a separate stamp screen
-- to tap a second time for stamp #1. This wrapper composes the two existing,
-- already-hardened RPCs so finishing onboarding grants the first stamp in the
-- same call:
--   * join_customer_membership  — resolves QR -> merchant/card, inserts the
--     membership, records consent + the customer_joined product event.
--   * issue_self_service_stamp  — issues one daily stamp with every guard
--     (ownership, billing, one-per-UK-business-day, geofence flagging, reward
--     pool) and returns the new count / reward-unlock / geo-flag.
--
-- The first stamp is only attempted for a freshly created membership joined via
-- a venue QR (customer is physically at the counter), and it runs inside an
-- exception-guarded sub-block so a misconfigured card can never break the join:
-- the membership always persists, we just land on a 0-stamp card.
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
        -- stamp from the venue QR on their next visit.
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
