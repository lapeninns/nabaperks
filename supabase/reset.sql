-- Wipe all application data. Schema, functions, and RLS policies are preserved.
do $$
declare
  table_list text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ' order by tablename)
  into table_list
  from pg_tables
  where schemaname = 'public';

  if table_list is not null then
    execute 'truncate table ' || table_list || ' restart identity cascade';
  end if;
end $$;

-- Remove auth users (test signups, seed fixtures, sessions).
delete from auth.users;
