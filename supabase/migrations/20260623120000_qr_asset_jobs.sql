-- QR asset print pipeline — Slice 1: queue table, private storage bucket, RLS,
-- and the service-role write RPC. Modeled on public.notification_events.
--
-- Idempotent: db:migrate re-applies every non-initial migration on each run.

create table if not exists public.qr_asset_jobs (
  id uuid primary key default extensions.gen_random_uuid(),
  qr_code_id uuid not null references public.qr_codes(id) on delete cascade,
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  location_id uuid not null references public.merchant_locations(id) on delete cascade,
  asset_kind text not null
    check (asset_kind in ('poster_pdf', 'till_card_png', 'sticker_png')),
  content_version text not null,
  storage_path text,
  byte_size integer check (byte_size is null or byte_size >= 0),
  status text not null default 'queued'
    check (status in ('queued', 'rendering', 'ready', 'failed', 'superseded')),
  due_at timestamptz not null default now(),
  dedupe_key text not null,
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  generated_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists qr_asset_jobs_dedupe_key_idx
  on public.qr_asset_jobs (dedupe_key);
create index if not exists qr_asset_jobs_due_status_idx
  on public.qr_asset_jobs (status, due_at);
create index if not exists qr_asset_jobs_lookup_idx
  on public.qr_asset_jobs (qr_code_id, asset_kind, status, created_at desc);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'qr_asset_jobs_set_updated_at'
  ) then
    create trigger qr_asset_jobs_set_updated_at
      before update on public.qr_asset_jobs
      for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.qr_asset_jobs enable row level security;
alter table public.qr_asset_jobs force row level security;

drop policy if exists qr_asset_jobs_select_owner_or_admin on public.qr_asset_jobs;
create policy qr_asset_jobs_select_owner_or_admin
  on public.qr_asset_jobs for select to authenticated
  using (
    public.is_internal_admin()
    or exists (
      select 1
      from public.merchants merchants
      where merchants.id = qr_asset_jobs.merchant_id
        and merchants.owner_user_id = (select auth.uid())
    )
  );

drop policy if exists qr_asset_jobs_service_role_all on public.qr_asset_jobs;
create policy qr_asset_jobs_service_role_all
  on public.qr_asset_jobs for all to service_role
  using (true)
  with check (true);

revoke all on table public.qr_asset_jobs from anon, authenticated;
grant select on table public.qr_asset_jobs to authenticated;
grant select, insert, update, delete on table public.qr_asset_jobs to service_role;

-- First Supabase Storage bucket in the repo. Private; reads are mediated by the
-- route handlers (service-role download / short-TTL signed URL) after the
-- existing ownership check. Guarded so a non-Supabase Postgres target (no
-- `storage` schema) still applies the rest of the migration.
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('qr-assets', 'qr-assets', false)
    on conflict (id) do nothing;

    execute 'drop policy if exists qr_assets_service_role_all on storage.objects';
    execute $pol$
      create policy qr_assets_service_role_all
        on storage.objects for all to service_role
        using (bucket_id = 'qr-assets')
        with check (bucket_id = 'qr-assets')
    $pol$;
  end if;
end $$;

-- Service-role write RPC: the only path that flips a job to `ready`. Validates
-- the asset kind, requires a matching job row, and records the audit breadcrumb.
create or replace function public.record_qr_asset_generated(
  p_qr_code_id uuid,
  p_asset_kind text,
  p_storage_path text,
  p_content_version text,
  p_byte_size integer default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_merchant_id uuid;
begin
  if p_asset_kind not in ('poster_pdf', 'till_card_png', 'sticker_png') then
    raise exception 'Unsupported QR asset kind: %', p_asset_kind;
  end if;

  update public.qr_asset_jobs
  set status = 'ready',
      storage_path = p_storage_path,
      byte_size = p_byte_size,
      last_error = null,
      generated_at = now()
  where qr_code_id = p_qr_code_id
    and asset_kind = p_asset_kind
    and content_version = p_content_version
  returning merchant_id into v_merchant_id;

  if v_merchant_id is null then
    raise exception 'No QR asset job for %/%/%',
      p_qr_code_id, p_asset_kind, p_content_version;
  end if;

  insert into public.product_events (
    event_name,
    merchant_id,
    qr_code_id,
    actor_type,
    actor_id,
    metadata
  )
  values (
    'qr_asset_generated',
    v_merchant_id,
    p_qr_code_id,
    'system',
    null,
    jsonb_build_object(
      'asset_kind', p_asset_kind,
      'content_version', p_content_version
    )
  );
end;
$$;

revoke all on function public.record_qr_asset_generated(uuid, text, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.record_qr_asset_generated(uuid, text, text, text, integer)
  to service_role;
