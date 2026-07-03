-- Issued rewards, phase 2: automatic birthday-month issuance.
--
-- `issue_birthday_rewards(p_now, p_customer_id)` mints one birthday reward per
-- eligible member for the current London month. Set-based INSERT…SELECT (one
-- lateral pick of the oldest active birthday-enabled card per merchant, mirroring
-- issue_self_service_stamp's oldest-active-card rule) guarded by an anti-join +
-- the partial unique index, so a re-run or a race issues nothing. Per inserted
-- row it records a `reward_issued` product event and enqueues the marketing
-- `birthday_reward_issued` push — following the expire-sweep's FOR-over-RETURNING
-- precedent. SECURITY DEFINER, service_role only (cron + issuance hooks).
--
-- Eligibility (all must hold): stored DOB in the current London month, member is
-- 18+ (defence in depth), merchant trial/active with billing satisfied
-- (loyalty_availability_reason set-based), a visit within 12 months (so a yearly
-- auto-issue never re-arms admin_purge_stale_customer_pii), and no birthday
-- reward yet for (merchant, customer, this year) across any status.

create or replace function public.issue_birthday_rewards(
  p_now timestamptz default now(),
  p_customer_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_row record;
  v_count integer := 0;
  v_year integer := extract(year from (p_now at time zone 'Europe/London'))::int;
  v_month integer := extract(month from (p_now at time zone 'Europe/London'))::int;
  -- First instant of the next London month (explicit, so the reward-event expiry
  -- snapshot trigger stays inert).
  v_expires_at timestamptz :=
    (date_trunc('month', (p_now at time zone 'Europe/London')) + interval '1 month')
      at time zone 'Europe/London';
  v_business_name text;
begin
  for v_row in
    insert into public.reward_events (
      merchant_id,
      customer_id,
      membership_id,
      loyalty_card_id,
      status,
      source,
      birthday_year,
      reward_name,
      reward_terms,
      redeemable_from,
      expires_at,
      cycle_number,
      metadata,
      created_at,
      updated_at
    )
    select
      m.merchant_id,
      m.customer_id,
      m.id,
      card.id,
      'unlocked',
      'birthday_month',
      v_year,
      card.birthday_reward_name,
      card.birthday_reward_terms,
      public.uk_business_date(p_now),
      v_expires_at,
      null,
      jsonb_build_object('issued_by', 'birthday_sweep'),
      p_now,
      p_now
    from public.customer_memberships m
    join public.customers c on c.id = m.customer_id
    join public.merchants mer on mer.id = m.merchant_id
    left join public.billing_customers bc on bc.merchant_id = m.merchant_id
    join lateral (
      select lc.id, lc.birthday_reward_name, lc.birthday_reward_terms
      from public.loyalty_cards lc
      where lc.merchant_id = m.merchant_id
        and lc.is_active
        and lc.birthday_reward_enabled
        and lc.birthday_reward_name is not null
        and lc.birthday_reward_terms is not null
      order by lc.created_at asc
      limit 1
    ) card on true
    where
      (p_customer_id is null or m.customer_id = p_customer_id)
      and c.date_of_birth is not null
      and extract(month from c.date_of_birth)::int = v_month
      and c.date_of_birth <= (public.uk_business_date(p_now) - interval '18 years')::date
      and public.loyalty_availability_reason(mer.status, true, bc.status, mer.requires_billing) is null
      and m.last_visit_at is not null
      and m.last_visit_at >= p_now - interval '12 months'
      and not exists (
        select 1
        from public.reward_events re
        where re.merchant_id = m.merchant_id
          and re.customer_id = m.customer_id
          and re.source = 'birthday_month'
          and re.birthday_year = v_year
      )
    on conflict (merchant_id, customer_id, birthday_year) where source = 'birthday_month'
      do nothing
    returning id, merchant_id, customer_id, membership_id, reward_name
  loop
    v_count := v_count + 1;

    select merchants.business_name
    into v_business_name
    from public.merchants
    where merchants.id = v_row.merchant_id;

    insert into public.product_events (
      event_name, merchant_id, customer_id, membership_id, actor_type, actor_id, metadata
    )
    values (
      'reward_issued',
      v_row.merchant_id,
      v_row.customer_id,
      v_row.membership_id,
      'system',
      'birthday_sweep',
      jsonb_build_object(
        'reward_id', v_row.id,
        'reward_name', v_row.reward_name,
        'source', 'birthday_month',
        'birthday_year', v_year
      )
    );

    perform public.enqueue_notification_event(
      'birthday_reward_issued',
      v_row.customer_id,
      v_row.merchant_id,
      v_row.membership_id,
      v_row.id,
      null,
      public.uk_business_date(p_now),
      p_now,
      'birthday_reward_issued:' || v_row.id::text,
      jsonb_build_object(
        'title', 'Birthday treat',
        'body', v_row.reward_name || ' at ' || coalesce(v_business_name, 'your venue'),
        'url', '/home/rewards',
        'rewardEventId', v_row.id
      ),
      jsonb_build_object('source', 'birthday_sweep')
    );
  end loop;

  return v_count;
end;
$$;

revoke all on function public.issue_birthday_rewards(timestamptz, uuid) from public;
grant execute on function public.issue_birthday_rewards(timestamptz, uuid) to service_role;

notify pgrst, 'reload schema';
