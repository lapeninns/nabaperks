-- db staff excision: remove the unreachable staff subsystem (2026-07-06
-- audit + owner decision). staff_users (incl. pin_hash), add_staff_member,
-- set_staff_member_active, and is_staff_for_merchant are reachable from
-- nothing: lib/merchant/staff-members.ts has zero importers, and no route or
-- page touches any of it. The prior architecture audit already flagged ~700
-- lines of dead staff-PIN SQL; this removes the remaining perimeter.
--
-- Implementation-time finding: is_staff_for_merchant is referenced by NINE
-- SELECT policies (the audit's policy-name scan undercounted — the _scoped
-- predicates carry a staff arm too). Each is recreated byte-equivalent minus
-- that arm; the two _staff_-named policies are renamed to _owner_admin.
-- Owner/admin/customer access is unchanged: the removed arm could never be
-- true (no staff_users rows are reachable through any live flow).
--
-- Historical staff-PIN migrations gained to_regclass replay guards in the
-- same change (the initial migration is skipped on replays, so it never
-- re-creates staff_users after this drop).
--
-- actor_type CHECK values 'staff' on audit_logs/product_events stay:
-- history-bearing enums keep their historical vocabulary.
--
-- Idempotent: re-running on an already-migrated database is a no-op.

-- 1) Rewrite the nine staff-referencing SELECT policies.

drop policy if exists audit_logs_select_scoped on public.audit_logs;
create policy audit_logs_select_scoped on public.audit_logs
  for select to authenticated
  using (
    ((merchant_id is not null) and (select public.is_merchant_owner(audit_logs.merchant_id)))
    or (select public.is_internal_admin())
  );

drop policy if exists customer_memberships_select_scoped on public.customer_memberships;
create policy customer_memberships_select_scoped on public.customer_memberships
  for select to authenticated
  using (
    (select public.is_customer_owner(customer_memberships.customer_id))
    or (select public.is_merchant_owner(customer_memberships.merchant_id))
    or (select public.is_internal_admin())
  );

drop policy if exists loyalty_cards_select_scoped on public.loyalty_cards;
create policy loyalty_cards_select_scoped on public.loyalty_cards
  for select to authenticated
  using (
    (select public.is_merchant_owner(loyalty_cards.merchant_id))
    or (select public.customer_has_membership(loyalty_cards.merchant_id))
    or (select public.is_internal_admin())
  );

drop policy if exists merchant_locations_select_scoped on public.merchant_locations;
create policy merchant_locations_select_scoped on public.merchant_locations
  for select to authenticated
  using (
    (select public.is_merchant_owner(merchant_locations.merchant_id))
    or (select public.customer_has_membership(merchant_locations.merchant_id))
    or (select public.is_internal_admin())
  );

drop policy if exists merchants_select_owned_or_admin on public.merchants;
create policy merchants_select_owned_or_admin on public.merchants
  for select to authenticated
  using (
    (owner_user_id = (select auth.uid()))
    or (select public.customer_has_membership(merchants.id))
    or (select public.is_internal_admin())
  );

drop policy if exists qr_codes_select_owner_staff_admin on public.qr_codes;
drop policy if exists qr_codes_select_owner_admin on public.qr_codes;
create policy qr_codes_select_owner_admin on public.qr_codes
  for select to authenticated
  using (
    (select public.is_merchant_owner(qr_codes.merchant_id))
    or (select public.is_internal_admin())
  );

drop policy if exists reward_events_select_scoped on public.reward_events;
create policy reward_events_select_scoped on public.reward_events
  for select to authenticated
  using (
    (select public.is_customer_owner(reward_events.customer_id))
    or (select public.is_merchant_owner(reward_events.merchant_id))
    or (select public.is_internal_admin())
  );

drop policy if exists reward_pool_items_select_owner_staff_admin on public.reward_pool_items;
drop policy if exists reward_pool_items_select_owner_admin on public.reward_pool_items;
create policy reward_pool_items_select_owner_admin on public.reward_pool_items
  for select to authenticated
  using (
    (select public.is_merchant_owner(reward_pool_items.merchant_id))
    or (select public.is_internal_admin())
  );

drop policy if exists stamp_events_select_scoped on public.stamp_events;
create policy stamp_events_select_scoped on public.stamp_events
  for select to authenticated
  using (
    (select public.is_customer_owner(stamp_events.customer_id))
    or (select public.is_merchant_owner(stamp_events.merchant_id))
    or (select public.is_internal_admin())
  );

-- 2) Drop the staff RPCs and the RLS helper (nothing references them now).

drop function if exists public.add_staff_member(text, text);
drop function if exists public.set_staff_member_active(uuid, boolean);
drop function if exists public.is_staff_for_merchant(uuid, uuid);

-- 3) Drop the table.

drop table if exists public.staff_users;

notify pgrst, 'reload schema';
