create table if not exists public.merchant_email_otp_aliases (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  alias_code text not null check (alias_code ~ '^[0-9]{4}$'),
  supabase_token text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

create unique index if not exists merchant_email_otp_aliases_active_code_idx
  on public.merchant_email_otp_aliases (email, alias_code)
  where consumed_at is null;

create index if not exists merchant_email_otp_aliases_expiry_idx
  on public.merchant_email_otp_aliases (expires_at);

alter table public.merchant_email_otp_aliases enable row level security;

revoke all on table public.merchant_email_otp_aliases from anon, authenticated;
grant select, insert, update, delete on table public.merchant_email_otp_aliases to service_role;

create or replace function public.consume_merchant_email_otp_alias(
  p_email text,
  p_alias_code text
)
returns table (supabase_token text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.merchant_email_otp_aliases aliases
     set consumed_at = now()
   where aliases.id = (
     select candidate.id
       from public.merchant_email_otp_aliases candidate
      where candidate.email = lower(trim(p_email))
        and candidate.alias_code = p_alias_code
        and candidate.consumed_at is null
        and candidate.expires_at > now()
      order by candidate.created_at desc
      limit 1
      for update skip locked
   )
   returning aliases.supabase_token;
end;
$$;

revoke all on function public.consume_merchant_email_otp_alias(text, text) from public;
grant execute on function public.consume_merchant_email_otp_alias(text, text) to service_role;
