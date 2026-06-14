-- Clear today's earned stamps so customers can scan again the same UK business day.
-- Membership counts and any rewards unlocked by those stamps are rolled back.

begin;

with removed as (
  delete from public.stamp_events
  where event_type = 'earned'
    and earned_business_date = public.uk_business_date(now())
  returning id, membership_id, merchant_id, customer_id, stamps_delta, created_at
),
aggregated as (
  select membership_id, sum(stamps_delta) as removed_stamps
  from removed
  group by membership_id
),
updated_memberships as (
  update public.customer_memberships cm
  set
    current_stamp_count = greatest(0, cm.current_stamp_count - a.removed_stamps),
    total_stamps_earned = greatest(0, cm.total_stamps_earned - a.removed_stamps),
    last_visit_at = case
      when cm.current_stamp_count - a.removed_stamps <= 0 then null
      else cm.last_visit_at
    end,
    updated_at = now()
  from aggregated a
  where cm.id = a.membership_id
  returning cm.id as membership_id, cm.current_stamp_count
)
delete from public.reward_events re
using updated_memberships um
where re.membership_id = um.membership_id
  and re.status = 'unlocked'
  and um.current_stamp_count = 0;

do $$
begin
  if to_regclass('public.verification_tokens') is not null then
    delete from public.verification_tokens
    where consumed_at is null
      and cancelled_at is null
      and expires_at > now()
      and kind = 'stamp';
  end if;
end $$;

truncate table public.rate_limit_buckets;

commit;
