---
spec_id: MS-db-migration-ledger-apply
status: implemented
risk_class: docs-tooling
owner: amankumarshrestha
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/db/migration-ledger-apply.md
  - micro-specs/evidence/MS-db-migration-ledger-apply.json
  - scripts/run-supabase-sql.mjs
  - tests/unit/run-supabase-sql.test.mjs
  - tests/db/migration-ledger-apply.test.mjs
implementation_surfaces:
  - scripts/run-supabase-sql.mjs
  - tests/unit/run-supabase-sql.test.mjs
  - tests/db/migration-ledger-apply.test.mjs
related_docs:
  - AGENTS.md
  - micro-specs/README.md
  - micro-specs/db/emergency-containment.md
related_tests:
  - tests/unit/run-supabase-sql.test.mjs
  - tests/db/migration-ledger-apply.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm governance:check
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - Live-ledger no-op proof: against the fully-migrated local database a second --apply schedules zero migrations, shown by tests/db/migration-ledger-apply.test.mjs under pnpm test:db.
  - Ledger-record proof: a not-yet-recorded version is scheduled then upserted into supabase_migrations.schema_migrations, shown in the same DB test inside a rolled-back transaction.
approved_exceptions: []
---

# MS-db-migration-ledger-apply — Ledger-aware migration apply (stop replaying already-applied migrations)

## 1. Exact Goal and User-Visible Outcomes

The tooling that applies Supabase SQL locally (`pnpm db:migrate`,
`pnpm db:setup`) currently re-runs nearly every migration file on every
invocation, consulting neither `supabase_migrations.schema_migrations` nor
recording anything in it. The 2026-07-10 database audit flagged this as the
"don't bypass the ledger on apply" wave-2 defect: it contaminates the local
catalog (the audit saw 77 ledger rows against 82+ migration files) and can
re-run old one-shot data transformations with different semantics on
re-invocation. When this ships:

- **A second consecutive apply is a no-op.** Running `pnpm db:migrate` or
  `pnpm db:setup` against a database whose ledger already records a migration
  version does not re-execute that migration file. Against a fully-migrated
  database the apply path runs zero migration files, so one-shot data
  transformations can no longer silently re-run.
- **Every applied migration is recorded like the CLI records it.** Each
  migration the apply path does run is written to
  `supabase_migrations.schema_migrations` (version + name + applied SQL), so
  `supabase migration list --linked` and `pnpm smoke:supabase:migrations` see
  the same ledger `supabase db reset`/`db push` would have written. The local
  catalog stops drifting from the file set.
- **Everything else behaves exactly as before.** `--reset`, `--seed`,
  `--reset-customers`, `--reset-today-stamps`, `--seed-perf-owner`, and the
  non-local-host write guard are untouched.

This is a tooling-correctness fix, not a schema change. No migration file and
no database schema is modified. This is the complementary half of
`MS-db-emergency-containment`, which taught the parity *checker*
(`scripts/check-supabase-migrations.mjs`) to detect duplicate-version and
edited-applied drift; this spec stops the *apply* path from creating that
drift.

## 2. Blast Radius

In scope — the apply tooling and its two proofs, all listed in the frontmatter:

- `scripts/run-supabase-sql.mjs` — guard top-level execution behind an
  `isMain()` check so the pure helpers import without side effects, and make
  `applyMigration()` ledger-aware (ensure the ledger table, read applied
  versions, skip recorded versions, record newly-applied ones). Export the
  pure planner + version parser and the executor-accepting ledger helpers.
- `tests/unit/run-supabase-sql.test.mjs` — pure-function proof of the apply
  planner, the version parser, and the side-effect-free import.
- `tests/db/migration-ledger-apply.test.mjs` — live-database proof that a
  second invocation schedules zero migrations and that a not-yet-recorded
  version is scheduled then recorded.
- `micro-specs/db/migration-ledger-apply.md` and
  `micro-specs/evidence/MS-db-migration-ledger-apply.json` — this spec and its
  evidence ledger.

Explicitly out of scope: any file under `supabase/migrations/**` (no
schema/migration change — this is apply tooling only); `supabase/reset.sql`,
`supabase/seed*.sql`, and the reset/seed subcommand code paths (untouched);
`scripts/check-supabase-migrations.mjs` (its duplicate/edited-applied
detection is the sibling half already shipped under
`MS-db-emergency-containment`); routing the scripts through the Supabase CLI
(rejected — see §4); production database application (owner-owed; the tool
refuses non-local hosts).

## 3. Strict Constraints and Assumptions

- **The ledger is the source of truth for "applied."** The apply path reads
  `supabase_migrations.schema_migrations.version` and skips any migration file
  whose 14-digit version is already present. Newly-applied files are inserted
  with `on conflict (version) do nothing`.
- **Faithful ledger rows.** Inserted rows carry `version` (the 14-digit
  prefix), `name` (the filename with the `<version>_` prefix and `.sql` suffix
  stripped — what the CLI stores, verified against the live local ledger), and
  `statements` (the applied SQL). `migration list`/`db push` read version+name;
  `statements` is recorded for fidelity but no consumer parses it, so it is
  stored as a single-element array of the file source rather than
  re-implementing the CLI's per-statement splitter.
- **The ledger table is created if absent.** `create schema if not exists
  supabase_migrations` then `create table if not exists
  supabase_migrations.schema_migrations (version text primary key, statements
  text[], name text)` — matching the CLI's real shape (verified on the live
  local DB: `version text NOT NULL` PK, `statements text[]`, `name text`) so
  `create table if not exists` never clobbers a CLI-created table and a
  from-scratch apply still tracks versions.
- **Apply then record, per file, non-atomically.** Each file is applied exactly
  as today (`sql.unsafe(source)` — preserving multi-statement files and any
  `CREATE INDEX CONCURRENTLY` that cannot run inside an explicit transaction),
  then its ledger row is upserted as a separate statement. A crash between the
  two re-applies only that one file next run (idempotent-safe migrations
  tolerate this) — strictly better than today, which re-applies every file
  every run. This matches the CLI, which also records after applying.
- **Fresh-safe guard for schema-without-ledger.** If the applied set is empty
  (or the ledger table is absent) but the public schema is already provisioned
  (`to_regclass('public.product_events')` is not null) and `--force` is absent,
  the apply path refuses with a clear message rather than re-running one-shot
  migrations against a populated schema. On a genuinely fresh database (no
  schema, empty ledger) apply runs the whole chain and records it with no flag.
- **`--force` means ignore the ledger.** With `--force` the plan is every file
  regardless of recorded versions (today's "re-apply everything" semantics for
  disposable databases), each upserted into the ledger afterward; the
  schema-without-ledger guard does not trip.
- **Pure planning is separated from I/O.** The apply decision
  (`planMigrationApply`) and version parsing (`parseMigrationVersion`) are pure
  exported functions unit-tested with no database; the ledger read/write
  helpers accept a `sql`/`tx` executor so the DB tier can exercise them inside a
  rolled-back transaction.
- Assumption: local Supabase is provisioned CLI-first (`supabase start` /
  `supabase db reset`, with `[db.migrations] enabled = true`), so the ledger is
  normally fully populated before this tool runs, and `supabase/reset.sql`
  preserves both schema and ledger (so `pnpm db:reset` does not re-empty the
  ledger). The live local ledger and file set are aligned at 86/86 as of
  2026-07-10.

## 4. Decisions Already Made

- **In-script ledger-awareness, not the CLI.** The apply path stays on
  postgres.js and gains ledger read/skip/record. Routing through `supabase db
  push`/`migration up` is rejected: the CLI does not know the repo's custom
  `--reset`/`--seed`/`--reset-customers`/`--reset-today-stamps` subcommands,
  needs linked-DB auth env (hook secret/URI) even for local work, and is a
  larger, harder-to-scope change. The surgical fix is lower blast-radius and
  directly unit- and db-testable. (User-confirmed.)
- **Risk class `docs-tooling`.** The change is a tooling script plus tests; no
  `supabase/migrations/**` file or schema changes, so the migrations-class
  radius hint does not apply. The gate floor is the docs-tooling floor plus a
  voluntarily-declared `pnpm test:db` — the honest proof that "a second
  invocation is a no-op" is a live-ledger behavior, so it is a recorded gate,
  not just supporting evidence. (User-confirmed.)
- **Both a unit and a DB proof.** The pure planner is unit-tested
  (skip-applied / apply-new / force / schema-without-ledger guard) and the
  end-to-end no-op is db-tested against the real ledger of the fully-migrated
  local database. The audit allowed "unit or db"; both are cheap here and prove
  different layers.
- **The `product_events` probe is reused, not removed.** The existing
  initial-migration / `product_events` special case is replaced by ledger
  logic; `to_regclass('public.product_events')` is retained only as the
  "schema already provisioned" signal for the fresh-safe guard.
- **Non-atomic apply+record is accepted** for a local disposable-DB tool (see
  §3); wrapping each file in an explicit transaction is rejected because it
  would break `CONCURRENTLY` and self-managing-transaction migration files.
- Production application stays owner-owed; the tool's existing non-local-host
  refusal is unchanged.

## 5. Behavioral Requirements (EARS)

- THE apply path SHALL ensure `supabase_migrations.schema_migrations` exists (creating the schema and table if absent) before reading or recording applied versions.
- THE apply path SHALL read the set of applied migration versions from `supabase_migrations.schema_migrations` before deciding which migration files to run.
- WHEN a migration file's 14-digit version is already present in the ledger, THE apply path SHALL skip that file and not execute its SQL.
- WHEN the apply path executes a migration file, THE apply path SHALL record that file's version, name, and applied SQL in `supabase_migrations.schema_migrations` using an insert that is a no-op on version conflict.
- WHILE `--force` is set, THE apply path SHALL execute every migration file regardless of recorded versions and record each in the ledger.
- IF the applied set is empty but the public schema is already provisioned and `--force` is absent, THEN THE apply path SHALL refuse to apply and exit non-zero with a message directing the user to reset the database or pass `--force`.
- WHEN the apply path runs against a fully-migrated database whose ledger records every local migration version, THE apply path SHALL execute no migration files.
- THE reset, seed, reset-customers, reset-today-stamps, and seed-perf-owner subcommands and the non-local-host write guard SHALL behave identically to before this change.
- THE run-supabase-sql module SHALL expose its migration-apply planner and version parser as pure functions and its ledger helpers as executor-accepting functions, and SHALL NOT connect to a database when imported rather than executed.

## 6. Verification Criteria and Task Breakdown

Observable outcomes to verify:

- `planMigrationApply` skips versions present in the applied set, schedules
  versions absent from it, schedules every file under `--force`, and returns a
  blocked result when the schema is provisioned but the applied set is empty and
  `--force` is absent.
- `parseMigrationVersion` returns the 14-digit prefix for a conforming filename
  and null otherwise.
- Importing `scripts/run-supabase-sql.mjs` performs no top-level database
  connection or process exit (the pure functions are importable in the unit
  tier).
- Against the fully-migrated local database, reading the real ledger and
  planning against the real migration files yields an empty `toApply` (the
  no-op) — proven in `tests/db`.
- Inside a rolled-back transaction: deleting one recorded version makes the
  planner schedule exactly that version, and the ledger-record helper
  re-inserts a version row (upsert) so a re-run is a no-op.
- The reset/seed subcommands still run their SQL (unchanged), and
  `pnpm smoke:supabase:migrations` still reports the tree aligned.

Task breakdown (implement one at a time, red → green → refactor; run the
narrowest `tests/unit` / `tests/db` file per task, then the full recorded gate
floor at the lifecycle boundary):

1. `tests/unit/run-supabase-sql.test.mjs` red, then refactor
   `scripts/run-supabase-sql.mjs` to guard top-level execution behind
   `isMain()` and export `parseMigrationVersion` + `planMigrationApply`; make
   the unit tests green.
2. `tests/db/migration-ledger-apply.test.mjs` red, then add
   `ensureMigrationLedger` / `readAppliedVersions` / `recordAppliedMigration`
   (executor-accepting) and wire the ledger-aware `applyMigration()`; make the
   DB tests green.
3. Fresh/idempotent rehearsal: run `pnpm db:setup` twice against the local
   database and confirm the second run schedules zero migrations; run
   `pnpm test:db`; then record with `governance:run-gates --spec
   MS-db-migration-ledger-apply --record` and advance the lifecycle with
   `governance:advance`.
