-- PostgreSQL does not create indexes on referencing columns automatically.
-- Cover later-added foreign keys so parent deletion/restriction checks do not
-- scan and lock whole child tables as these ledgers grow.

create index if not exists customer_join_stamp_recoveries_merchant_id_idx
  on public.customer_join_stamp_recoveries (merchant_id);

create index if not exists customer_terms_customer_id_idx
  on public.customer_loyalty_terms_acceptances (customer_id);

create index if not exists customer_terms_loyalty_card_id_idx
  on public.customer_loyalty_terms_acceptances (loyalty_card_id);

create index if not exists customer_terms_merchant_id_idx
  on public.customer_loyalty_terms_acceptances (merchant_id);

create index if not exists customer_terms_qr_code_id_idx
  on public.customer_loyalty_terms_acceptances (qr_code_id);

create index if not exists loyalty_invite_recipients_claimed_customer_id_idx
  on public.loyalty_invite_recipients (claimed_customer_id);

create index if not exists loyalty_invite_recipients_claimed_membership_id_idx
  on public.loyalty_invite_recipients (claimed_membership_id);

-- The only merchant-leading index on this table is partial
-- (loyalty_invite_recipients_once_idx: where status <> 'cancelled'), so the
-- merchant_id FK needs a complete index to cover cancelled rows too.
create index if not exists loyalty_invite_recipients_merchant_id_idx
  on public.loyalty_invite_recipients (merchant_id);

create index if not exists referrals_qualifying_stamp_id_idx
  on public.referrals (qualifying_stamp_id);

-- referred_customer_id only appears as the trailing column of the
-- (venue_id, referred_customer_id) uniqueness index, which cannot serve the
-- FK's child lookup on customer deletion.
create index if not exists referrals_referred_customer_id_idx
  on public.referrals (referred_customer_id);

create index if not exists referrals_referrer_customer_id_idx
  on public.referrals (referrer_customer_id);

create index if not exists referrals_referrer_stamp_event_id_idx
  on public.referrals (referrer_stamp_event_id);
