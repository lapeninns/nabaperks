revoke all on table public.notification_preferences from anon, authenticated;
revoke all on table public.push_subscriptions from anon, authenticated;

grant select on table public.notification_preferences to authenticated;
grant select on table public.push_subscriptions to authenticated;

grant select, insert, update, delete on table public.notification_preferences to service_role;
grant select, insert, update, delete on table public.push_subscriptions to service_role;
