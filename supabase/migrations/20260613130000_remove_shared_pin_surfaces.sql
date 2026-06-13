drop function if exists public.redeem_reward_with_staff_pin(uuid, text);
drop function if exists public.issue_stamp_with_staff_pin(uuid, text);
drop function if exists public.rotate_staff_pin_system(uuid, text, text, date);
drop function if exists public.get_merchant_staff_pin_ciphertext(uuid);
drop function if exists public.get_merchant_staff_pin_status(uuid);
drop function if exists public.upsert_merchant_staff_pin(uuid, text, text, text);
drop function if exists public.upsert_merchant_staff_pin(uuid, text, text);

drop table if exists public.staff_pin_attempts;

drop index if exists public.staff_users_pin_rotation_idx;
alter table public.staff_users
  drop column if exists pin_ciphertext,
  drop column if exists pin_rotated_on;

notify pgrst, 'reload schema';
