-- Issued rewards, phase 4: GDPR erasure/retention must reach pending invites.
--
-- admin_erase_customer_pii and admin_purge_stale_customer_pii are reproduced
-- verbatim from 20260630129000 with an invite-scrub added: capture the phone
-- HMAC before it is nulled, then cancel + scrub any live invite tied to the
-- customer (by matched/attached ref or phone HMAC). Email-only invites that were
-- never matched are not reachable here; that residual is bounded to ≤90 days by
-- the invite expiry sweep.

create or replace function public.admin_erase_customer_pii(
  p_customer_id uuid,
  p_merchant_id uuid,
  p_channel text,
  p_notes text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_user_id uuid;
  surrogate_email text;
  erased_count integer;
  v_phone_hmac text;
begin
  admin_user_id := (select auth.uid());

  if admin_user_id is null or not (select public.is_internal_admin()) then
    raise insufficient_privilege using message = 'Internal admin access required';
  end if;

  if p_channel not in ('email', 'phone', 'in_person', 'other') then
    raise exception 'Unsupported request channel';
  end if;

  if length(trim(coalesce(p_notes, ''))) < 4 then
    raise exception 'Data request notes are required';
  end if;

  if not exists (
    select 1
    from public.customer_memberships
    where customer_memberships.customer_id = p_customer_id
      and customer_memberships.merchant_id = p_merchant_id
  ) then
    raise exception 'Customer membership context not found';
  end if;

  -- Capture the phone HMAC before the update nulls it, so invites keyed only on
  -- the hashed phone can still be found and scrubbed.
  select phone_hmac into v_phone_hmac from public.customers where id = p_customer_id;

  surrogate_email := 'erased+' || replace(p_customer_id::text, '-', '') || '@privacy.invalid';
  perform set_config('app.customer_erasure', 'true', true);

  update public.customers
  set
    auth_user_id = null,
    email = surrogate_email,
    email_verified_at = null,
    full_name = null,
    date_of_birth = null,
    phone = null,
    phone_hmac = null,
    phone_ciphertext = null,
    phone_last4 = null,
    phone_country = null,
    phone_verified_at = null,
    updated_at = now()
  where id = p_customer_id;

  get diagnostics erased_count = row_count;
  perform set_config('app.customer_erasure', '', true);

  if erased_count <> 1 then
    raise exception 'Customer not found';
  end if;

  -- Scrub any invite tied to this customer: cancel live ones, drop every hash.
  update public.pending_reward_invites
  set status = case when status in ('pending', 'matched') then 'cancelled' else status end,
      email_hmac = null, phone_hmac = null, email_masked = null, phone_last4 = null,
      claim_token_hash = 'scrubbed:' || id::text, updated_at = now()
  where matched_customer_id = p_customer_id
     or attached_customer_id = p_customer_id
     or (v_phone_hmac is not null and phone_hmac = v_phone_hmac);

  insert into public.audit_logs (
    actor_type, actor_id, merchant_id, customer_id, target_table, target_id, action, metadata
  )
  values (
    'admin', admin_user_id::text, p_merchant_id, p_customer_id, 'customers', p_customer_id,
    'customer_pii_erased',
    jsonb_build_object(
      'request_type', 'deletion', 'channel', p_channel, 'notes', trim(p_notes),
      'surrogate', surrogate_email, 'ledger_retained', true
    )
  );

  return jsonb_build_object(
    'ok', true, 'request_type', 'deletion', 'customer_id', p_customer_id,
    'surrogate', surrogate_email, 'ledger_retained', true
  );
end;
$$;

create or replace function public.admin_purge_stale_customer_pii(
  p_cutoff timestamptz default now() - interval '365 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stale_customer record;
  purged_count integer := 0;
  v_phone_hmac text;
begin
  perform set_config('app.customer_erasure', 'true', true);

  for stale_customer in
    select customers.id
    from public.customers
    where customers.updated_at < p_cutoff
      and coalesce(customers.email, '') not like 'erased+%@privacy.invalid'
      and not exists (
        select 1 from public.customer_memberships
        where customer_memberships.customer_id = customers.id
          and customer_memberships.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.reward_events
        where reward_events.customer_id = customers.id
          and reward_events.updated_at >= p_cutoff
      )
      and not exists (
        select 1 from public.stamp_events
        where stamp_events.customer_id = customers.id
          and stamp_events.created_at >= p_cutoff
      )
  loop
    select phone_hmac into v_phone_hmac from public.customers where id = stale_customer.id;

    update public.customers
    set
      auth_user_id = null,
      email = 'erased+' || replace(stale_customer.id::text, '-', '') || '@privacy.invalid',
      email_verified_at = null,
      full_name = null,
      date_of_birth = null,
      phone = null,
      phone_hmac = null,
      phone_ciphertext = null,
      phone_last4 = null,
      phone_country = null,
      phone_verified_at = null,
      updated_at = now()
    where id = stale_customer.id;

    update public.pending_reward_invites
    set status = case when status in ('pending', 'matched') then 'cancelled' else status end,
        email_hmac = null, phone_hmac = null, email_masked = null, phone_last4 = null,
        claim_token_hash = 'scrubbed:' || id::text, updated_at = now()
    where matched_customer_id = stale_customer.id
       or attached_customer_id = stale_customer.id
       or (v_phone_hmac is not null and phone_hmac = v_phone_hmac);

    purged_count := purged_count + 1;
  end loop;

  perform set_config('app.customer_erasure', '', true);
  return purged_count;
end;
$$;

grant execute on function public.admin_erase_customer_pii(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.admin_purge_stale_customer_pii(timestamptz) to service_role;

notify pgrst, 'reload schema';
