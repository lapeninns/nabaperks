-- A producer can wait on erasure's customer lock, then enqueue after the
-- erasure RPC has cancelled existing events. Fence new work at its insert.
create or replace function private.cancel_late_notification_after_erasure()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_erased boolean;
begin
  if new.customer_id is null or new.status is null
     or new.status not in ('queued', 'delivering') then
    return new;
  end if;

  -- Match the FK's lock strength: compatible with loyalty NO KEY UPDATE,
  -- but erasure's FOR UPDATE must finish before this eligibility read.
  select coalesce(customers.email, '') like 'erased+%@privacy.invalid'
  into v_erased
  from public.customers
  where customers.id = new.customer_id
  for key share;

  if coalesce(v_erased, false) then
    new.status := 'cancelled';
    new.cancelled_at := coalesce(new.cancelled_at, clock_timestamp());
    new.metadata := coalesce(new.metadata, '{}'::jsonb)
      || jsonb_build_object('cancelled_reason', 'customer_erased');
  end if;
  return new;
end;
$function$;

revoke all on function private.cancel_late_notification_after_erasure()
  from public, anon, authenticated, service_role;

drop trigger if exists notification_events_cancel_after_erasure
  on public.notification_events;
create trigger notification_events_cancel_after_erasure
before insert on public.notification_events
for each row execute function private.cancel_late_notification_after_erasure();
