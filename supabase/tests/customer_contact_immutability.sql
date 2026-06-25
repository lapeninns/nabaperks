begin;

delete from public.customers
where id in (
  '00000000-0000-0000-0000-00000000c101',
  '00000000-0000-0000-0000-00000000c102'
);

insert into public.customers (
  id,
  email,
  email_verified_at,
  full_name,
  date_of_birth,
  phone_hmac,
  phone_ciphertext,
  phone_last4,
  phone_country,
  phone_verified_at
) values (
  '00000000-0000-0000-0000-00000000c101',
  'verified@example.test',
  '2026-06-17T09:00:00Z',
  'Sam Verified',
  '1990-01-01',
  'phone-hmac-verified',
  'phone-ciphertext-verified',
  '3456',
  'GB',
  '2026-06-17T08:00:00Z'
);

update public.customers
set full_name = 'Sam Updated',
    date_of_birth = '1991-02-03'
where id = '00000000-0000-0000-0000-00000000c101';

do $$
begin
  begin
    update public.customers
    set email = 'changed@example.test'
    where id = '00000000-0000-0000-0000-00000000c101';
    raise exception 'verified email change unexpectedly succeeded';
  exception
    when others then
      if sqlerrm not like '%Verified email%' then
        raise;
      end if;
  end;

  begin
    update public.customers
    set email = null
    where id = '00000000-0000-0000-0000-00000000c101';
    raise exception 'verified email clear unexpectedly succeeded';
  exception
    when others then
      if sqlerrm not like '%Verified email%' then
        raise;
      end if;
  end;

  begin
    update public.customers
    set phone_hmac = 'phone-hmac-changed'
    where id = '00000000-0000-0000-0000-00000000c101';
    raise exception 'verified phone change unexpectedly succeeded';
  exception
    when others then
      if sqlerrm not like '%Verified phone%' then
        raise;
      end if;
  end;
end $$;

insert into public.customers (
  id,
  email,
  email_verified_at,
  full_name,
  date_of_birth,
  phone_hmac,
  phone_ciphertext,
  phone_last4,
  phone_country,
  phone_verified_at
) values (
  '00000000-0000-0000-0000-00000000c102',
  null,
  null,
  'Pat Pending',
  '1992-04-05',
  'phone-hmac-pending',
  'phone-ciphertext-pending',
  '4567',
  'GB',
  '2026-06-17T08:00:00Z'
);

update public.customers
set email = 'pending@example.test',
    email_verified_at = null
where id = '00000000-0000-0000-0000-00000000c102';

update public.customers
set email = null,
    email_verified_at = null
where id = '00000000-0000-0000-0000-00000000c102';

-- Verifying an email sets email_verified_at, which the hardened
-- prevent_verified_customer_contact_change trigger now restricts to the
-- trusted service-role verification flow.
set local request.jwt.claim.role = 'service_role';

update public.customers
set email = 'pending@example.test',
    email_verified_at = '2026-06-17T10:00:00Z'
where id = '00000000-0000-0000-0000-00000000c102';

reset request.jwt.claim.role;

select 'customer contact immutability ok';

rollback;
