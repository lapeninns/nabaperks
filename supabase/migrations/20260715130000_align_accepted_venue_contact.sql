create or replace function public.apply_customer_legal_terms_snapshot_v20260715()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_merchant_name text;
  v_card_name text;
  v_reward_terms text;
  v_stamps_required integer;
begin
  if new.policy_version <> '2026-07-15' then
    return new;
  end if;

  select
    merchants.business_name,
    loyalty_cards.card_name,
    loyalty_cards.reward_terms,
    loyalty_cards.stamps_required
  into
    v_merchant_name,
    v_card_name,
    v_reward_terms,
    v_stamps_required
  from public.merchants
  join public.loyalty_cards
    on loyalty_cards.id = new.loyalty_card_id
   and loyalty_cards.merchant_id = merchants.id
  where merchants.id = new.merchant_id;

  if v_merchant_name is null or v_stamps_required is null then
    raise exception 'Unable to build the accepted venue terms snapshot';
  end if;

  new.terms_snapshot := jsonb_build_object(
    'merchant_name', v_merchant_name,
    'card_name', v_card_name,
    'sections', jsonb_build_array(
      jsonb_build_object(
        'id', 'joining',
        'body', 'Join by verifying your mobile phone number and accepting these venue terms and the Nabaperks customer terms after being shown the privacy notice. Marketing is optional and is not required to keep the card, collect stamps, or redeem an eligible reward.'
      ),
      jsonb_build_object(
        'id', 'earning-rule',
        'body', format(
          'Collect %s normal visit stamps using a valid venue QR. Only one normal visit stamp can be earned for this venue location on each Europe/London calendar date. A valid QR join normally attempts to add the first eligible stamp.',
          v_stamps_required
        )
      ),
      jsonb_build_object(
        'id', 'reward',
        'body', 'When you earn the final stamp, your first completed cycle receives the venue''s first active configured reward. Later completed cycles use the venue''s configured reward weightings. The assigned reward and its terms are fixed when it is issued.'
      ),
      jsonb_build_object(
        'id', 'redemption',
        'body', 'A cycle reward is redeemable from the next Europe/London weekday after it is issued, skipping Saturday and Sunday. Before generating its reward QR, you must provide your full name and date of birth, be at least 18, have a verified email address, and complete a fresh email check for that reward. Show the reward QR at the counter for the venue team to scan.'
      ),
      jsonb_build_object(
        'id', 'exclusions',
        'body', coalesce(
          nullif(btrim(v_reward_terms), ''),
          'No additional exclusions configured.'
        )
      ),
      jsonb_build_object(
        'id', 'referrals-and-additional-rewards',
        'body', 'Where referrals are available, a referral qualifies only after a genuinely new member receives a normal venue visit stamp. A qualifying referral can add one bonus stamp to the referrer''s card, subject to a limit of two referral bonus stamps on one Europe/London date and availability, capacity, and fraud checks. The venue may also issue birthday or direct rewards with their own displayed terms and expiry.'
      ),
      jsonb_build_object(
        'id', 'fraud-and-abuse',
        'body', 'The venue may enable a soft location check. Refusing location, receiving an inaccurate result, or encountering a timeout does not by itself stop the stamp. Nabaperks and the venue may review QR misuse, duplicate claims, unusual stamp speed, out-of-range location evidence, manual adjustments, or concentrated referral activity. Audited support actions may correct the ledger.'
      ),
      jsonb_build_object(
        'id', 'availability',
        'body', 'New joins, stamps, reward issue, and redemption may be paused if the venue, card, or QR is inactive, the reward is not yet redeemable, or the venue''s Nabaperks subscription is not active or trialling.'
      ),
      jsonb_build_object(
        'id', 'merchant-contact',
        'body', 'Ask the venue team'
      )
    )
  );
  new.terms_sha256 := encode(
    extensions.digest(new.terms_snapshot::text, 'sha256'),
    'hex'
  );

  return new;
end;
$$;
