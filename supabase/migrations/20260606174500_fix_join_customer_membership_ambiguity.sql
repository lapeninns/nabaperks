-- join_customer_membership declared merchant_id/customer_id variables that
-- shadowed column names in INSERT ... VALUES clauses.

create or replace function public.join_customer_membership(
  p_merchant_slug text,
  p_qr_id text,
  p_marketing_opt_in boolean,
  p_policy_version text
)
returns table (membership_id uuid, created_membership boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := (select auth.uid());
  v_customer_id uuid;
  v_merchant_id uuid;
  v_loyalty_card_id uuid;
  v_qr_code_uuid uuid;
  customer_email text := nullif((select auth.jwt() ->> 'email'), '');
  customer_phone text := nullif((select auth.jwt() ->> 'phone'), '');
begin
  if current_user_id is null then
    raise insufficient_privilege using message = 'Authentication required';
  end if;

  if p_qr_id is not null and p_qr_id <> '' then
    select
      qr_codes.id,
      qr_codes.merchant_id,
      qr_codes.loyalty_card_id
    into
      v_qr_code_uuid,
      v_merchant_id,
      v_loyalty_card_id
    from public.qr_codes
    join public.merchants on merchants.id = qr_codes.merchant_id
    join public.loyalty_cards on loyalty_cards.id = qr_codes.loyalty_card_id
    where qr_codes.qr_id = p_qr_id
      and qr_codes.destination_type = 'join'
      and qr_codes.is_active
      and loyalty_cards.is_active
      and merchants.business_slug = p_merchant_slug;
  else
    select merchants.id, loyalty_cards.id
    into v_merchant_id, v_loyalty_card_id
    from public.merchants
    join public.loyalty_cards on loyalty_cards.merchant_id = merchants.id
    where merchants.business_slug = p_merchant_slug
      and loyalty_cards.is_active
    order by loyalty_cards.created_at asc
    limit 1;
  end if;

  if v_merchant_id is null or v_loyalty_card_id is null then
    raise exception 'This loyalty card is unavailable';
  end if;

  insert into public.customers (
    auth_user_id,
    email,
    phone
  )
  values (
    current_user_id,
    customer_email,
    customer_phone
  )
  on conflict (auth_user_id) do update
  set
    email = coalesce(excluded.email, customers.email),
    phone = coalesce(excluded.phone, customers.phone)
  returning id into v_customer_id;

  insert into public.customer_memberships (
    merchant_id,
    customer_id
  )
  values (
    v_merchant_id,
    v_customer_id
  )
  on conflict (merchant_id, customer_id) do nothing
  returning id into membership_id;

  created_membership := membership_id is not null;

  if membership_id is null then
    select customer_memberships.id
    into membership_id
    from public.customer_memberships
    where customer_memberships.merchant_id = v_merchant_id
      and customer_memberships.customer_id = v_customer_id;
  end if;

  if p_marketing_opt_in then
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
      v_merchant_id,
      v_customer_id,
      case when customer_email is not null then 'email' else 'sms' end,
      'opted_in',
      'customer_join',
      p_policy_version,
      jsonb_build_object('qr_code_id', v_qr_code_uuid)
    );
  end if;

  if created_membership then
    insert into public.product_events (
      event_name,
      merchant_id,
      customer_id,
      membership_id,
      qr_code_id,
      actor_type,
      actor_id,
      metadata
    )
    values (
      'customer_joined',
      v_merchant_id,
      v_customer_id,
      membership_id,
      v_qr_code_uuid,
      'customer',
      current_user_id::text,
      jsonb_build_object('marketing_opt_in', p_marketing_opt_in)
    );
  end if;

  return next;
end;
$$;
