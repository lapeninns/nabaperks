-- A non-throwing NULL result is still a failed heal attempt. Record it and
-- schedule candidates in tenant rounds so one merchant's poison rows cannot
-- monopolise the global batch ahead of every other tenant.

create table if not exists public.reward_cycle_heal_scheduler (
  singleton boolean primary key default true check (singleton),
  last_merchant_id uuid references public.merchants(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.reward_cycle_heal_scheduler (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.reward_cycle_heal_scheduler enable row level security;
alter table public.reward_cycle_heal_scheduler force row level security;
revoke all on table public.reward_cycle_heal_scheduler
  from public, anon, authenticated;
grant select on table public.reward_cycle_heal_scheduler to service_role;

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
  v_reward_id uuid;
  v_cursor uuid;
  v_last_merchant_id uuid;
begin
  select last_merchant_id into v_cursor
  from public.reward_cycle_heal_scheduler
  where singleton
  for update;

  for v_membership in
    with eligible as (
      select memberships.id,
             memberships.merchant_id,
             row_number() over (
               partition by memberships.merchant_id
               order by
                 (heal_failures.membership_id is not null) asc,
                 heal_failures.last_failed_at asc nulls first,
                 memberships.id
             ) as tenant_round
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
    )
    select id, merchant_id
    from eligible
    order by
      tenant_round,
      case when v_cursor is null or merchant_id > v_cursor then 0 else 1 end,
      merchant_id,
      id
    limit greatest(coalesce(p_limit, 500), 1)
  loop
    v_last_merchant_id := v_membership.merchant_id;
    perform 1
    from public.customer_memberships
    where id = v_membership.id
    for update skip locked;
    if not found then
      continue;
    end if;

    begin
      v_reward_id := public.mint_cycle_reward_if_missing(v_membership.id);
      if v_reward_id is null then
        insert into public.reward_cycle_heal_failures (
          membership_id,
          sqlstate,
          attempt_count,
          first_failed_at,
          last_failed_at
        ) values (
          v_membership.id,
          'NBS15',
          1,
          clock_timestamp(),
          clock_timestamp()
        )
        on conflict (membership_id) do update
        set sqlstate = excluded.sqlstate,
            attempt_count = reward_cycle_heal_failures.attempt_count + 1,
            last_failed_at = excluded.last_failed_at;
      else
        v_healed := v_healed + 1;
        delete from public.reward_cycle_heal_failures
        where membership_id = v_membership.id;
      end if;
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

  if v_last_merchant_id is not null then
    update public.reward_cycle_heal_scheduler
    set last_merchant_id = v_last_merchant_id,
        updated_at = clock_timestamp()
    where singleton;
  end if;

  return v_healed;
end;
$function$;

revoke all on function public.release_completed_cycles_without_reward(integer)
  from public, anon, authenticated;
grant execute on function public.release_completed_cycles_without_reward(integer)
  to service_role;

notify pgrst, 'reload schema';
