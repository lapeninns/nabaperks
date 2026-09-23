-- Nabaperks production research queries (Phase 2)
-- Run 2026-09-19 (Europe/London) against the linked Supabase project via
--   node scripts/supabase-linked.mjs db query --linked "set local transaction_read_only = on; <query>"
-- using the Homebrew Supabase CLI 2.117.0. Every statement below ran inside a
-- read-only transaction (Q001 returns transaction_read_only = on). A wrapper
-- refused anything that was not a single SELECT/WITH statement; one merchant
-- profile query was refused before execution (a ';' in a string literal) and
-- re-issued as Q015. Aggregates only; the reports suppress cells under 5 members.
-- Numbering is execution order; results are summarised in 02-production-findings.md.

-- [Q001] Connection sanity: server time, role, timezone, and proof the transaction is read-only
-- run at 2026-09-19 17:39 (Europe/London), read-only transaction, linked project via Supabase CLI
select now() as server_now, (now() at time zone 'Europe/London')::text as london_now, current_user, current_setting('TimeZone') as tz, current_setting('transaction_read_only') as txn_read_only, version() as pg;

-- [Q002] Table inventory with live row estimates (public schema)
-- run at 2026-09-19 17:40 (Europe/London), read-only transaction, linked project via Supabase CLI
select relname as table_name, n_live_tup as est_rows from pg_stat_user_tables where schemaname = 'public' order by n_live_tup desc, relname;

-- [Q003] Enum types and labels
-- run at 2026-09-19 17:40 (Europe/London), read-only transaction, linked project via Supabase CLI
select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) as labels from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'public' group by t.typname order by t.typname;

-- [Q004] Table inventory with live row estimates (public schema), compact re-run
-- run at 2026-09-19 17:40 (Europe/London), read-only transaction, linked project via Supabase CLI
select relname as table_name, n_live_tup as est_rows from pg_stat_user_tables where schemaname = 'public' order by n_live_tup desc, relname;

-- [Q005] Column listing for every public table (one row per table)
-- run at 2026-09-19 17:40 (Europe/London), read-only transaction, linked project via Supabase CLI
select table_name, string_agg(column_name || ':' || case when data_type = 'timestamp with time zone' then 'tstz' when data_type = 'character varying' then 'varchar' else data_type end, ', ' order by ordinal_position) as columns from information_schema.columns where table_schema = 'public' group by table_name order by table_name;

-- [Q006] Check constraints (status/source vocabularies) on public tables
-- run at 2026-09-19 17:40 (Europe/London), read-only transaction, linked project via Supabase CLI
select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition from pg_constraint where contype = 'c' and connamespace = 'public'::regnamespace and (pg_get_constraintdef(oid) ilike '%any (array%' or pg_get_constraintdef(oid) ilike '%in (%') order by 1, 2;

-- [Q007] stamp_events by event_type with date span
-- run at 2026-09-19 17:41 (Europe/London), read-only transaction, linked project via Supabase CLI
select event_type, count(*) as n, sum(stamps_delta) as delta_sum, min(created_at)::date as first_at, max(created_at)::date as last_at from stamp_events group by 1 order by 1;

-- [Q008] stamp_events metadata key frequency
-- run at 2026-09-19 17:41 (Europe/London), read-only transaction, linked project via Supabase CLI
select k as metadata_key, count(*) as n from stamp_events, jsonb_object_keys(coalesce(metadata,'{}'::jsonb)) k group by 1 order by 2 desc;

-- [Q009] reward_events by source and status
-- run at 2026-09-19 17:41 (Europe/London), read-only transaction, linked project via Supabase CLI
select source, status, count(*) as n, min(created_at)::date as first_at, max(created_at)::date as last_at from reward_events group by 1,2 order by 1,2;

-- [Q010] reward_events metadata key frequency
-- run at 2026-09-19 17:41 (Europe/London), read-only transaction, linked project via Supabase CLI
select k as metadata_key, count(*) as n from reward_events, jsonb_object_keys(coalesce(metadata,'{}'::jsonb)) k group by 1 order by 2 desc;

-- [Q011] product_events by event_name (join-funnel candidates)
-- run at 2026-09-19 17:41 (Europe/London), read-only transaction, linked project via Supabase CLI
select event_name, actor_type, count(*) as n, min(occurred_at)::date as first_at, max(occurred_at)::date as last_at from product_events group by 1,2 order by 3 desc;

-- [Q012] notification_events by type, category and status
-- run at 2026-09-19 17:41 (Europe/London), read-only transaction, linked project via Supabase CLI
select event_type, category, status, count(*) as n from notification_events group by 1,2,3 order by 1,3;

-- [Q013] audit_logs by action and actor_type
-- run at 2026-09-19 17:41 (Europe/London), read-only transaction, linked project via Supabase CLI
select action, actor_type, target_table, count(*) as n from audit_logs group by 1,2,3 order by 4 desc limit 60;

-- [Q014] Count of customers whose email/name looks like test data (aggregate only)
-- run at 2026-09-19 17:41 (Europe/London), read-only transaction, linked project via Supabase CLI
select count(*) filter (where email ilike '%test%' or email ilike '%example.%' or email ilike '%+%' or full_name ilike '%test%' or full_name ilike '%demo%') as testish_customers, count(*) filter (where email ilike '%nabaperks%' or email ilike '%lapen%') as internal_domain_customers, count(*) as total_customers, count(*) filter (where phone_verified_at is not null) as phone_verified, count(*) filter (where email_verified_at is not null) as email_verified, count(*) filter (where date_of_birth is not null) as has_dob, count(*) filter (where date_of_birth_verified_at is not null) as dob_verified from customers;

-- [Q015] Merchant/venue profile: status, billing, card settings, activity counts (no PII)
-- run at 2026-09-19 17:42 (Europe/London), read-only transaction, linked project via Supabase CLI
select m.id, m.business_name, m.business_type, m.status, m.requires_billing, m.created_at::date as merchant_created, b.status as billing_status, b.stripe_subscription_status as stripe_status, b.plan, (select count(*) from merchant_locations l where l.merchant_id = m.id) as locations, (select string_agg(lc.stamps_required::text || '/' || coalesce(lc.reward_expires_after_days::text,'null') || '/' || lc.is_active::text || '/bday=' || lc.birthday_reward_enabled::text, ' | ') from loyalty_cards lc where lc.merchant_id = m.id) as card_req_expiry_active_bday, (select count(*) from reward_pool_items p where p.merchant_id = m.id and p.is_active) as active_pool_items, (select count(*) from customer_memberships cm where cm.merchant_id = m.id) as members, (select count(*) from stamp_events se where se.merchant_id = m.id and se.event_type = 'earned') as stamps_earned, (select min(se.created_at)::date from stamp_events se where se.merchant_id = m.id) as first_stamp, (select max(se.created_at)::date from stamp_events se where se.merchant_id = m.id) as last_stamp, (select count(*) from reward_events re where re.merchant_id = m.id) as rewards, (select count(*) from qr_codes q where q.merchant_id = m.id and q.is_active) as active_qrs from merchants m left join billing_customers b on b.merchant_id = m.id order by members desc;

-- [Q016] Members joined per merchant per day (Europe/London) - burst detection
-- run at 2026-09-19 17:42 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, (created_at at time zone 'Europe/London')::date as join_day, count(*) as joins from customer_memberships group by 1,2 having count(*) >= 5 order by 1,2;

-- [Q017] Stamp source / location_status / geo distribution
-- run at 2026-09-19 17:42 (Europe/London), read-only transaction, linked project via Supabase CLI
select metadata->>'source' as source, metadata->>'location_status' as location_status, metadata->>'geo_verification' as geo_verification, metadata->>'geo_flagged' as geo_flagged, count(*) as n from stamp_events where event_type = 'earned' group by 1,2,3,4 order by 5 desc;

-- [Q018] Reward selection_mode, source and redeemed_by distribution
-- run at 2026-09-19 17:42 (Europe/London), read-only transaction, linked project via Supabase CLI
select source, metadata->>'selection_mode' as selection_mode, metadata->>'source' as meta_source, metadata->>'redeemed_by' as redeemed_by, status, count(*) as n from reward_events group by 1,2,3,4,5 order by 6 desc;

-- [Q019] Customers created per London day since 2026-08-01 (identity burst check)
-- run at 2026-09-19 17:42 (Europe/London), read-only transaction, linked project via Supabase CLI
select (created_at at time zone 'Europe/London')::date as day, count(*) as customers from customers where created_at >= '2026-08-01' group by 1 order by 1;

-- [Q020] Referrals by status and hold_reason
-- run at 2026-09-19 17:42 (Europe/London), read-only transaction, linked project via Supabase CLI
select status, hold_reason, count(*) as n from referrals group by 1,2 order by 3 desc;

-- [Q021] Latest applied migrations on the linked project
-- run at 2026-09-19 17:42 (Europe/London), read-only transaction, linked project via Supabase CLI
select version, name from supabase_migrations.schema_migrations order by version desc limit 5;

-- [Q022] Live definition of public.uk_business_date and next_uk_business_date
-- run at 2026-09-19 17:42 (Europe/London), read-only transaction, linked project via Supabase CLI
select p.proname, pg_get_functiondef(p.oid) as def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('uk_business_date','next_uk_business_date');

-- [Q023] Venue profile: members, recently active, first-stamp and second-visit conversion (visit stamps exclude referral_bonus)
-- run at 2026-09-19 17:44 (Europe/London), read-only transaction, linked project via Supabase CLI
with m as (select cm.id, cm.merchant_id, cm.created_at, (select count(*) from stamp_events se where se.membership_id = cm.id and se.event_type = 'earned' and coalesce(se.metadata->>'source','') <> 'referral_bonus') as visit_stamps, (select count(distinct (se.created_at at time zone 'Europe/London')::date) from stamp_events se where se.membership_id = cm.id and se.event_type = 'earned' and coalesce(se.metadata->>'source','') <> 'referral_bonus') as visit_days, (select max(se.created_at) from stamp_events se where se.membership_id = cm.id) as last_stamp_at from customer_memberships cm) select merchant_id, count(*) as members, count(*) filter (where created_at >= now() - interval '7 days') as joined_7d, count(*) filter (where last_stamp_at >= now() - interval '7 days') as active_7d, count(*) filter (where last_stamp_at >= now() - interval '14 days') as active_14d, count(*) filter (where visit_stamps >= 1) as with_first_stamp, count(*) filter (where visit_days >= 2) as with_2nd_visit_day, count(*) filter (where visit_days >= 3) as with_3rd_visit_day, count(*) filter (where visit_days >= 4) as with_4th_visit_day, round(100.0 * count(*) filter (where visit_stamps >= 1) / count(*), 1) as pct_join_to_first_stamp, round(100.0 * count(*) filter (where visit_days >= 2) / nullif(count(*) filter (where visit_stamps >= 1), 0), 1) as pct_first_to_second_visit from m group by 1 order by 2 desc;

-- [Q024] Overall: members, second-visit conversion, and members whose join is older than 7 days (had time to return)
-- run at 2026-09-19 17:44 (Europe/London), read-only transaction, linked project via Supabase CLI
with m as (select cm.id, cm.created_at, (select count(distinct (se.created_at at time zone 'Europe/London')::date) from stamp_events se where se.membership_id = cm.id and se.event_type = 'earned' and coalesce(se.metadata->>'source','') <> 'referral_bonus') as visit_days from customer_memberships cm) select count(*) as members, count(*) filter (where visit_days >= 2) as returned_once, count(*) filter (where created_at < now() - interval '7 days') as joined_over_7d_ago, count(*) filter (where created_at < now() - interval '7 days' and visit_days >= 2) as of_those_returned, round(100.0 * count(*) filter (where created_at < now() - interval '7 days' and visit_days >= 2) / nullif(count(*) filter (where created_at < now() - interval '7 days'),0),1) as pct_returned_of_7d_cohort from m;

-- [Q025] Visit stamps by day of week (Europe/London) per venue
-- run at 2026-09-19 17:44 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, extract(isodow from created_at at time zone 'Europe/London') as dow_n, to_char(created_at at time zone 'Europe/London', 'Dy') as dow, count(*) as stamps, count(distinct membership_id) as members from stamp_events where event_type = 'earned' and coalesce(metadata->>'source','') <> 'referral_bonus' group by 1,2,3 order by 1,2;

-- [Q026] Visit stamps by hour of day (Europe/London) per venue
-- run at 2026-09-19 17:44 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, extract(hour from created_at at time zone 'Europe/London') as hr, count(*) as stamps, count(distinct membership_id) as members from stamp_events where event_type = 'earned' and coalesce(metadata->>'source','') <> 'referral_bonus' group by 1,2 order by 1,2;

-- [Q027] Overall visit stamps by day of week and hour (Europe/London)
-- run at 2026-09-19 17:44 (Europe/London), read-only transaction, linked project via Supabase CLI
select extract(isodow from created_at at time zone 'Europe/London') as dow_n, extract(hour from created_at at time zone 'Europe/London') as hr, count(*) as stamps from stamp_events where event_type = 'earned' and coalesce(metadata->>'source','') <> 'referral_bonus' group by 1,2 order by 1,2;

-- [Q028] Distinct London dates with any visit stamp per venue, by day of week (how many Mondays etc. observed)
-- run at 2026-09-19 17:44 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, extract(isodow from created_at at time zone 'Europe/London') as dow_n, count(distinct (created_at at time zone 'Europe/London')::date) as days_observed from stamp_events where event_type = 'earned' group by 1,2 order by 1,2;

-- [Q029] Visit rhythm: distribution of days between a member's consecutive visit days (London dates, referral bonus excluded)
-- run at 2026-09-19 17:46 (Europe/London), read-only transaction, linked project via Supabase CLI
with v as (select membership_id, merchant_id, (created_at at time zone 'Europe/London')::date as d from stamp_events where event_type = 'earned' and coalesce(metadata->>'source','') <> 'referral_bonus' group by 1,2,3), g as (select membership_id, d - lag(d) over (partition by membership_id order by d) as gap from v) select gap as days_between_visits, count(*) as n_gaps, count(distinct membership_id) as members from g where gap is not null group by 1 order by 1;

-- [Q030] Visit rhythm segments per venue (one_time = 1 visit day; weekly_plus = avg gap <= 7d; fortnightly = 7-14d; observation window is only ~15 days)
-- run at 2026-09-19 17:46 (Europe/London), read-only transaction, linked project via Supabase CLI
with v as (select membership_id, merchant_id, (created_at at time zone 'Europe/London')::date as d from stamp_events where event_type = 'earned' and coalesce(metadata->>'source','') <> 'referral_bonus' group by 1,2,3), s as (select membership_id, merchant_id, count(*) as visit_days, (max(d) - min(d))::numeric / nullif(count(*) - 1, 0) as avg_gap from v group by 1,2) select merchant_id, count(*) as members_with_visits, count(*) filter (where visit_days = 1) as one_time, count(*) filter (where visit_days > 1 and avg_gap <= 7) as weekly_plus, count(*) filter (where visit_days > 1 and avg_gap > 7 and avg_gap <= 14) as fortnightly, count(*) filter (where visit_days > 1 and avg_gap > 14) as monthly_plus from s group by 1 order by 2 desc;

-- [Q031] Visit rhythm segments overall, and for the cohort that joined 7+ days ago
-- run at 2026-09-19 17:46 (Europe/London), read-only transaction, linked project via Supabase CLI
with v as (select membership_id, (created_at at time zone 'Europe/London')::date as d from stamp_events where event_type = 'earned' and coalesce(metadata->>'source','') <> 'referral_bonus' group by 1,2), s as (select v.membership_id, cm.created_at as joined_at, count(*) as visit_days, (max(d) - min(d))::numeric / nullif(count(*) - 1, 0) as avg_gap from v join customer_memberships cm on cm.id = v.membership_id group by 1,2) select case when joined_at < now() - interval '7 days' then 'joined_7plus_days_ago' else 'joined_last_7_days' end as cohort, count(*) as members_with_visits, count(*) filter (where visit_days = 1) as one_time, count(*) filter (where visit_days > 1 and avg_gap <= 7) as weekly_plus, count(*) filter (where visit_days > 1 and avg_gap > 7 and avg_gap <= 14) as fortnightly, count(*) filter (where visit_days > 1 and avg_gap > 14) as monthly_plus from s group by 1 order by 1;

-- [Q032] Card funnel per venue: cycles started, reached 1/2/3 stamps, median days first->completing stamp
-- run at 2026-09-19 17:46 (Europe/London), read-only transaction, linked project via Supabase CLI
with c as (select membership_id, merchant_id, cycle_number, sum(stamps_delta) filter (where event_type = 'earned') as stamps, min(created_at) as first_at, max(created_at) as last_at from stamp_events group by 1,2,3) select merchant_id, count(*) as cycles_started, count(*) filter (where stamps >= 1) as reached_1, count(*) filter (where stamps >= 2) as reached_2, count(*) filter (where stamps >= 3) as reached_3_completed, round((percentile_cont(0.5) within group (order by extract(epoch from (last_at - first_at)) / 86400.0) filter (where stamps >= 3))::numeric, 1) as median_days_to_complete, round((percentile_cont(0.5) within group (order by extract(epoch from (now() - last_at)) / 86400.0) filter (where stamps = 2))::numeric, 1) as median_days_stale_at_2, round((percentile_cont(0.5) within group (order by extract(epoch from (now() - last_at)) / 86400.0) filter (where stamps = 1))::numeric, 1) as median_days_stale_at_1 from c group by 1 order by 2 desc;

-- [Q033] Where members sit now: current_stamp_count vs whether an unlocked cycle reward exists (locked full cards)
-- run at 2026-09-19 17:46 (Europe/London), read-only transaction, linked project via Supabase CLI
select cm.merchant_id, cm.current_stamp_count, cm.active_cycle_number, exists (select 1 from reward_events re where re.membership_id = cm.id and re.source = 'stamp_cycle' and re.status = 'unlocked') as has_open_cycle_reward, count(*) as members from customer_memberships cm group by 1,2,3,4 order by 1,3,2;

-- [Q034] Cycle number distribution: how many members are on cycle 2+ and stamps in cycle 2+
-- run at 2026-09-19 17:46 (Europe/London), read-only transaction, linked project via Supabase CLI
select cycle_number, count(distinct membership_id) as members, count(*) as earned_stamps from stamp_events where event_type = 'earned' group by 1 order by 1;

-- [Q035] Rewards per venue and source: issued/redeemed/expired/cancelled/open, open past expiry, median days issue->redeem, ready-delay in days
-- run at 2026-09-19 17:47 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, source, count(*) as issued, count(*) filter (where status = 'redeemed') as redeemed, count(*) filter (where status = 'expired') as expired, count(*) filter (where status = 'cancelled') as cancelled, count(*) filter (where status = 'unlocked') as open, count(*) filter (where status = 'unlocked' and expires_at < now()) as open_past_expiry, round((percentile_cont(0.5) within group (order by extract(epoch from (redeemed_at - created_at)) / 86400.0) filter (where status = 'redeemed'))::numeric, 2) as median_days_to_redeem, round((avg(redeemable_from - (created_at at time zone 'Europe/London')::date))::numeric, 2) as avg_ready_delay_days, min(expires_at)::date as earliest_expiry from reward_events group by 1,2 order by 1,2;

-- [Q036] Ready delay distribution (redeemable_from minus issue London date) by issue weekday
-- run at 2026-09-19 17:47 (Europe/London), read-only transaction, linked project via Supabase CLI
select to_char(created_at at time zone 'Europe/London', 'Dy') as issued_dow, redeemable_from - (created_at at time zone 'Europe/London')::date as ready_delay_days, count(*) as n from reward_events where source = 'stamp_cycle' group by 1,2 order by min(extract(isodow from created_at at time zone 'Europe/London')), 2;

-- [Q037] Days between redeemable_from and actual redemption (London date), cycle rewards
-- run at 2026-09-19 17:47 (Europe/London), read-only transaction, linked project via Supabase CLI
select (redeemed_at at time zone 'Europe/London')::date - redeemable_from as days_after_ready, count(*) as n from reward_events where status = 'redeemed' and source = 'stamp_cycle' group by 1 order by 1;

-- [Q038] Redemptions by day of week and hour (Europe/London), all sources
-- run at 2026-09-19 17:47 (Europe/London), read-only transaction, linked project via Supabase CLI
select extract(isodow from redeemed_at at time zone 'Europe/London') as dow_n, extract(hour from redeemed_at at time zone 'Europe/London') as hr, count(*) as redemptions from reward_events where status = 'redeemed' group by 1,2 order by 1,2;

-- [Q039] Open (unlocked) cycle rewards: age buckets in days since issue, and days left to expiry
-- run at 2026-09-19 17:47 (Europe/London), read-only transaction, linked project via Supabase CLI
select width_bucket(extract(epoch from (now() - created_at)) / 86400.0, 0, 16, 8) as age_bucket_2d, count(*) as open_rewards, round(min(extract(epoch from (expires_at - now())) / 86400.0)::numeric, 1) as min_days_left, count(*) filter (where redeemable_from > (now() at time zone 'Europe/London')::date) as not_yet_ready from reward_events where status = 'unlocked' and source = 'stamp_cycle' group by 1 order by 1;

-- [Q040] product_events metadata keys for scan/card/stamp events (looking for lock/refusal telemetry)
-- run at 2026-09-19 17:47 (Europe/London), read-only transaction, linked project via Supabase CLI
select event_name, k as metadata_key, count(*) as n from product_events, jsonb_object_keys(coalesce(metadata,'{}'::jsonb)) k where event_name in ('qr_scanned','customer_card_viewed','stamp_issued','join_page_viewed','stamp_refused_location','reward_redeemed') group by 1,2 order by 1,3 desc;

-- [Q041] Lock cost proxy: members with a completed cycle, split by whether anything happened after completion (redeem or a later stamp), and how many still hold an unredeemed reward with no later activity
-- run at 2026-09-19 17:47 (Europe/London), read-only transaction, linked project via Supabase CLI
with comp as (select re.membership_id, re.merchant_id, re.created_at as completed_at, re.status, re.redeemed_at from reward_events re where re.source = 'stamp_cycle'), act as (select c.*, (select max(se.created_at) from stamp_events se where se.membership_id = c.membership_id and se.created_at > c.completed_at) as later_stamp_at, (select count(*) from product_events pe where pe.membership_id = c.membership_id and pe.event_name = 'customer_card_viewed' and pe.occurred_at > c.completed_at + interval '1 hour') as later_card_views from comp c) select merchant_id, count(*) as completed_cycles, count(*) filter (where status = 'redeemed') as redeemed, count(*) filter (where status = 'unlocked' and later_stamp_at is null and later_card_views = 0) as open_no_activity_since, count(*) filter (where status = 'unlocked' and later_card_views > 0 and later_stamp_at is null) as open_viewed_card_but_no_stamp, count(*) filter (where status = 'unlocked' and completed_at < now() - interval '7 days') as open_older_than_7d, round((percentile_cont(0.5) within group (order by extract(epoch from (now() - completed_at)) / 86400.0) filter (where status = 'unlocked'))::numeric, 1) as median_open_age_days from act group by 1 order by 2 desc;

-- [Q042] Post-reward behaviour: visit stamps in the 7 days before completion vs 7 days after redemption, for cycle rewards redeemed 7+ days ago
-- run at 2026-09-19 17:47 (Europe/London), read-only transaction, linked project via Supabase CLI
with r as (select re.membership_id, re.created_at as issued_at, re.redeemed_at from reward_events re where re.source = 'stamp_cycle' and re.status = 'redeemed' and re.redeemed_at <= now() - interval '7 days') select count(*) as rewards_in_scope, round(avg((select count(*) from stamp_events se where se.membership_id = r.membership_id and se.event_type = 'earned' and coalesce(se.metadata->>'source','') <> 'referral_bonus' and se.created_at >= r.issued_at - interval '7 days' and se.created_at < r.issued_at))::numeric, 2) as avg_visits_7d_before_completion, round(avg((select count(*) from stamp_events se where se.membership_id = r.membership_id and se.event_type = 'earned' and coalesce(se.metadata->>'source','') <> 'referral_bonus' and se.created_at > r.redeemed_at and se.created_at <= r.redeemed_at + interval '7 days'))::numeric, 2) as avg_visits_7d_after_redemption, count(*) filter (where exists (select 1 from stamp_events se where se.membership_id = r.membership_id and se.event_type = 'earned' and se.created_at > r.redeemed_at)) as members_with_any_visit_after_redemption from r;

-- [Q043] Reward mix: pool items per venue with issued and redeemed counts (reward names are product names, not PII)
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select p.merchant_id, p.reward_name, p.is_active, p.weight, p.display_order, count(re.id) as issued, count(re.id) filter (where re.status = 'redeemed') as redeemed, count(re.id) filter (where re.status = 'unlocked') as open from reward_pool_items p left join reward_events re on re.reward_pool_item_id = p.id group by 1,2,3,4,5 order by 1,5;

-- [Q044] Reward names for birthday and merchant_direct rewards (shown only when the same name appears 2+ times)
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select source, case when count(*) >= 2 then reward_name else '<distinct, suppressed>' end as reward_name, count(*) as n from reward_events where source <> 'stamp_cycle' group by source, reward_name order by 1, 3 desc;

-- [Q045] Goodwill/direct rewards per venue: count, distinct members, reason presence (reason text not printed), issued hour
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, count(*) as direct_rewards, count(distinct customer_id) as distinct_members, count(*) filter (where coalesce(metadata->>'reason','') <> '') as with_reason, count(distinct metadata->>'reason') as distinct_reasons, round(avg(length(metadata->>'reason'))::numeric,0) as avg_reason_len, count(*) filter (where status = 'redeemed') as redeemed, count(*) filter (where status = 'cancelled') as cancelled from reward_events where source = 'merchant_direct' group by 1 order by 2 desc;

-- [Q046] Goodwill/manual stamp events: operator_goodwill and admin adjustments (aggregate)
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select event_type, metadata->>'source' as source, count(*) as n, count(distinct membership_id) as members, count(*) filter (where coalesce(metadata->>'reason','') <> '') as with_reason from stamp_events where event_type <> 'earned' or metadata->>'source' in ('operator_goodwill') group by 1,2;

-- [Q047] Anomaly: members with more than one visit stamp on the same London date (should be impossible under NBS01)
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
with v as (select merchant_id, membership_id, (created_at at time zone 'Europe/London')::date as d, count(*) as n from stamp_events where event_type = 'earned' and coalesce(metadata->>'source','') <> 'referral_bonus' group by 1,2,3) select merchant_id, count(*) filter (where n > 1) as member_days_with_multiple_stamps, count(distinct membership_id) filter (where n > 1) as members_affected, max(n) as max_stamps_in_a_day from v group by 1 order by 2 desc;

-- [Q048] Anomaly: redemptions very soon after issue, before redeemable_from, and by actor
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select metadata->>'redeemed_by' as redeemed_by, count(*) as redemptions, count(*) filter (where redeemed_at - created_at < interval '60 seconds') as within_60s, count(*) filter (where redeemed_at - created_at < interval '10 minutes') as within_10m, count(*) filter (where (redeemed_at at time zone 'Europe/London')::date < redeemable_from) as before_ready_date, round(min(extract(epoch from (redeemed_at - created_at)) / 60.0)::numeric, 1) as min_minutes_to_redeem from reward_events where status = 'redeemed' group by 1;

-- [Q049] Redemption actor per venue: merchant scan vs self-service
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, count(*) filter (where metadata->>'redeemed_by' = 'merchant_scan') as merchant_scan, count(*) filter (where metadata->>'redeemed_by' = 'self_service') as self_service, count(*) as total from reward_events where status = 'redeemed' group by 1 order by 4 desc;

-- [Q050] Anomaly: customer sessions per device hash (how many distinct customers share one device)
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select customers_per_device, count(*) as devices from (select device_hash, count(distinct customer_id) as customers_per_device from customer_sessions where device_hash is not null group by 1) x group by 1 order by 1;

-- [Q051] Venue-code stamps per venue by entry context and distinct devices
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, entry_context, count(*) as receipts, count(distinct device_hash) as devices, count(distinct membership_id) as members from venue_code_stamp_receipts group by 1,2 order by 1,2;

-- [Q052] Fraud flags by venue, signal, severity, status
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, signal, severity, status, count(*) as n, count(distinct membership_id) as members from fraud_flags group by 1,2,3,4 order by 1,5 desc;

-- [Q053] Location refusal telemetry: reason and outcome
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select metadata->>'reason' as reason, metadata->>'outcome' as outcome, count(*) as n from product_events where event_name = 'stamp_refused_location' group by 1,2 order by 3 desc;

-- [Q054] Memberships per customer, and erased/incomplete customers (aggregate)
-- run at 2026-09-19 17:48 (Europe/London), read-only transaction, linked project via Supabase CLI
select (select count(*) from (select customer_id from customer_memberships group by 1 having count(*) > 1) x) as customers_with_2plus_memberships, (select count(*) from customers c where not exists (select 1 from customer_memberships cm where cm.customer_id = c.id)) as customers_without_membership, (select count(*) from customers where phone_hmac is null) as customers_no_phone_hash, (select count(*) from stamp_events where location_id is null) as stamps_without_location, (select count(*) from stamp_events where event_type = 'earned' and earned_business_date is null) as earned_without_business_date, (select count(*) from stamp_events where earned_business_date is not null and earned_business_date <> (created_at at time zone 'Europe/London')::date) as business_date_mismatch_london, (select count(*) from stamp_events where earned_business_date is not null and earned_business_date <> (created_at at time zone 'UTC')::date) as business_date_mismatch_utc;

-- [Q055] Join funnel per venue from product_events since 2026-09-04 (qr_scanned includes returning-member scans)
-- run at 2026-09-19 17:49 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, count(*) filter (where event_name = 'qr_scanned') as qr_scanned, count(*) filter (where event_name = 'join_page_viewed') as join_page_viewed, count(*) filter (where event_name = 'join_phone_requested') as otp_requested, count(*) filter (where event_name = 'join_otp_verified') as otp_verified, count(*) filter (where event_name = 'join_terms_accepted') as terms_accepted, count(*) filter (where event_name = 'customer_joined') as joined, count(*) filter (where event_name = 'join_first_stamp_issued') as first_stamp_issued, count(*) filter (where event_name = 'join_first_stamp_pending') as first_stamp_pending, count(*) filter (where event_name = 'customer_card_viewed') as card_viewed, count(*) filter (where event_name = 'stamp_issued') as stamp_issued from product_events where occurred_at >= '2026-09-04' group by 1 order by 7 desc;

-- [Q056] Join funnel per London day overall since 2026-09-04
-- run at 2026-09-19 17:49 (Europe/London), read-only transaction, linked project via Supabase CLI
select (occurred_at at time zone 'Europe/London')::date as day, count(*) filter (where event_name = 'qr_scanned') as qr_scanned, count(*) filter (where event_name = 'join_page_viewed') as join_page_viewed, count(*) filter (where event_name = 'join_phone_requested') as otp_requested, count(*) filter (where event_name = 'join_otp_verified') as otp_verified, count(*) filter (where event_name = 'customer_joined') as joined, count(*) filter (where event_name = 'join_first_stamp_issued') as first_stamp, count(*) filter (where event_name = 'stamp_issued') as stamps, count(*) filter (where event_name = 'reward_redeemed') as redeemed from product_events where occurred_at >= '2026-09-04' group by 1 order by 1;

-- [Q057] qr_scanned by availability/destination/src and join_page_viewed/customer_card_viewed by step (since 2026-09-04)
-- run at 2026-09-19 17:49 (Europe/London), read-only transaction, linked project via Supabase CLI
select event_name, coalesce(metadata->>'available', metadata->>'step') as dim1, coalesce(metadata->>'destination_type', metadata->>'surface') as dim2, coalesce(metadata->>'src', metadata->>'entry', metadata->>'source') as dim3, count(*) as n from product_events where occurred_at >= '2026-09-04' and event_name in ('qr_scanned','join_page_viewed','customer_card_viewed') group by 1,2,3,4 order by 1, 5 desc;

-- [Q058] notification_events metadata keys by status (to find cancellation reasons)
-- run at 2026-09-19 17:50 (Europe/London), read-only transaction, linked project via Supabase CLI
select status, k as metadata_key, count(*) as n from notification_events, jsonb_object_keys(coalesce(metadata,'{}'::jsonb)) k group by 1,2 order by 1,3 desc;

-- [Q059] notification_deliveries by status and failure_reason
-- run at 2026-09-19 17:50 (Europe/London), read-only transaction, linked project via Supabase CLI
select status, failure_reason, count(*) as n from notification_deliveries group by 1,2 order by 3 desc;

-- [Q060] Consent and reachability: preferences, push subscriptions, consent records by channel/status/source
-- run at 2026-09-19 17:50 (Europe/London), read-only transaction, linked project via Supabase CLI
select 'preferences' as kind, 'marketing_enabled' as dim, count(*) filter (where marketing_enabled) as n, count(*) as denom from notification_preferences union all select 'preferences', 'reminder_enabled', count(*) filter (where reminder_enabled), count(*) from notification_preferences union all select 'preferences', 'transactional_enabled', count(*) filter (where transactional_enabled), count(*) from notification_preferences union all select 'push_subscriptions', 'rows', count(*), count(*) from push_subscriptions union all select 'consent_records', channel || ':' || consent_status || ':' || coalesce(source,'?'), count(*), count(distinct customer_id) from consent_records group by channel, consent_status, source;

-- [Q061] Reward status by customer DOB state (age gate), and DOB verifications per venue
-- run at 2026-09-19 17:50 (Europe/London), read-only transaction, linked project via Supabase CLI
select re.source, re.status, (c.date_of_birth is not null) as has_dob, (c.date_of_birth_verified_at is not null) as dob_verified, c.date_of_birth_verification_source as verification_source, count(*) as n from reward_events re join customers c on c.id = re.customer_id group by 1,2,3,4,5 order by 1,2,6 desc;

-- [Q062] Birthday rewards: issue hour (London), birthday_year, redeemable_from delay
-- run at 2026-09-19 17:50 (Europe/London), read-only transaction, linked project via Supabase CLI
select extract(hour from created_at at time zone 'Europe/London') as issue_hour_london, birthday_year, redeemable_from - (created_at at time zone 'Europe/London')::date as ready_delay_days, (expires_at::date - (created_at at time zone 'Europe/London')::date) as expiry_days, count(*) as n from reward_events where source = 'birthday_month' group by 1,2,3,4 order by 5 desc;

-- [Q063] referral_bonus_held product events: hold reasons (aggregate)
-- run at 2026-09-19 17:50 (Europe/London), read-only transaction, linked project via Supabase CLI
select coalesce(metadata->>'hold_reason', metadata->>'reason') as hold_reason, count(*) as n, count(distinct membership_id) as memberships from product_events where event_name = 'referral_bonus_held' group by 1 order by 2 desc;

-- [Q064] Redemption rate of cycle rewards by member visit-rhythm segment (proxy for expiry risk: open rewards held by one-time vs regular visitors)
-- run at 2026-09-19 17:50 (Europe/London), read-only transaction, linked project via Supabase CLI
with v as (select membership_id, (created_at at time zone 'Europe/London')::date as d from stamp_events where event_type = 'earned' and coalesce(metadata->>'source','') <> 'referral_bonus' group by 1,2), s as (select membership_id, count(*) as visit_days, (max(d) - min(d))::numeric / nullif(count(*) - 1, 0) as avg_gap from v group by 1) select case when s.visit_days <= 3 then 'card_in_3_visits_no_extra' when s.avg_gap <= 3 then 'near_daily' when s.avg_gap <= 7 then 'weekly' else 'slower_than_weekly' end as segment, count(*) as cycle_rewards, count(*) filter (where re.status = 'redeemed') as redeemed, count(*) filter (where re.status = 'unlocked') as open, count(*) filter (where re.status = 'unlocked' and re.created_at < now() - interval '7 days') as open_older_than_7d, round(100.0 * count(*) filter (where re.status = 'redeemed') / count(*), 1) as pct_redeemed from reward_events re join s on s.membership_id = re.membership_id where re.source = 'stamp_cycle' group by 1 order by 2 desc;

-- [Q065] Per venue: share of visit stamps and redemptions falling Mon-Thu vs Fri-Sun, and Mon-Thu stamps by hour band (window feasibility)
-- run at 2026-09-19 17:54 (Europe/London), read-only transaction, linked project via Supabase CLI
with s as (select merchant_id, extract(isodow from created_at at time zone 'Europe/London') as dow, extract(hour from created_at at time zone 'Europe/London') as hr from stamp_events where event_type = 'earned' and coalesce(metadata->>'source','') <> 'referral_bonus'), r as (select merchant_id, extract(isodow from redeemed_at at time zone 'Europe/London') as dow from reward_events where status = 'redeemed') select s.merchant_id, count(*) as stamps, round(100.0 * count(*) filter (where dow <= 4) / count(*), 1) as pct_stamps_mon_thu, count(*) filter (where dow <= 4 and hr between 12 and 14) as monthu_12_14, count(*) filter (where dow <= 4 and hr between 15 and 17) as monthu_15_17, count(*) filter (where dow <= 4 and hr between 18 and 20) as monthu_18_20, count(*) filter (where dow <= 4 and hr >= 21) as monthu_21plus, (select count(*) from r where r.merchant_id = s.merchant_id) as redemptions, (select round(100.0 * count(*) filter (where dow <= 4) / nullif(count(*),0), 1) from r where r.merchant_id = s.merchant_id) as pct_redeem_mon_thu from s group by 1 order by 2 desc;

-- [Q066] Lock cost proxy: venue-QR scans by known members that happened while their card was full (between cycle-reward issue and redemption/now)
-- run at 2026-09-19 17:54 (Europe/London), read-only transaction, linked project via Supabase CLI
with locked as (select re.membership_id, re.merchant_id, re.created_at as locked_from, coalesce(re.redeemed_at, re.expired_at, now()) as locked_to from reward_events re where re.source = 'stamp_cycle' and re.status in ('unlocked','redeemed','expired')) select (select count(*) from product_events where event_name = 'qr_scanned' and membership_id is not null) as member_scans_total, (select count(*) from product_events where event_name = 'qr_scanned') as scans_total, count(*) as scans_while_locked, count(distinct pe.membership_id) as members_scanning_while_locked, count(distinct pe.membership_id) filter (where pe.occurred_at > l.locked_from + interval '6 hours') as members_scanning_locked_later_visit, count(*) filter (where (pe.occurred_at at time zone 'Europe/London')::date > (l.locked_from at time zone 'Europe/London')::date) as scans_on_a_later_day from product_events pe join locked l on l.membership_id = pe.membership_id and pe.occurred_at > l.locked_from and pe.occurred_at < l.locked_to where pe.event_name = 'qr_scanned';

-- [Q067] Lock cost proxy 2: distinct London days on which a locked member viewed their card (later day than completion, before redemption)
-- run at 2026-09-19 17:54 (Europe/London), read-only transaction, linked project via Supabase CLI
with locked as (select re.membership_id, re.created_at as locked_from, coalesce(re.redeemed_at, re.expired_at, now()) as locked_to from reward_events re where re.source = 'stamp_cycle'), v as (select pe.membership_id, (pe.occurred_at at time zone 'Europe/London')::date as d from product_events pe join locked l on l.membership_id = pe.membership_id and pe.occurred_at > l.locked_from and pe.occurred_at < l.locked_to where pe.event_name in ('customer_card_viewed','qr_scanned') and (pe.occurred_at at time zone 'Europe/London')::date > (l.locked_from at time zone 'Europe/London')::date group by 1,2) select count(*) as member_days_active_while_locked, count(distinct membership_id) as members from v;

-- [Q068] Members redeeming more than one reward on the same London date, and members holding 2+ open rewards
-- run at 2026-09-19 17:54 (Europe/London), read-only transaction, linked project via Supabase CLI
select (select count(*) from (select membership_id, (redeemed_at at time zone 'Europe/London')::date d, count(*) n from reward_events where status = 'redeemed' group by 1,2 having count(*) > 1) x) as member_days_with_2plus_redemptions, (select count(*) from (select membership_id, count(*) n from reward_events where status = 'unlocked' group by 1 having count(*) > 1) y) as members_with_2plus_open_rewards;

-- [Q069] Cycle rewards by issue weekday: ready delay, share redeemed on first ready day, median days to redeem
-- run at 2026-09-19 17:54 (Europe/London), read-only transaction, linked project via Supabase CLI
select case when extract(isodow from created_at at time zone 'Europe/London') <= 4 then 'issued_mon_thu' when extract(isodow from created_at at time zone 'Europe/London') = 5 then 'issued_fri' else 'issued_sat_sun' end as issue_group, count(*) as issued, round(avg(redeemable_from - (created_at at time zone 'Europe/London')::date)::numeric, 2) as avg_ready_delay_days, count(*) filter (where status = 'redeemed') as redeemed, count(*) filter (where status = 'redeemed' and (redeemed_at at time zone 'Europe/London')::date = redeemable_from) as redeemed_on_ready_day, round((percentile_cont(0.5) within group (order by extract(epoch from (redeemed_at - created_at)) / 86400.0) filter (where status = 'redeemed'))::numeric, 2) as median_days_issue_to_redeem, round(100.0 * count(*) filter (where status = 'redeemed') / count(*), 1) as pct_redeemed from reward_events where source = 'stamp_cycle' group by 1 order by 1;

-- [Q070] Visit stamps per venue per London date (activity time series)
-- run at 2026-09-19 17:55 (Europe/London), read-only transaction, linked project via Supabase CLI
select merchant_id, (created_at at time zone 'Europe/London')::date as day, count(*) as stamps from stamp_events where event_type = 'earned' and coalesce(metadata->>'source','') <> 'referral_bonus' group by 1,2 order by 1,2;

-- [Q071] Redeemed cycle rewards: did the member also earn a visit stamp on the redemption London date (before or after the redemption)?
-- run at 2026-09-19 17:55 (Europe/London), read-only transaction, linked project via Supabase CLI
select count(*) as redeemed_cycle_rewards, count(*) filter (where exists (select 1 from stamp_events se where se.membership_id = re.membership_id and se.event_type = 'earned' and coalesce(se.metadata->>'source','') <> 'referral_bonus' and (se.created_at at time zone 'Europe/London')::date = (re.redeemed_at at time zone 'Europe/London')::date)) as with_stamp_same_day, count(*) filter (where exists (select 1 from stamp_events se where se.membership_id = re.membership_id and se.event_type = 'earned' and coalesce(se.metadata->>'source','') <> 'referral_bonus' and se.created_at > re.redeemed_at and se.created_at < re.redeemed_at + interval '3 hours')) as stamped_within_3h_after, round((percentile_cont(0.5) within group (order by extract(epoch from (redeemed_at - created_at)) / 86400.0))::numeric, 2) as median_locked_days, round((percentile_cont(0.9) within group (order by extract(epoch from (redeemed_at - created_at)) / 86400.0))::numeric, 2) as p90_locked_days from reward_events re where re.source = 'stamp_cycle' and re.status = 'redeemed';

-- [Q072] Lock cost estimate: expected visits lost while locked = (member visit rate in the 14 days before completion) x (days locked), summed over cycle rewards, per venue
-- run at 2026-09-19 17:55 (Europe/London), read-only transaction, linked project via Supabase CLI
with r as (select re.id, re.merchant_id, re.membership_id, re.created_at as locked_from, coalesce(re.redeemed_at, re.expired_at, now()) as locked_to, cm.created_at as joined_at from reward_events re join customer_memberships cm on cm.id = re.membership_id where re.source = 'stamp_cycle'), rate as (select r.*, (select count(distinct (se.created_at at time zone 'Europe/London')::date) from stamp_events se where se.membership_id = r.membership_id and se.event_type = 'earned' and coalesce(se.metadata->>'source','') <> 'referral_bonus' and se.created_at < r.locked_from and se.created_at >= r.locked_from - interval '14 days') as visits_before, least(14.0, greatest(1.0, extract(epoch from (r.locked_from - r.joined_at)) / 86400.0)) as observed_days_before, extract(epoch from (r.locked_to - r.locked_from)) / 86400.0 as locked_days from r) select merchant_id, count(*) as cycle_rewards, round(sum(locked_days)::numeric, 1) as total_locked_days, round(avg(visits_before / observed_days_before)::numeric, 2) as avg_visits_per_day_before, round(sum(visits_before / observed_days_before * locked_days)::numeric, 1) as est_visits_lost_to_lock, round((sum(visits_before / observed_days_before * locked_days) / 3.0)::numeric, 1) as est_extra_rewards_no_lock_3stamp from rate group by 1 order by 2 desc;

-- [Q073] Lock cost estimate overall, split by redeemed vs still open
-- run at 2026-09-19 17:55 (Europe/London), read-only transaction, linked project via Supabase CLI
with r as (select re.id, re.status, re.membership_id, re.created_at as locked_from, coalesce(re.redeemed_at, re.expired_at, now()) as locked_to, cm.created_at as joined_at from reward_events re join customer_memberships cm on cm.id = re.membership_id where re.source = 'stamp_cycle'), rate as (select r.*, (select count(distinct (se.created_at at time zone 'Europe/London')::date) from stamp_events se where se.membership_id = r.membership_id and se.event_type = 'earned' and coalesce(se.metadata->>'source','') <> 'referral_bonus' and se.created_at < r.locked_from and se.created_at >= r.locked_from - interval '14 days') as visits_before, least(14.0, greatest(1.0, extract(epoch from (r.locked_from - r.joined_at)) / 86400.0)) as observed_days_before, extract(epoch from (r.locked_to - r.locked_from)) / 86400.0 as locked_days from r) select status, count(*) as cycle_rewards, round(sum(locked_days)::numeric, 1) as total_locked_days, round(avg(locked_days)::numeric, 2) as avg_locked_days, round(sum(visits_before / observed_days_before * locked_days)::numeric, 1) as est_visits_lost_to_lock from rate group by 1 order by 1;
