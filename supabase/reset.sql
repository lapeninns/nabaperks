-- Wipe all application data. Schema, functions, and RLS policies are preserved.
do $$
declare
  table_list text;
begin
  -- Registry tables are reference data owned by a migration, not application
  -- data, so they are excluded here. `db:migrate` is ledger-aware and will not
  -- replay an already-applied migration, and `seed.sql` does not recreate
  -- them, so truncating these empties them permanently: every later
  -- `record_operational_cron_run()` call then trips
  -- operational_cron_runs_job_name_fkey and `pnpm test:db` cannot pass after a
  -- `pnpm db:reset`.
  select string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename)
  into table_list
  from pg_tables
  where schemaname = 'public'
    and tablename not in (
      'operational_cron_jobs',
      'personal_data_relation_manifest'
    );

  if table_list is not null then
    execute 'truncate table ' || table_list || ' restart identity cascade';
  end if;
end $$;

-- Remove auth users (test signups, seed fixtures, sessions).
delete from auth.users;
