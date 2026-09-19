-- Customer messaging channels and Twilio delivery ledger.
--
-- WHAT CHANGES
--   1. Adds venue/customer phone-channel controls, defaulting venue sends off.
--   2. Adds append-only WhatsApp/SMS delivery and inbound-message evidence.
--   3. Adds atomic delivery fences, monotonic callbacks, fallback and budgets.
--   4. Scrubs recipient hints and inbound linkage during customer erasure.
--
-- Forward-only and re-runnable. No provider configuration or live send is
-- activated by this migration.

alter table public.merchants
  add column if not exists customer_messaging_enabled boolean not null default false;

create or replace function public.audit_customer_messaging_enablement()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if old.customer_messaging_enabled is distinct from new.customer_messaging_enabled then
    insert into public.audit_logs (actor_type, actor_id, merchant_id, target_table, target_id, action, metadata)
    values (case when auth.uid() is null then 'system' else 'admin' end,
      auth.uid()::text, new.id, 'merchants', new.id, 'customer_messaging_enabled_changed',
      jsonb_build_object('previous', old.customer_messaging_enabled, 'enabled', new.customer_messaging_enabled));
  end if;
  return new;
end;
$$;
revoke all on function public.audit_customer_messaging_enablement() from public, anon, authenticated, service_role;
drop trigger if exists audit_customer_messaging_enablement on public.merchants;
create trigger audit_customer_messaging_enablement after update of customer_messaging_enabled on public.merchants
  for each row execute function public.audit_customer_messaging_enablement();

alter table public.notification_preferences
  add column if not exists phone_messages_enabled boolean not null default true,
  add column if not exists preferred_phone_channel text not null default 'whatsapp'
    check (preferred_phone_channel in ('whatsapp', 'sms')),
  add column if not exists whatsapp_unavailable_at timestamptz;

alter table public.notification_deliveries
  add column if not exists channel text not null default 'push'
    check (channel in ('push', 'whatsapp', 'sms')),
  add column if not exists recipient_last4 text check (recipient_last4 ~ '^[0-9]{4}$'),
  add column if not exists provider_message_sid text,
  add column if not exists provider_status text,
  add column if not exists provider_error_code text,
  add column if not exists provider_attempted_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();
alter table public.notification_deliveries drop constraint if exists notification_deliveries_status_check;
alter table public.notification_deliveries add constraint notification_deliveries_status_check
  check (status in ('pending', 'sent', 'retryable_failure', 'permanent_failure', 'skipped'));
create unique index if not exists notification_deliveries_provider_sid_idx
  on public.notification_deliveries (provider_message_sid) where provider_message_sid is not null;
create unique index if not exists notification_deliveries_phone_attempt_idx
  on public.notification_deliveries (notification_event_id, channel, attempt_number)
  where channel in ('whatsapp', 'sms') and status <> 'skipped';

create table if not exists public.customer_inbound_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  provider_message_sid text not null unique,
  channel text not null check (channel in ('whatsapp', 'sms')),
  phone_hmac text not null check (phone_hmac ~ '^[0-9a-f]{64}$'),
  customer_id uuid references public.customers(id) on delete cascade,
  keyword text not null check (keyword in ('stop', 'start', 'help', 'other')),
  created_at timestamptz not null default now()
);
create index if not exists customer_inbound_messages_customer_idx
  on public.customer_inbound_messages (customer_id);
create index if not exists customer_inbound_messages_phone_idx
  on public.customer_inbound_messages (phone_hmac);
alter table public.customer_inbound_messages enable row level security;
alter table public.customer_inbound_messages force row level security;
drop policy if exists customer_inbound_messages_service_role_all on public.customer_inbound_messages;
create policy customer_inbound_messages_service_role_all on public.customer_inbound_messages
  for all to service_role using (true) with check (true);
revoke all on table public.customer_inbound_messages from public, anon, authenticated;
grant select, insert, delete on table public.customer_inbound_messages to service_role;

create or replace function public.prevent_notification_delivery_mutation()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' then
    -- Erasure may remove the final four digits without rewriting audit history.
    if new.recipient_last4 is null and old.recipient_last4 is not null
       and (to_jsonb(new) - 'recipient_last4') = (to_jsonb(old) - 'recipient_last4')
       and exists (select 1 from public.customers c where c.id = old.customer_id and c.phone_hmac is null) then
      return new;
    end if;
    if old.channel in ('whatsapp', 'sms')
       and (to_jsonb(new) - array['status', 'provider_message_sid', 'provider_status',
         'provider_error_code', 'provider_attempted_at', 'delivered_at', 'updated_at',
         'sent_at', 'response_status', 'failure_reason']) =
           (to_jsonb(old) - array['status', 'provider_message_sid', 'provider_status',
         'provider_error_code', 'provider_attempted_at', 'delivered_at', 'updated_at',
         'sent_at', 'response_status', 'failure_reason']) then
      return new;
    end if;
  end if;
  raise exception 'Notification delivery attempts are append-only';
end;
$$;

drop function if exists public.get_notification_preferences_for_customer(uuid);
create function public.get_notification_preferences_for_customer(p_customer_id uuid)
returns table (transactional_enabled boolean, reminder_enabled boolean, marketing_enabled boolean,
  quiet_hours_start time, quiet_hours_end time, active_subscription_count integer,
  phone_messages_enabled boolean, preferred_phone_channel text, whatsapp_unavailable_at timestamptz)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not exists (select 1 from public.customers where id = p_customer_id) then
    raise insufficient_privilege using message = 'Customer profile required';
  end if;
  insert into public.notification_preferences (customer_id) values (p_customer_id)
    on conflict (customer_id) do nothing;
  return query select p.transactional_enabled, p.reminder_enabled, p.marketing_enabled,
    p.quiet_hours_start, p.quiet_hours_end,
    (select count(*)::integer from public.push_subscriptions s where s.customer_id = p_customer_id and s.enabled),
    p.phone_messages_enabled, p.preferred_phone_channel, p.whatsapp_unavailable_at
  from public.notification_preferences p where p.customer_id = p_customer_id;
end;
$$;

create or replace function public.update_customer_phone_messaging_preferences(
  p_customer_id uuid, p_phone_messages_enabled boolean, p_preferred_phone_channel text
) returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if p_phone_messages_enabled is null or p_preferred_phone_channel is null
     or p_preferred_phone_channel not in ('whatsapp', 'sms') then
    raise exception 'Invalid phone messaging preferences';
  end if;
  insert into public.notification_preferences (customer_id, phone_messages_enabled, preferred_phone_channel)
  values (p_customer_id, p_phone_messages_enabled, p_preferred_phone_channel)
  on conflict (customer_id) do update set phone_messages_enabled = excluded.phone_messages_enabled,
    preferred_phone_channel = excluded.preferred_phone_channel, updated_at = now();
end;
$$;

drop function if exists public.record_notification_delivery(uuid, uuid, uuid, text, integer, integer, text, jsonb);
create or replace function public.record_notification_delivery(
  p_notification_event_id uuid, p_push_subscription_id uuid, p_customer_id uuid, p_status text,
  p_attempt_number integer default 1, p_response_status integer default null,
  p_failure_reason text default null, p_metadata jsonb default '{}',
  p_channel text default 'push', p_recipient_last4 text default null
) returns uuid language plpgsql security definer set search_path = public, auth, extensions as $$
declare v_id uuid; v_phone_hmac text;
begin
  select phone_hmac into v_phone_hmac from public.customers where id = p_customer_id for update;
  if not exists (select 1 from public.notification_events where id = p_notification_event_id and customer_id = p_customer_id) then
    raise exception 'Notification customer mismatch';
  end if;
  insert into public.notification_deliveries (notification_event_id, push_subscription_id,
    customer_id, status, attempt_number, response_status, failure_reason, sent_at, metadata, channel, recipient_last4)
  values (p_notification_event_id, p_push_subscription_id, p_customer_id, p_status,
    greatest(coalesce(p_attempt_number, 1), 1), p_response_status, p_failure_reason,
    case when p_status = 'sent' then now() end, coalesce(p_metadata, '{}'), p_channel,
    case when v_phone_hmac is not null then p_recipient_last4 end)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.begin_notification_message_delivery(
  p_notification_event_id uuid, p_customer_id uuid, p_channel text,
  p_attempt_number integer default 1, p_recipient_last4 text default null
) returns uuid language plpgsql security definer set search_path = public, auth, extensions as $$
declare v_id uuid;
begin
  if p_channel is null or p_channel not in ('whatsapp', 'sms') then
    raise exception 'Invalid phone channel';
  end if;
  perform 1 from public.customers where id = p_customer_id and phone_hmac is not null for update;
  if not found then raise exception 'Customer phone identity required'; end if;
  -- Serialise channel admission across workers even if their attempt counters differ.
  perform 1 from public.notification_events where id = p_notification_event_id and customer_id = p_customer_id for update;
  if not found then raise exception 'Notification customer mismatch'; end if;
  if exists (select 1 from public.notification_deliveries where notification_event_id = p_notification_event_id
    and channel = p_channel and status in ('pending', 'sent')) then
    raise exception using errcode = 'NBM01', message = 'Phone delivery already admitted';
  end if;
  insert into public.notification_deliveries (notification_event_id, customer_id, channel, status,
    attempt_number, recipient_last4, provider_attempted_at)
  values (p_notification_event_id, p_customer_id, p_channel, 'pending', p_attempt_number, p_recipient_last4, now())
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception using errcode = 'NBM01', message = 'Phone delivery already admitted';
end;
$$;

create or replace function public.finish_notification_message_delivery(
  p_delivery_id uuid, p_status text, p_provider_message_sid text default null,
  p_provider_status text default null, p_provider_error_code text default null,
  p_response_status integer default null, p_failure_reason text default null
) returns boolean language plpgsql security definer set search_path = public, auth as $$
begin
  if p_status is null or p_status not in ('sent', 'retryable_failure', 'permanent_failure') then
    raise exception 'Invalid phone delivery outcome';
  end if;
  update public.notification_deliveries set status = p_status, provider_message_sid = p_provider_message_sid,
    provider_status = p_provider_status, provider_error_code = p_provider_error_code,
    response_status = p_response_status, failure_reason = p_failure_reason,
    sent_at = case when p_status = 'sent' then now() end, updated_at = now()
  where id = p_delivery_id and channel in ('whatsapp', 'sms') and status = 'pending';
  return found;
end;
$$;

create or replace function public.apply_twilio_message_status(
  p_delivery_id uuid, p_provider_message_sid text, p_provider_status text,
  p_provider_error_code text default null
) returns boolean language plpgsql security definer set search_path = public, auth as $$
declare v_delivery public.notification_deliveries%rowtype; v_old_rank integer; v_rank integer;
begin
  select * into v_delivery from public.notification_deliveries where id = p_delivery_id
    and provider_message_sid = p_provider_message_sid and channel in ('whatsapp', 'sms') for update;
  if not found then return false; end if;
  v_rank := array_position(array['accepted', 'scheduled', 'queued', 'sending', 'sent', 'delivered', 'read'], p_provider_status);
  v_old_rank := coalesce(array_position(array['accepted', 'scheduled', 'queued', 'sending', 'sent', 'delivered', 'read'], v_delivery.provider_status), 0);
  if v_delivery.provider_status in ('failed', 'undelivered', 'canceled') then return true; end if;
  if p_provider_status in ('failed', 'undelivered', 'canceled') then
    if v_old_rank >= 6 then return true; end if;
  elsif v_rank is null or v_rank <= v_old_rank then return true;
  end if;
  update public.notification_deliveries set provider_status = p_provider_status,
    provider_error_code = p_provider_error_code,
    status = case when p_provider_status in ('failed', 'undelivered', 'canceled') then 'permanent_failure' else 'sent' end,
    delivered_at = case when v_rank >= 6 then coalesce(delivered_at, now()) else delivered_at end,
    updated_at = now()
  where id = p_delivery_id;
  if v_delivery.channel = 'whatsapp' and p_provider_status in ('failed', 'undelivered')
     and p_provider_error_code in ('63003', '63024', '63016', '63049')
     and v_delivery.provider_attempted_at >= now() - interval '24 hours' then
    insert into public.notification_preferences (customer_id, whatsapp_unavailable_at)
    values (v_delivery.customer_id, now()) on conflict (customer_id) do update
      set whatsapp_unavailable_at = excluded.whatsapp_unavailable_at, updated_at = now();
    update public.notification_events e set status = 'queued', due_at = now(), sent_at = null,
      claimed_at = null, lease_expires_at = null,
      metadata = e.metadata || jsonb_build_object('fallback_from', 'whatsapp'), updated_at = now()
    where e.id = v_delivery.notification_event_id and e.status in ('sent', 'delivering', 'failed')
      and not exists (select 1 from public.notification_deliveries d where d.notification_event_id = e.id
        and d.channel <> 'whatsapp' and d.status in ('pending', 'sent'));
  end if;
  return true;
end;
$$;

create or replace function public.record_customer_messaging_inbound(
  p_provider_message_sid text, p_channel text, p_phone_hmac text, p_keyword text
) returns uuid language plpgsql security definer set search_path = public, auth, extensions as $$
declare v_id uuid; v_customer_id uuid;
begin
  if nullif(btrim(p_provider_message_sid), '') is null then raise exception 'Provider message SID required'; end if;
  select id into v_customer_id from public.customers where phone_hmac = p_phone_hmac for update;
  insert into public.customer_inbound_messages (provider_message_sid, channel, phone_hmac, customer_id, keyword)
  values (p_provider_message_sid, p_channel, p_phone_hmac, v_customer_id, p_keyword)
  on conflict (provider_message_sid) do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.customer_inbound_messages where provider_message_sid = p_provider_message_sid;
    return v_id;
  end if;
  if v_customer_id is not null and p_keyword in ('stop', 'start') then
    insert into public.notification_preferences (customer_id, phone_messages_enabled)
    values (v_customer_id, p_keyword = 'start') on conflict (customer_id) do update
      set phone_messages_enabled = excluded.phone_messages_enabled, updated_at = now();
    if p_keyword = 'stop' then
      insert into public.consent_records (merchant_id, customer_id, channel, consent_status, source, policy_version)
      select m.merchant_id, v_customer_id, c.channel, 'opted_out', 'inbound_stop', 'phone-messaging-v1'
      from public.customer_memberships m cross join (values ('whatsapp'), ('sms')) c(channel)
      where m.customer_id = v_customer_id;
    end if;
  end if;
  return v_id;
end;
$$;

create or replace function public.admit_customer_message_dispatch(p_merchant_id uuid, p_category text)
returns boolean language plpgsql security definer set search_path = public, auth as $$
begin
  if p_category is null or p_category not in ('transactional', 'reminder', 'marketing')
     or p_merchant_id is null then raise exception 'Invalid message budget scope'; end if;
  begin
    perform public.enforce_rate_limit('customer-messaging:global:minute:v1', 60, 60000);
    perform public.enforce_rate_limit('customer-messaging:global:hour:v1', 600, 3600000);
    perform public.enforce_rate_limit('customer-messaging:global:day:v1', 3000, 86400000);
    if p_category = 'marketing' then
      perform public.enforce_rate_limit('customer-messaging:merchant:' || p_merchant_id || ':day:v1', 500, 86400000);
    end if;
  exception when raise_exception then
    if sqlerrm = 'Rate limit exceeded' then return false; end if;
    raise;
  end;
  return true;
end;
$$;

create or replace function public.scrub_customer_messaging_after_erasure()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if old.phone_hmac is not null and new.phone_hmac is null then
    update public.notification_deliveries set recipient_last4 = null
      where customer_id = new.id and recipient_last4 is not null;
    delete from public.customer_inbound_messages where customer_id = new.id or phone_hmac = old.phone_hmac;
  end if;
  return new;
end;
$$;
drop trigger if exists scrub_customer_messaging_after_erasure on public.customers;
create trigger scrub_customer_messaging_after_erasure after update of phone_hmac on public.customers
  for each row execute function public.scrub_customer_messaging_after_erasure();

create or replace function public.notification_event_category(p_event_type text)
returns text language plpgsql immutable set search_path = public as $$
declare v_category text;
begin
  v_category := case p_event_type
    when 'push_permission_prompt_viewed' then 'operational'
    when 'push_permission_granted' then 'operational'
    when 'push_subscription_created' then 'operational'
    when 'push_subscription_disabled' then 'operational'
    when 'push_subscription_failed' then 'operational'
    when 'one_stamp_away' then 'transactional'
    when 'reward_unlocked_waiting' then 'transactional'
    when 'reward_ready' then 'transactional'
    when 'profile_required_to_collect' then 'transactional'
    when 'reward_collected_cycle_started' then 'transactional'
    when 'referral_bonus_stamp_issued' then 'transactional'
    when 'referral_friend_joined' then 'transactional'
    when 'referral_qualified' then 'transactional'
    when 'referral_bonus_saved' then 'transactional'
    when 'reward_upgraded' then 'transactional'
    when 'loyalty_terms_updated' then 'transactional'
    when 'venue_paused' then 'transactional'
    when 'next_stamp_available' then 'reminder'
    when 'reward_expiring_soon' then 'reminder'
    when 'reward_expired' then 'reminder'
    when 'dormant_progress' then 'marketing'
    when 'venue_announcement' then 'marketing'
    when 'birthday_reward_issued' then 'marketing'
    when 'merchant_reward_received' then 'marketing'
    when 'collection_window_opens' then 'marketing'
    else null
  end;
  if v_category is null then raise exception 'Unsupported notification event type: %', p_event_type; end if;
  return v_category;
end;
$$;
alter table public.notification_events drop constraint if exists notification_events_event_type_check;
alter table public.notification_events add constraint notification_events_event_type_check check (event_type in (
  'push_permission_prompt_viewed', 'push_permission_granted', 'push_subscription_created',
  'push_subscription_disabled', 'push_subscription_failed', 'one_stamp_away', 'next_stamp_available',
  'reward_unlocked_waiting', 'reward_ready', 'profile_required_to_collect', 'reward_expiring_soon',
  'reward_expired', 'reward_collected_cycle_started', 'dormant_progress', 'venue_announcement',
  'birthday_reward_issued', 'merchant_reward_received', 'referral_bonus_stamp_issued',
  'referral_friend_joined', 'referral_qualified', 'referral_bonus_saved', 'collection_window_opens',
  'reward_upgraded', 'loyalty_terms_updated', 'venue_paused'));

create or replace function public.list_pending_loyalty_terms_updates(p_limit integer default 100)
returns table (
  membership_id uuid, customer_id uuid, merchant_id uuid, active_cycle_number integer,
  policy_cutover_notice_at timestamptz, business_name text
) language sql stable security definer set search_path = public, auth as $$
  select memberships.id, memberships.customer_id, memberships.merchant_id,
    memberships.active_cycle_number, memberships.policy_cutover_notice_at, merchants.business_name
  from public.customer_memberships memberships
  join public.merchants merchants on merchants.id = memberships.merchant_id
  where memberships.policy_cutover_notice_at is not null
    and not exists (
      select 1 from public.notification_events events
      where events.event_type = 'loyalty_terms_updated'
        and events.membership_id = memberships.id
    )
  order by memberships.policy_cutover_notice_at, memberships.id
  limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;

revoke all on function public.get_notification_preferences_for_customer(uuid) from public, anon, authenticated;
revoke all on function public.update_customer_phone_messaging_preferences(uuid, boolean, text) from public, anon, authenticated;
revoke all on function public.record_notification_delivery(uuid, uuid, uuid, text, integer, integer, text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.begin_notification_message_delivery(uuid, uuid, text, integer, text) from public, anon, authenticated;
revoke all on function public.finish_notification_message_delivery(uuid, text, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.apply_twilio_message_status(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.record_customer_messaging_inbound(text, text, text, text) from public, anon, authenticated;
revoke all on function public.admit_customer_message_dispatch(uuid, text) from public, anon, authenticated;
revoke all on function public.list_pending_loyalty_terms_updates(integer) from public, anon, authenticated;
revoke all on function public.scrub_customer_messaging_after_erasure() from public, anon, authenticated, service_role;
grant execute on function public.get_notification_preferences_for_customer(uuid) to service_role;
grant execute on function public.update_customer_phone_messaging_preferences(uuid, boolean, text) to service_role;
grant execute on function public.record_notification_delivery(uuid, uuid, uuid, text, integer, integer, text, jsonb, text, text) to service_role;
grant execute on function public.begin_notification_message_delivery(uuid, uuid, text, integer, text) to service_role;
grant execute on function public.finish_notification_message_delivery(uuid, text, text, text, text, integer, text) to service_role;
grant execute on function public.apply_twilio_message_status(uuid, text, text, text) to service_role;
grant execute on function public.record_customer_messaging_inbound(text, text, text, text) to service_role;
grant execute on function public.admit_customer_message_dispatch(uuid, text) to service_role;
grant execute on function public.list_pending_loyalty_terms_updates(integer) to service_role;
notify pgrst, 'reload schema';
