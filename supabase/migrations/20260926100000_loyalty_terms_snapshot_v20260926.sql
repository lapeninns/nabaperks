-- Earning terms and reward age flags are persisted and accepted as one legal snapshot.
--
-- WHAT CHANGES
--   * Card saving persists the minimum-spend and one-transaction display terms.
--   * Direct rewards and pending invites accept an immutable age-check flag.
--   * New acceptances receive the 2026-09-26 no-lock/trading-day legal snapshot.
--
-- Forward-only and re-runnable.

create or replace function private.loyalty_earning_terms_text(p_loyalty_card_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select concat_ws(' ',
    'One stamp per visit' || case when cards.one_transaction_per_stamp
      then ', one transaction per stamp.' else '.' end,
    case when cards.minimum_spend_pence is not null then
      format('Minimum spend £%s.', trim(to_char(cards.minimum_spend_pence / 100.0, 'FM999999990.00')))
    end
  )
  from public.loyalty_cards cards where cards.id = p_loyalty_card_id;
$function$;

revoke all on function private.loyalty_earning_terms_text(uuid)
  from public, anon, authenticated, service_role;

do $do$
begin
  if to_regprocedure('public.save_loyalty_card(uuid,uuid,text,integer,text,text,boolean,integer)') is not null
     and to_regprocedure('private.save_loyalty_card(uuid,uuid,text,integer,text,text,boolean,integer)') is null then
    alter function public.save_loyalty_card(uuid,uuid,text,integer,text,text,boolean,integer)
      set schema private;
  end if;
  if to_regprocedure('public.issue_merchant_direct_reward(uuid,uuid,text,text,integer,text)') is not null
     and to_regprocedure('private.issue_merchant_direct_reward(uuid,uuid,text,text,integer,text)') is null then
    alter function public.issue_merchant_direct_reward(uuid,uuid,text,text,integer,text)
      set schema private;
  end if;
  if to_regprocedure('public.create_bounded_merchant_reward_invite(uuid,text,text,text,text,text,text,text,integer,text,text)') is not null
     and to_regprocedure('private.create_bounded_merchant_reward_invite(uuid,text,text,text,text,text,text,text,integer,text,text)') is null then
    alter function public.create_bounded_merchant_reward_invite(uuid,text,text,text,text,text,text,text,integer,text,text)
      set schema private;
  end if;
end
$do$;

revoke all on function private.save_loyalty_card(uuid,uuid,text,integer,text,text,boolean,integer)
  from public, anon, authenticated, service_role;
revoke all on function private.issue_merchant_direct_reward(uuid,uuid,text,text,integer,text)
  from public, anon, authenticated, service_role;
revoke all on function private.create_bounded_merchant_reward_invite(uuid,text,text,text,text,text,text,text,integer,text,text)
  from public, anon, authenticated, service_role;

create or replace function public.save_loyalty_card(
  p_merchant_id uuid,
  p_card_id uuid,
  p_card_name text,
  p_stamps_required integer,
  p_reward_name text,
  p_reward_terms text,
  p_is_active boolean,
  p_reward_expires_after_days integer default 30,
  p_minimum_spend_pence integer default null,
  p_one_transaction_per_stamp boolean default true
)
returns table (loyalty_card_id uuid, saved_action text)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_saved record;
begin
  if p_minimum_spend_pence is not null and p_minimum_spend_pence < 0 then
    raise exception 'Minimum spend cannot be negative';
  end if;
  select * into v_saved from private.save_loyalty_card(
    p_merchant_id, p_card_id, p_card_name, p_stamps_required,
    p_reward_name, p_reward_terms, p_is_active, p_reward_expires_after_days
  );
  update public.loyalty_cards cards
  set minimum_spend_pence = p_minimum_spend_pence,
      one_transaction_per_stamp = coalesce(p_one_transaction_per_stamp, true)
  where cards.id = v_saved.loyalty_card_id;
  loyalty_card_id := v_saved.loyalty_card_id;
  saved_action := v_saved.saved_action;
  return next;
end;
$function$;

revoke all on function public.save_loyalty_card(uuid,uuid,text,integer,text,text,boolean,integer,integer,boolean)
  from public, anon;
grant execute on function public.save_loyalty_card(uuid,uuid,text,integer,text,text,boolean,integer,integer,boolean)
  to authenticated, service_role;

create or replace function public.issue_merchant_direct_reward(
  p_merchant_id uuid,
  p_membership_id uuid,
  p_reward_name text,
  p_reward_terms text,
  p_expires_in_days integer default 30,
  p_reason text default null,
  p_requires_age_check boolean default true
)
returns table (reward_event_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $function$
declare
  v_saved record;
begin
  select * into v_saved from private.issue_merchant_direct_reward(
    p_merchant_id, p_membership_id, p_reward_name, p_reward_terms,
    p_expires_in_days, p_reason
  );
  update public.reward_events rewards
  set reward_policy_snapshot = rewards.reward_policy_snapshot
    || jsonb_build_object('age_check', coalesce(p_requires_age_check, true))
  where rewards.id = v_saved.reward_event_id;
  reward_event_id := v_saved.reward_event_id;
  expires_at := v_saved.expires_at;
  return next;
end;
$function$;

revoke all on function public.issue_merchant_direct_reward(uuid,uuid,text,text,integer,text,boolean)
  from public, anon;
grant execute on function public.issue_merchant_direct_reward(uuid,uuid,text,text,integer,text,boolean)
  to authenticated, service_role;

create or replace function public.create_bounded_merchant_reward_invite(
  p_merchant_id uuid,
  p_email_hmac text,
  p_phone_hmac text,
  p_email_masked text,
  p_phone_last4 text,
  p_reward_name text,
  p_reward_terms text,
  p_personal_message text,
  p_reward_expires_after_days integer,
  p_claim_token_hash text,
  p_unsubscribe_token_hash text default null,
  p_requires_age_check boolean default true
)
returns table (invite_id uuid, deduped boolean)
language plpgsql
security definer
set search_path = public, auth, extensions, pg_temp
as $function$
declare
  v_saved record;
begin
  select * into v_saved from private.create_bounded_merchant_reward_invite(
    p_merchant_id, p_email_hmac, p_phone_hmac, p_email_masked, p_phone_last4,
    p_reward_name, p_reward_terms, p_personal_message, p_reward_expires_after_days,
    p_claim_token_hash, p_unsubscribe_token_hash
  );
  update public.pending_reward_invites invites
  set requires_age_check = coalesce(p_requires_age_check, true)
  where invites.id = v_saved.invite_id and not v_saved.deduped;
  invite_id := v_saved.invite_id;
  deduped := v_saved.deduped;
  return next;
end;
$function$;

revoke all on function public.create_bounded_merchant_reward_invite(uuid,text,text,text,text,text,text,text,integer,text,text,boolean)
  from public, anon;
grant execute on function public.create_bounded_merchant_reward_invite(uuid,text,text,text,text,text,text,text,integer,text,text,boolean)
  to authenticated, service_role;

create or replace function private.snapshot_attached_invite_age_policy()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.attached_reward_event_id is not null
     and old.attached_reward_event_id is null then
    update public.reward_events rewards
    set reward_policy_snapshot = rewards.reward_policy_snapshot
      || jsonb_build_object('age_check', new.requires_age_check)
    where rewards.id = new.attached_reward_event_id
      and rewards.merchant_id = new.merchant_id
      and rewards.customer_id = new.attached_customer_id
      and rewards.source = 'merchant_direct';
  end if;
  return new;
end;
$function$;

revoke all on function private.snapshot_attached_invite_age_policy()
  from public, anon, authenticated, service_role;
drop trigger if exists pending_reward_invites_snapshot_age on public.pending_reward_invites;
create trigger pending_reward_invites_snapshot_age
after update of attached_reward_event_id on public.pending_reward_invites
for each row execute function private.snapshot_attached_invite_age_policy();

create or replace function public.apply_customer_legal_terms_snapshot_v20260926()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_merchant_name text;
  v_merchant_contact text;
  v_card record;
  v_trading_day_starts_at time;
  v_pool jsonb;
  v_pool_body text;
  v_windows_body text;
begin
  if new.policy_version <> '2026-09-26' then return new; end if;

  select
    merchants.business_name,
    coalesce(
      nullif(concat_ws(
        ' · ',
        nullif(merchants.email, ''),
        nullif(merchants.phone, '')
      ), ''),
      'Ask the venue team'
    )
  into v_merchant_name, v_merchant_contact
  from public.merchants
  where merchants.id = new.merchant_id;

  select cards.*, locations.trading_day_starts_at
  into v_card
  from public.loyalty_cards cards
  join public.merchant_locations locations
    on locations.id = cards.location_id
   and locations.merchant_id = cards.merchant_id
  where cards.id = new.loyalty_card_id
    and cards.merchant_id = new.merchant_id;

  if v_merchant_name is null or v_card.id is null then
    raise exception 'Unable to build the accepted venue terms snapshot';
  end if;
  v_trading_day_starts_at := coalesce(
    v_card.trading_day_starts_at,
    time '05:00'
  );

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', items.id,
          'reward_name', items.reward_name,
          'reward_terms', items.reward_terms,
          'requires_age_check', items.requires_age_check
        )
        order by items.display_order, items.created_at, items.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      string_agg(
        items.reward_name || ': ' || coalesce(
          nullif(items.reward_terms, ''),
          'No additional exclusions configured.'
        ) || case when items.requires_age_check
          then ' Photo ID needed (18+).'
          else ''
        end,
        E'\n'
        order by items.display_order, items.created_at, items.id
      ),
      'Ask the venue team for the current reward pool. Issued rewards retain their own recorded terms.'
    )
  into v_pool, v_pool_body
  from public.reward_pool_items items
  where items.loyalty_card_id = v_card.id
    and items.is_active;

  select coalesce(
    string_agg(
      format(
        '%s %s–%s Europe/London.%s',
        case windows.isodow
          when 1 then 'Monday'
          when 2 then 'Tuesday'
          when 3 then 'Wednesday'
          when 4 then 'Thursday'
          when 5 then 'Friday'
          when 6 then 'Saturday'
          when 7 then 'Sunday'
        end,
        to_char(windows.starts_at, 'HH24:MI'),
        to_char(windows.ends_at, 'HH24:MI'),
        case when upgrades.id is not null and upgrades.is_active then
          ' Upgrade: ' || upgrades.reward_name || '. ' || upgrades.reward_terms
            || case when upgrades.requires_age_check
              then ' Photo ID needed (18+).'
              else ''
            end
        else ' No upgrade configured.' end
      ),
      E'\n'
      order by windows.isodow, windows.starts_at, windows.id
    ),
    'No collection windows configured. Ordinary collection does not require a collection window.'
  )
  into v_windows_body
  from public.venue_collection_windows windows
  left join public.reward_pool_items upgrades
    on upgrades.id = windows.upgrade_pool_item_id
   and upgrades.merchant_id = windows.merchant_id
   and upgrades.location_id = windows.location_id
  where windows.merchant_id = new.merchant_id
    and windows.location_id = v_card.location_id
    and windows.is_active;

  new.terms_snapshot := jsonb_build_object(
    'merchant_name', v_merchant_name,
    'card_name', v_card.card_name,
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'joining',
        'title', 'Joining the card',
        'body', 'Join by verifying your mobile phone number and accepting these venue terms and the Nabaperks customer terms after being shown the privacy notice. Marketing is optional and is not required to keep the card, collect stamps, or redeem an eligible reward.'
      ),
      jsonb_build_object(
        'id', 'earning-rule',
        'title', 'Earning rule',
        'body', format(
          'Collect %s normal visit stamps using a valid venue QR. %s These are the venue’s earning terms; Nabaperks does not check spend or transaction totals. Only one normal visit stamp can be earned for this venue location on each venue trading day, using the venue’s Europe/London daily reset. The daily reset is %s Europe/London time. A valid QR join normally attempts to add the first eligible stamp.',
          v_card.stamps_required,
          private.loyalty_earning_terms_text(v_card.id),
          to_char(v_trading_day_starts_at, 'HH24:MI')
        )
      ),
      jsonb_build_object(
        'id', 'reward',
        'title', 'Reward selection',
        'body', 'When you earn the final stamp, your first completed cycle receives the venue''s first active configured reward. Later completed cycles use the venue''s configured reward weightings. The final stamp issues the reward and immediately opens a fresh card; an uncollected reward does not lock earning. The assigned reward, earning terms and age-check policy are fixed when it is issued. Existing issued rewards retain their recorded terms.'
      ),
      jsonb_build_object(
        'id', 'redemption',
        'title', 'Redemption',
        'body', 'Cycle rewards are collectable from the next venue trading day, including weekends when the venue trades. One standard reward can be collected per venue trading day. A configured collection window may offer a displayed bonus or upgrade; eligibility and the collection deadline are shown on the reward. Cycle rewards use the expiry configured when issued; use the displayed expiry for each reward. Provide your full name and date of birth and be at least 18. Email is optional; if supplied, it must be verified. Photo ID is required only for rewards marked as age checked. Show the reward QR for the venue team to scan. ' ||
          case when v_card.reward_expires_after_days is null
            then 'No expiry is configured for new cycle rewards.'
            else format(
              'New cycle rewards expire after %s days.',
              v_card.reward_expires_after_days
            )
          end
      ),
      jsonb_build_object(
        'id', 'reward-pool',
        'title', 'Current reward pool',
        'body', v_pool_body,
        'items', v_pool
      ),
      jsonb_build_object(
        'id', 'collection-windows',
        'title', 'Collection windows',
        'body', v_windows_body
      ),
      jsonb_build_object(
        'id', 'exclusions',
        'title', 'Exclusions',
        'body', coalesce(
          nullif(btrim(v_card.reward_terms), ''),
          'No additional exclusions configured.'
        )
      ),
      jsonb_build_object(
        'id', 'referrals-and-additional-rewards',
        'title', 'Referrals and additional rewards',
        'body', 'Where referrals are available, a referral qualifies only after a genuinely new member receives a normal venue visit stamp. A qualifying referral can add one bonus stamp to the referrer''s card, subject to a limit of two referral bonus stamps on one Europe/London date and availability, capacity, and fraud checks. The venue may also issue birthday or direct rewards with their own displayed terms and expiry.'
      ),
      jsonb_build_object(
        'id', 'fraud-and-abuse',
        'title', 'Location, fraud, and corrections',
        'body', 'The venue may enable a soft location check. Refusing location, receiving an inaccurate result, or encountering a timeout does not by itself stop the stamp. Nabaperks and the venue may review QR misuse, duplicate claims, unusual stamp speed, out-of-range location evidence, manual adjustments, or concentrated referral activity. Audited support actions may correct the ledger.'
      ),
      jsonb_build_object(
        'id', 'availability',
        'title', 'Availability',
        'body', 'New joins, stamps and reward issue may pause when the venue, card, QR or subscription is inactive. Rewards issued before suspension remain collectable for a 30-day grace period from suspension, with their deadline extended to the end of that period; collection rules still apply. Check the reward for its current availability.'
      ),
      jsonb_build_object(
        'id', 'merchant-contact',
        'title', 'Merchant contact',
        'body', v_merchant_contact
      )
    )
  );
  new.terms_sha256 := encode(
    extensions.digest(new.terms_snapshot::text, 'sha256'),
    'hex'
  );
  return new;
end;
$function$;
revoke all on function public.apply_customer_legal_terms_snapshot_v20260926()
  from public, anon, authenticated;
grant execute on function public.apply_customer_legal_terms_snapshot_v20260926()
  to service_role;

drop trigger if exists customer_terms_apply_v20260926_snapshot
  on public.customer_loyalty_terms_acceptances;
create trigger customer_terms_apply_v20260926_snapshot
before insert on public.customer_loyalty_terms_acceptances
for each row execute function public.apply_customer_legal_terms_snapshot_v20260926();

notify pgrst, 'reload schema';
