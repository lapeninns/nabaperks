create or replace function public.prevent_verified_customer_contact_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.auth_user_id is distinct from old.auth_user_id then
    raise exception 'Customer auth user cannot be changed through profile updates';
  end if;

  if old.email_verified_at is not null then
    if new.email is distinct from old.email
      or new.email_verified_at is distinct from old.email_verified_at then
      raise exception 'Verified email cannot be changed through customer profile updates';
    end if;
  end if;

  if old.phone_verified_at is not null then
    if new.phone is distinct from old.phone
      or new.phone_hmac is distinct from old.phone_hmac
      or new.phone_ciphertext is distinct from old.phone_ciphertext
      or new.phone_last4 is distinct from old.phone_last4
      or new.phone_country is distinct from old.phone_country
      or new.phone_verified_at is distinct from old.phone_verified_at then
      raise exception 'Verified phone cannot be changed through customer profile updates';
    end if;
  end if;

  return new;
end;
$$;
