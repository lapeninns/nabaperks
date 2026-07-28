-- Keep the privacy-bounded route vocabulary aligned with the public FAQ page.
-- The application emits only these opaque keys; raw paths remain out of the
-- telemetry table.

alter table public.web_vital_samples
  drop constraint if exists web_vital_samples_route_key_check;

alter table public.web_vital_samples
  add constraint web_vital_samples_route_key_check
  check (
    route_key in (
      'home',
      'about',
      'pricing',
      'how_it_works',
      'faq',
      'pubs',
      'guide_no_app',
      'guide_ideas',
      'guide_paper_vs_qr'
    )
  );
