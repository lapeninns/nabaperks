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
begin
  update public.merchant_email_otp_aliases aliases
     set supabase_token = ''
   where aliases.consumed_at is not null
     and aliases.supabase_token <> '';
  get diagnostics scrubbed_count = row_count;

  delete from public.merchant_email_otp_aliases aliases
   where aliases.expires_at <= p_now;
  get diagnostics deleted_count = row_count;

  return scrubbed_count + deleted_count;
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
begin
  perform public.purge_merchant_email_otp_aliases(now());

  return query
  with candidate as (
    select candidate.id, candidate.supabase_token as provider_token
      from public.merchant_email_otp_aliases candidate
     where candidate.email = lower(trim(p_email))
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
     returning candidate.provider_token
  )
  select consumed.provider_token as supabase_token
    from consumed;
end;
$$;

revoke all on function public.consume_merchant_email_otp_alias(text, text) from public;
grant execute on function public.consume_merchant_email_otp_alias(text, text) to service_role;
