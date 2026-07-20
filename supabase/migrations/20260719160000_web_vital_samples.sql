-- Privacy-bounded real-user performance telemetry for public marketing pages.
-- Raw URLs, IP addresses, contact details, and browser identifiers are never
-- columns in this table. The daily privacy cron removes samples after 90 days.

create table public.web_vital_samples (
  id uuid primary key default gen_random_uuid(),
  metric_name text not null
    check (metric_name in ('CLS', 'FCP', 'INP', 'LCP', 'TTFB')),
  metric_id text not null
    check (metric_id ~ '^[A-Za-z0-9._-]{1,128}$'),
  value double precision not null
    check (
      value >= 0
      and (
        (metric_name = 'CLS' and value <= 10)
        or (metric_name <> 'CLS' and value <= 600000)
      )
    ),
  delta double precision not null
    check (
      delta >= 0
      and (
        (metric_name = 'CLS' and delta <= 10)
        or (metric_name <> 'CLS' and delta <= 600000)
      )
    ),
  rating text not null
    check (rating in ('good', 'needs-improvement', 'poor')),
  route_key text not null
    check (
      route_key in (
        'home',
        'about',
        'pricing',
        'how_it_works',
        'pubs',
        'guide_no_app',
        'guide_ideas',
        'guide_paper_vs_qr'
      )
    ),
  navigation_type text not null
    check (
      navigation_type in (
        'navigate',
        'reload',
        'back-forward',
        'back-forward-cache',
        'prerender',
        'restore'
      )
    ),
  created_at timestamptz not null default now()
);

create index web_vital_samples_metric_route_created_idx
  on public.web_vital_samples (metric_name, route_key, created_at desc);

alter table public.web_vital_samples enable row level security;
alter table public.web_vital_samples force row level security;

revoke all on table public.web_vital_samples
  from public, anon, authenticated;
grant select, insert, delete on table public.web_vital_samples
  to service_role;

create policy "Service role manages web vital samples"
  on public.web_vital_samples
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.purge_web_vital_samples(
  p_cutoff timestamptz default (now() - interval '90 days')
)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_deleted bigint;
begin
  if not public.is_service_role_request() then
    raise exception 'Service role required';
  end if;

  delete from public.web_vital_samples
  where created_at < p_cutoff;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$function$;

revoke all on function public.purge_web_vital_samples(timestamptz)
  from public, anon, authenticated;
grant execute on function public.purge_web_vital_samples(timestamptz)
  to service_role;
