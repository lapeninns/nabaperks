delete from public.merchant_email_otp_aliases
 where alias_code !~ '^[0-9]{6}$';

alter table public.merchant_email_otp_aliases
  drop constraint if exists merchant_email_otp_aliases_alias_code_check;

alter table public.merchant_email_otp_aliases
  add constraint merchant_email_otp_aliases_alias_code_check
  check (alias_code ~ '^[0-9]{6}$');

alter table public.merchant_email_otp_aliases force row level security;

create table if not exists public.merchant_email_otp_alias_attempts (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  alias_code text not null,
  success boolean not null default false,
  attempted_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

create index if not exists merchant_email_otp_alias_attempts_failed_idx
  on public.merchant_email_otp_alias_attempts (email, attempted_at desc)
  where success = false;

create index if not exists merchant_email_otp_alias_attempts_created_idx
  on public.merchant_email_otp_alias_attempts (attempted_at);

alter table public.merchant_email_otp_alias_attempts enable row level security;
alter table public.merchant_email_otp_alias_attempts force row level security;

revoke all on table public.merchant_email_otp_alias_attempts from anon, authenticated;
grant select, insert, delete on table public.merchant_email_otp_alias_attempts to service_role;

create or replace function public.purge_merchant_email_otp_aliases(
  p_now timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  scrubbed_count integer := 0;
  deleted_count integer := 0;
  attempts_deleted_count integer := 0;
begin
  update public.merchant_email_otp_aliases aliases
     set supabase_token = ''
   where aliases.consumed_at is not null
     and aliases.supabase_token <> '';
  get diagnostics scrubbed_count = row_count;

  delete from public.merchant_email_otp_aliases aliases
   where aliases.expires_at <= p_now;
  get diagnostics deleted_count = row_count;

  delete from public.merchant_email_otp_alias_attempts attempts
   where attempts.attempted_at <= p_now - interval '1 day';
  get diagnostics attempts_deleted_count = row_count;

  return scrubbed_count + deleted_count + attempts_deleted_count;
end;
$$;

revoke all on function public.purge_merchant_email_otp_aliases(timestamptz) from public;
grant execute on function public.purge_merchant_email_otp_aliases(timestamptz) to service_role;

create or replace function public.consume_merchant_email_otp_alias(
  p_email text,
  p_alias_code text
)
returns table (supabase_token text)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_email text := lower(trim(p_email));
  submitted_alias text := left(coalesce(p_alias_code, ''), 32);
  failed_attempt_count integer := 0;
  provider_token text;
begin
  perform public.purge_merchant_email_otp_aliases(now());

  select count(*)
    into failed_attempt_count
    from public.merchant_email_otp_alias_attempts attempts
   where attempts.email = normalized_email
     and attempts.success = false
     and attempts.attempted_at > now() - interval '15 minutes';

  if failed_attempt_count >= 5 then
    insert into public.merchant_email_otp_alias_attempts (
      email,
      alias_code,
      success
    )
    values (
      normalized_email,
      submitted_alias,
      false
    );
    return;
  end if;

  with candidate as (
    select candidate.id, candidate.supabase_token as token
      from public.merchant_email_otp_aliases candidate
     where candidate.email = normalized_email
       and candidate.alias_code = p_alias_code
       and candidate.consumed_at is null
       and candidate.expires_at > now()
     order by candidate.created_at desc
     limit 1
     for update skip locked
  ),
  consumed as (
    update public.merchant_email_otp_aliases aliases
       set consumed_at = now(),
           supabase_token = ''
      from candidate
     where aliases.id = candidate.id
     returning candidate.token
  )
  select consumed.token
    into provider_token
    from consumed;

  insert into public.merchant_email_otp_alias_attempts (
    email,
    alias_code,
    success
  )
  values (
    normalized_email,
    submitted_alias,
    provider_token is not null
  );

  if provider_token is null then
    return;
  end if;

  return query select provider_token as supabase_token;
end;
$$;

revoke all on function public.consume_merchant_email_otp_alias(text, text) from public;
grant execute on function public.consume_merchant_email_otp_alias(text, text) to service_role;
