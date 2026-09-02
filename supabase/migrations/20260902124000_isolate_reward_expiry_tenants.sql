-- A billing-ineligible membership must not abort the cross-tenant expiry batch.
-- Record at most one sanitised failure row per membership and continue.

create table if not exists public.reward_cycle_heal_failures (
  membership_id uuid primary key
    references public.customer_memberships(id) on delete cascade,
  sqlstate text not null,
  attempt_count integer not null default 1 check (attempt_count > 0),
  first_failed_at timestamptz not null default now(),
  last_failed_at timestamptz not null default now()
);

alter table public.reward_cycle_heal_failures enable row level security;
revoke all on table public.reward_cycle_heal_failures
  from public, anon, authenticated;
grant select on table public.reward_cycle_heal_failures to service_role;

create or replace function public.release_completed_cycles_without_reward(
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $function$
declare
  v_membership record;
  v_healed integer := 0;
begin
  for v_membership in
    select memberships.id
    from public.customer_memberships memberships
    join public.loyalty_cards cards
      on cards.merchant_id = memberships.merchant_id and cards.is_active
    join public.merchants merchants
      on merchants.id = memberships.merchant_id
    left join public.billing_customers billing
      on billing.merchant_id = memberships.merchant_id
    left join public.reward_cycle_heal_failures heal_failures
      on heal_failures.membership_id = memberships.id
    where memberships.current_stamp_count >= cards.stamps_required
      and public.loyalty_billing_entitled(
        merchants.requires_billing,
        billing.status
      )
      and (
        heal_failures.membership_id is null
        or heal_failures.last_failed_at <= clock_timestamp() - interval '15 minutes'
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.membership_id = memberships.id
          and reward_events.cycle_number = memberships.active_cycle_number
          and reward_events.source = 'stamp_cycle'
      )
    order by
      (heal_failures.membership_id is not null) asc,
      heal_failures.last_failed_at asc nulls first,
      memberships.id
    limit greatest(coalesce(p_limit, 500), 1)
    for update of memberships skip locked
  loop
    begin
      if public.mint_cycle_reward_if_missing(v_membership.id) is not null then
        v_healed := v_healed + 1;
      end if;

      delete from public.reward_cycle_heal_failures
      where membership_id = v_membership.id;
    exception
      when others then
        insert into public.reward_cycle_heal_failures (
          membership_id,
          sqlstate,
          attempt_count,
          first_failed_at,
          last_failed_at
        ) values (
          v_membership.id,
          sqlstate,
          1,
          clock_timestamp(),
          clock_timestamp()
        )
        on conflict (membership_id) do update
        set sqlstate = excluded.sqlstate,
            attempt_count = reward_cycle_heal_failures.attempt_count + 1,
            last_failed_at = excluded.last_failed_at;
    end;
  end loop;

  return v_healed;
end;
$function$;

revoke all on function public.release_completed_cycles_without_reward(integer)
  from public, anon, authenticated;
grant execute on function public.release_completed_cycles_without_reward(integer)
  to service_role;

notify pgrst, 'reload schema';
