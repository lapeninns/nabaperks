create table if not exists public.customer_join_stamp_recoveries (
  membership_id uuid primary key references public.customer_memberships(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  qr_id text not null,
  reason text not null check (
    reason in ('invalid_qr', 'billing_unavailable', 'reward_pool_unavailable', 'transient')
  ),
  resolution text not null check (resolution in ('rescan', 'retry', 'venue_action')),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'expired')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  failed_at timestamptz not null default now(),
  last_attempt_at timestamptz not null default now(),
  retry_until timestamptz,
  resolved_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint customer_join_stamp_recovery_retry_shape check (
    (resolution = 'retry' and retry_until is not null)
    or (resolution <> 'retry' and retry_until is null)
  )
);

create index if not exists customer_join_stamp_recoveries_customer_pending_idx
  on public.customer_join_stamp_recoveries (customer_id, status, failed_at desc);

alter table public.customer_join_stamp_recoveries enable row level security;
revoke all on table public.customer_join_stamp_recoveries from public, anon, authenticated;
grant select, insert, update, delete on table public.customer_join_stamp_recoveries to service_role;

create or replace function public.resolve_customer_join_stamp_recovery()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_type = 'earned' then
    update public.customer_join_stamp_recoveries
    set status = 'resolved',
        resolved_at = coalesce(resolved_at, now()),
        updated_at = now()
    where membership_id = new.membership_id
      and status = 'pending';
  end if;
  return new;
end;
$$;

revoke all on function public.resolve_customer_join_stamp_recovery() from public, anon, authenticated;
grant execute on function public.resolve_customer_join_stamp_recovery() to service_role;

drop trigger if exists resolve_customer_join_stamp_recovery_after_stamp on public.stamp_events;
create trigger resolve_customer_join_stamp_recovery_after_stamp
after insert on public.stamp_events
for each row execute function public.resolve_customer_join_stamp_recovery();

drop function if exists public.join_customer_membership_with_first_stamp(
  uuid, text, text, boolean, text, numeric, numeric, text
);

create function public.join_customer_membership_with_first_stamp(
  p_customer_id uuid,
  p_merchant_slug text,
  p_qr_id text,
  p_marketing_opt_in boolean,
  p_policy_version text,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_ref text default null
)
returns table (
  membership_id uuid,
  merchant_id uuid,
  created_membership boolean,
  first_stamp_issued boolean,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean,
  first_stamp_reason text,
  first_stamp_resolution text
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_error_message text;
  v_reason text;
  v_resolution text;
  v_retry_until timestamptz;
begin
  select joined.membership_id, joined.created_membership
  into membership_id, created_membership
  from public.join_customer_membership(
    p_customer_id,
    p_merchant_slug,
    p_qr_id,
    p_marketing_opt_in,
    p_policy_version
  ) joined;

  select memberships.merchant_id
  into merchant_id
  from public.customer_memberships memberships
  where memberships.id = membership_id;

  first_stamp_issued := false;
  new_stamp_count := 0;
  reward_unlocked := false;
  geo_flagged := false;
  first_stamp_reason := null;
  first_stamp_resolution := null;

  if created_membership and p_ref is not null and btrim(p_ref) <> '' then
    insert into public.referrals (
      referred_membership_id,
      referrer_membership_id,
      referral_code_used
    )
    select new_member.id, referrer.id, referrer.referral_code
    from public.customer_memberships new_member
    join public.customer_memberships referrer
      on referrer.referral_code = btrim(p_ref)
     and referrer.referral_code_active
     and referrer.referral_code_admin_disabled_at is null
     and referrer.merchant_id = new_member.merchant_id
     and referrer.customer_id <> new_member.customer_id
    where new_member.id = membership_id
    on conflict (referred_membership_id) do nothing;
  end if;

  if created_membership and p_qr_id is not null and btrim(p_qr_id) <> '' then
    begin
      select stamp.new_stamp_count, stamp.reward_unlocked, stamp.geo_flagged
      into new_stamp_count, reward_unlocked, geo_flagged
      from public.issue_self_service_stamp(
        membership_id,
        p_customer_id,
        p_qr_id,
        p_latitude,
        p_longitude
      ) stamp;

      first_stamp_issued := true;
    exception
      when others then
        get stacked diagnostics v_error_message = message_text;

        if v_error_message ilike '%already issued for this UK business day%'
          and exists (
            select 1
            from public.stamp_events events
            where events.membership_id = join_customer_membership_with_first_stamp.membership_id
              and events.event_type = 'earned'
              and events.earned_business_date = public.uk_business_date(now())
          ) then
          first_stamp_issued := true;
          select memberships.current_stamp_count
          into new_stamp_count
          from public.customer_memberships memberships
          where memberships.id = membership_id;
        else
          if v_error_message ilike '%QR scan proof%' then
            v_reason := 'invalid_qr';
            v_resolution := 'rescan';
            v_retry_until := null;
          elsif v_error_message ilike '%reward pool%' then
            v_reason := 'reward_pool_unavailable';
            v_resolution := 'venue_action';
            v_retry_until := null;
          elsif v_error_message ilike '%loyalty programme%'
             or v_error_message ilike '%loyalty card is not active%'
             or v_error_message ilike '%reward is already ready%' then
            v_reason := 'billing_unavailable';
            v_resolution := 'venue_action';
            v_retry_until := null;
          else
            v_reason := 'transient';
            v_resolution := 'retry';
            v_retry_until := now() + interval '10 minutes';
          end if;

          insert into public.customer_join_stamp_recoveries (
            membership_id,
            customer_id,
            merchant_id,
            qr_id,
            reason,
            resolution,
            retry_until
          ) values (
            join_customer_membership_with_first_stamp.membership_id,
            p_customer_id,
            join_customer_membership_with_first_stamp.merchant_id,
            btrim(p_qr_id),
            v_reason,
            v_resolution,
            v_retry_until
          )
          on conflict on constraint customer_join_stamp_recoveries_pkey do update
          set reason = excluded.reason,
              resolution = excluded.resolution,
              status = 'pending',
              attempt_count = public.customer_join_stamp_recoveries.attempt_count + 1,
              last_attempt_at = now(),
              retry_until = excluded.retry_until,
              resolved_at = null,
              updated_at = now();

          first_stamp_reason := v_reason;
          first_stamp_resolution := v_resolution;
        end if;

        first_stamp_issued := coalesce(first_stamp_issued, false);
        reward_unlocked := false;
        geo_flagged := false;
    end;
  end if;

  return next;
end;
$$;

revoke all on function public.join_customer_membership_with_first_stamp(
  uuid, text, text, boolean, text, numeric, numeric, text
) from public, anon, authenticated;
grant execute on function public.join_customer_membership_with_first_stamp(
  uuid, text, text, boolean, text, numeric, numeric, text
) to service_role;

create or replace function public.retry_customer_join_first_stamp(
  p_membership_id uuid,
  p_customer_id uuid
)
returns table (
  outcome text,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  recovery public.customer_join_stamp_recoveries%rowtype;
  v_error_message text;
  v_reason text;
  v_resolution text;
begin
  outcome := 'not_found';
  new_stamp_count := 0;
  reward_unlocked := false;
  geo_flagged := false;

  select records.*
  into recovery
  from public.customer_join_stamp_recoveries records
  where records.membership_id = p_membership_id
    and records.customer_id = p_customer_id
    and records.status = 'pending'
  for update;

  if not found then
    return next;
    return;
  end if;

  if recovery.resolution = 'rescan' then
    outcome := 'rescan_required';
    return next;
    return;
  end if;

  if recovery.resolution = 'venue_action' then
    outcome := 'venue_action_required';
    return next;
    return;
  end if;

  if recovery.retry_until <= now() then
    update public.customer_join_stamp_recoveries
    set status = 'expired',
        updated_at = now()
    where membership_id = p_membership_id;
    outcome := 'expired';
    return next;
    return;
  end if;

  update public.customer_join_stamp_recoveries
  set attempt_count = attempt_count + 1,
      last_attempt_at = now(),
      updated_at = now()
  where membership_id = p_membership_id;

  begin
    select stamp.new_stamp_count, stamp.reward_unlocked, stamp.geo_flagged
    into new_stamp_count, reward_unlocked, geo_flagged
    from public.issue_self_service_stamp(
      p_membership_id,
      p_customer_id,
      recovery.qr_id,
      null,
      null
    ) stamp;

    update public.customer_join_stamp_recoveries
    set status = 'resolved',
        resolved_at = coalesce(resolved_at, now()),
        updated_at = now()
    where membership_id = p_membership_id;
    outcome := 'issued';
  exception
    when others then
      get stacked diagnostics v_error_message = message_text;

      if v_error_message ilike '%already issued for this UK business day%'
        and exists (
          select 1
          from public.stamp_events events
          where events.membership_id = p_membership_id
            and events.event_type = 'earned'
            and events.earned_business_date = public.uk_business_date(now())
        ) then
        update public.customer_join_stamp_recoveries
        set status = 'resolved',
            resolved_at = coalesce(resolved_at, now()),
            updated_at = now()
        where membership_id = p_membership_id;
        select memberships.current_stamp_count
        into new_stamp_count
        from public.customer_memberships memberships
        where memberships.id = p_membership_id;
        outcome := 'already_issued';
      else
        if v_error_message ilike '%QR scan proof%' then
          v_reason := 'invalid_qr';
          v_resolution := 'rescan';
        elsif v_error_message ilike '%reward pool%' then
          v_reason := 'reward_pool_unavailable';
          v_resolution := 'venue_action';
        elsif v_error_message ilike '%loyalty programme%'
           or v_error_message ilike '%loyalty card is not active%'
           or v_error_message ilike '%reward is already ready%' then
          v_reason := 'billing_unavailable';
          v_resolution := 'venue_action';
        else
          v_reason := 'transient';
          v_resolution := 'retry';
        end if;

        update public.customer_join_stamp_recoveries
        set reason = v_reason,
            resolution = v_resolution,
            retry_until = case
              when v_resolution = 'retry' then retry_until
              else null
            end,
            updated_at = now()
        where membership_id = p_membership_id;
        outcome := case v_resolution
          when 'rescan' then 'rescan_required'
          when 'venue_action' then 'venue_action_required'
          else 'pending'
        end;
      end if;
  end;

  return next;
end;
$$;

revoke all on function public.retry_customer_join_first_stamp(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.retry_customer_join_first_stamp(uuid, uuid)
  to service_role;
