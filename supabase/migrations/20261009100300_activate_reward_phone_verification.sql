-- QA BUG-008 (38c42a1..2c45031): terms 2026-09-28.1 require a verified mobile
-- phone before reward collection, but 20261007100200 shipped the database
-- switch off, so only the customer qr.png route enforced it. The database, the
-- staff console badge and the reward_ready producer still treated wallets
-- without a verified phone as ready. Owner decision (Q1): turn the switch on.
--
-- With the switch on, private.reward_collection_state reports such a reward as
-- blocked with 'Complete your profile before redeeming' (a setup block), so:
--   * get_reward_collection_states and the staff badge show it as unavailable;
--   * list_pending_reward_notification_candidates no longer offers it for
--     reward_ready (the expiry warning still goes out for a setup block);
--   * the existing triggers reward_scan_tokens_require_verified_phone and
--     reward_events_redeem_require_verified_phone refuse minting and
--     collection. They are unchanged here.
-- The deployed app (2c45031c) already answers that setup block on the reward
-- page with the phone step and a 409 from qr.png.

create or replace function private.reward_phone_verification_required()
returns boolean
language sql
stable
set search_path = pg_catalog
as $$ select true $$;

revoke all on function private.reward_phone_verification_required()
  from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
