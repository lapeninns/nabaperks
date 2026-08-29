-- Fraud triage — a severity order the database itself can express.
--
-- `fraud_flags.severity` is text with a check constraint (low / medium / high).
-- Its ALPHABETICAL order is high, low, medium — which is not its severity order
-- — so the admin fraud queue fetched a fixed newest-100 window and sorted it in
-- memory. That is correct for exactly one window and wrong for anything paged:
-- each page would be ordered independently, and a high-severity flag on page 3
-- would sit below a low-severity one on page 1. A triage queue that reorders by
-- accident is worse than a long one, so the queue was left uncapped-but-unpaged
-- until the ordering could be expressed in SQL (UI audit ADM 04#6).
--
-- `severity_rank` is a STORED GENERATED column, not a written one. PostgreSQL
-- recomputes it on every insert and update and refuses direct writes, so it
-- cannot drift from the text column it ranks — the failure mode of a plain
-- rank column that a trigger or a forgetful INSERT keeps in sync. 0 sorts
-- first, so `order by severity_rank asc, created_at desc` is triage order.
--
-- The `else 4` arm exists because the check constraint can be widened later;
-- an unknown severity then sorts last instead of silently ranking as `high`.
--
-- Every existing writer names its columns explicitly and none names
-- `severity_rank`, so no INSERT needs changing (a generated column may not be
-- written to).
--
-- Forward-only, re-runnable, no data migration: the column is computed for
-- every existing row when it is added.

alter table public.fraud_flags
  add column if not exists severity_rank smallint not null
    generated always as (
      case lower(severity)
        when 'high' then 1
        when 'medium' then 2
        when 'low' then 3
        else 4
      end
    ) stored;

comment on column public.fraud_flags.severity_rank is
  'Triage sort key generated from severity (1 = high, 4 = unrecognised). Order by this column; the severity text sorts alphabetically, which is not severity order.';

-- The two orders the admin fraud queue actually reads: the whole queue by
-- severity then recency, and the default "open work only" view.
create index if not exists fraud_flags_severity_rank_created_at_idx
  on public.fraud_flags (severity_rank, created_at desc);

create index if not exists fraud_flags_status_severity_rank_created_at_idx
  on public.fraud_flags (status, severity_rank, created_at desc);
