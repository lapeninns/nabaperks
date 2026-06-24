create or replace function public.is_allowed_web_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
as $$
  with normalized as (
    select trim(coalesce(p_endpoint, '')) as endpoint
  ),
  parsed as (
    select
      endpoint,
      lower(substring(endpoint from '^https://([^/?#]+)')) as host
    from normalized
  )
  select
    length(endpoint) between 20 and 2048
    and endpoint like 'https://%'
    and position('#' in endpoint) = 0
    and (
      host in (
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'web.push.apple.com'
      )
      or host like '%.notify.windows.com'
    )
  from parsed;
$$;

alter table if exists public.push_subscriptions
  drop constraint if exists push_subscriptions_allowed_endpoint_check;

alter table if exists public.push_subscriptions
  add constraint push_subscriptions_allowed_endpoint_check
  check (public.is_allowed_web_push_endpoint(endpoint))
  not valid;

alter table if exists public.consent_records
  drop constraint if exists consent_records_channel_check;

alter table if exists public.consent_records
  add constraint consent_records_channel_check
  check (channel in ('email', 'sms', 'whatsapp', 'push'));

create or replace function public.record_customer_marketing_consent(
  p_customer_id uuid,
  p_channel text,
  p_consent_status text,
  p_policy_version text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_membership record;
begin
  if p_customer_id is null then
    raise exception 'Customer is required';
  end if;

  if p_channel not in ('email', 'sms', 'whatsapp', 'push') then
    raise exception 'Unsupported consent channel';
  end if;

  if p_consent_status not in ('opted_in', 'opted_out') then
    raise exception 'Unsupported consent status';
  end if;

  if length(trim(coalesce(p_policy_version, ''))) < 4 then
    raise exception 'Policy version is required';
  end if;

  for v_membership in
    select merchant_id
    from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
  loop
    insert into public.consent_records (
      merchant_id,
      customer_id,
      channel,
      consent_status,
      source,
      policy_version,
      metadata
    )
    values (
      v_membership.merchant_id,
      p_customer_id,
      p_channel,
      p_consent_status,
      'customer_profile',
      trim(p_policy_version),
      jsonb_build_object('scope', 'all_memberships')
    );
  end loop;
end;
$$;

grant execute on function public.record_customer_marketing_consent(uuid, text, text, text)
  to service_role;

drop policy if exists customer_memberships_update_merchant_or_admin
  on public.customer_memberships;

drop policy if exists customer_memberships_update_admin_only
  on public.customer_memberships;

create policy customer_memberships_update_admin_only
  on public.customer_memberships for update to authenticated
  using ((select public.is_internal_admin()))
  with check ((select public.is_internal_admin()));

create or replace function public.prevent_verified_customer_contact_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not public.is_service_role_request() and not public.is_internal_admin() then
    if new.email_verified_at is distinct from old.email_verified_at then
      raise exception 'Email verification timestamp cannot be changed through customer profile updates';
    end if;

    if new.phone_verified_at is distinct from old.phone_verified_at then
      raise exception 'Phone verification timestamp cannot be changed through customer profile updates';
    end if;
  end if;

  if old.email_verified_at is not null then
    if new.email is distinct from old.email
      or new.email_verified_at is distinct from old.email_verified_at then
      raise exception 'Verified email cannot be changed through customer profile updates';
    end if;
  end if;

  if old.phone_verified_at is not null then
    if new.phone is distinct from old.phone
      or new.phone_hmac is distinct from old.phone_hmac
      or new.phone_ciphertext is distinct from old.phone_ciphertext
      or new.phone_last4 is distinct from old.phone_last4
      or new.phone_country is distinct from old.phone_country
      or new.phone_verified_at is distinct from old.phone_verified_at then
      raise exception 'Verified phone cannot be changed through customer profile updates';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.issue_self_service_stamp(
  p_membership_id uuid,
  p_customer_id uuid,
  p_qr_id text,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_accuracy_meters numeric default null,
  p_location_status text default null,
  p_capture_elapsed_ms integer default null
)
returns table (
  stamp_event_id uuid,
  new_stamp_count integer,
  reward_unlocked boolean,
  geo_flagged boolean
)
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_membership record;
  v_qr_id text := trim(coalesce(p_qr_id, ''));
begin
  if v_qr_id = '' then
    raise insufficient_privilege using message = 'Venue QR scan proof required';
  end if;

  select
    memberships.merchant_id,
    cards.id as loyalty_card_id
  into v_membership
  from public.customer_memberships memberships
  join public.loyalty_cards cards
    on cards.merchant_id = memberships.merchant_id
   and cards.is_active
  where memberships.id = p_membership_id
    and memberships.customer_id = p_customer_id
  order by cards.created_at asc
  limit 1;

  if v_membership.merchant_id is null then
    raise insufficient_privilege using message = 'Membership ownership required';
  end if;

  if not exists (
    select 1
    from public.qr_codes qr_codes
    where qr_codes.qr_id = v_qr_id
      and qr_codes.merchant_id = v_membership.merchant_id
      and qr_codes.loyalty_card_id = v_membership.loyalty_card_id
      and qr_codes.destination_type = 'join'
      and qr_codes.is_active
  ) then
    raise insufficient_privilege using message = 'Valid venue QR scan proof required';
  end if;

  return query
    select
      stamp.stamp_event_id,
      stamp.new_stamp_count,
      stamp.reward_unlocked,
      stamp.geo_flagged
    from public.issue_self_service_stamp(
      p_membership_id,
      p_customer_id,
      p_latitude,
      p_longitude,
      p_accuracy_meters,
      p_location_status,
      p_capture_elapsed_ms
    ) stamp;
end;
$$;

revoke all on function public.issue_self_service_stamp(
  uuid, uuid, text, numeric, numeric, numeric, text, integer
) from public;

grant execute on function public.issue_self_service_stamp(
  uuid, uuid, text, numeric, numeric, numeric, text, integer
) to authenticated, service_role;

do $$
begin
  if to_regprocedure('public.issue_self_service_stamp(uuid, uuid, numeric, numeric)') is not null then
    execute 'revoke all on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric) from public, anon, authenticated';
  end if;

  if to_regprocedure('public.issue_self_service_stamp(uuid, uuid, numeric, numeric, numeric, text, integer)') is not null then
    execute 'revoke all on function public.issue_self_service_stamp(uuid, uuid, numeric, numeric, numeric, text, integer) from public, anon, authenticated';
  end if;
end;
$$;

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

  if created_membership and p_qr_id is not null and trim(p_qr_id) <> '' then
    begin
      select s.new_stamp_count, s.reward_unlocked, s.geo_flagged
      into new_stamp_count, reward_unlocked, geo_flagged
      from public.issue_self_service_stamp(
        membership_id,
        p_customer_id,
        p_qr_id,
        p_latitude,
        p_longitude
      ) s;

      first_stamp_issued := true;
    exception
      when others then
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
