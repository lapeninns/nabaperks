# Micro-Spec: QR Asset Print Pipeline (Playwright print studio)

```yaml
spec_id: MS-merchant-qr-asset-print-pipeline
status: active
risk_class: rls-rpc-ledger
owner: amanshresthaa
last_reviewed: 2026-06-23
allowed_blast_radius:
  - supabase/migrations/20260623*_qr_asset_*.sql
  - supabase/tests/qr_asset_jobs_rls.sql
  - lib/qr/asset-store.ts
  - lib/qr/asset-generation-worker.ts
  - app/qr/print/**
  - app/app/qr/download/[asset]/route.ts
  - app/app/qr/preview/[asset]/route.ts
  - app/app/qr/image/[qrCodeId]/route.ts
  - app/api/cron/qr-assets/route.ts
  - lib/analytics/events.ts
  - lib/merchant/qr-code.ts
  - worker/qr-assets/**
  - tests/micro-specs/qr-asset-*.test.ts
  - tests/micro-specs/merchant-qr.test.ts
  - tests/e2e/qr-poster-print.spec.ts
  - vercel.json
  - package.json
  - config/env-contract.json
  - scripts/run-supabase-sql.mjs
  - tests/helpers/supabase.ts
implementation_surfaces:
  - supabase/migrations
  - lib/qr
  - app/app/qr
  - app/api/cron/qr-assets
  - worker/qr-assets
related_docs:
  - docs/ARCHITECTURE.md
  - micro-specs/02-merchant/03-dynamic-qr-generation-and-downloads.md
related_tests:
  - supabase/tests/qr_asset_jobs_rls.sql
  - tests/micro-specs/qr-asset-store.test.ts
  - tests/micro-specs/merchant-qr.test.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm db:verify
  - pnpm db:test:rls
  - pnpm security:verify
  - pnpm build
approved_exceptions: []
```

## 1. Exact Goal and User-Visible Outcomes

Today the merchant launch panel renders the venue poster, till card, and sticker
from a hand-drawn SVG (`lib/qr/assets.ts`) that uses the retired v1 Honey & Ink
palette and a hardcoded `Nunito Sans` typeface. The output can never match the
live Wet Ink product, and every download re-rasterises synchronously on the
request.

When this work is done:

- A merchant who downloads or previews a poster receives a **high-fidelity asset
  rendered from the real Wet Ink design system** (the `--w-*` tokens and the
  Bricolage Grotesque / Space Mono fonts) — a true vector, font-embedded PDF for
  the poster, and crisp PNGs for the till card and sticker.
- Those assets are **pre-generated off the request path** (headless Chromium on a
  separate worker renders a dedicated print page into private object storage), so
  the download itself never launches a browser and never blocks on rendering.
- A download issued **before** the high-fidelity asset is ready still succeeds
  instantly, returning today's SVG asset. The merchant never sees a broken link,
  an empty file, or a "generating…" wait.
- When a merchant renames the card, edits the reward, or toggles the QR, the next
  download reflects the change; stale assets are never served.

The single guiding invariant: **design parity is added as a strict upgrade;
downloads never block on Chromium and never become less reliable than today.**

## 2. Blast Radius: In Scope and Out of Scope

In scope (the agent may create/edit only these):

- New migrations under `supabase/migrations/20260623*_qr_asset_*.sql` (queue
  table, storage bucket, RLS, content-version function, enqueue trigger, and the
  `record_qr_asset_generated` write RPC).
- New SQL invariance test `supabase/tests/qr_asset_jobs_rls.sql`.
- New TypeScript modules `lib/qr/asset-store.ts` (resolve/stream stored assets)
  and `lib/qr/asset-generation-worker.ts` (claim → render → upload → record).
- New print surfaces under `app/qr/print/**` (route, bare layout, print CSS).
- New cron handler `app/api/cron/qr-assets/route.ts`.
- New standalone worker service under `worker/qr-assets/**`.
- Edits to the three asset routes to become **fallback-first**:
  `app/app/qr/{download,preview,image}/...route.ts`.
- Edits to `lib/analytics/events.ts` (new product event names),
  `lib/merchant/qr-code.ts` (a worker-token asset-context accessor), `vercel.json`
  (second cron), `package.json` (worker-only `playwright-core` dep + scripts), and
  `config/env-contract.json` (new worker env vars).
- New tests under `tests/micro-specs/qr-asset-*.test.ts` and
  `tests/e2e/qr-poster-print.spec.ts`.

Out of scope (must not change):

- The existing SVG renderers in `lib/qr/assets.ts` — they stay **verbatim** as
  the permanent fallback. Do not delete `posterSvg`, `tillCardSvg`, `stickerSvg`,
  `renderQrPosterPdf`, `renderQrAssetPng`, `renderQrPosterPng`, or
  `renderQrCodePng`.
- The two existing security-definer QR RPCs `create_or_get_join_qr` and
  `set_qr_active` — enqueue is added by a **trigger on `qr_codes`**, not by
  rewriting these functions.
- Customer flows, billing, auth/session behaviour, the stamp/reward ledger, and
  any table other than `qr_codes` (read-only) and the new `qr_asset_jobs`.
- Bundling Chromium / `@sparticuz/chromium` into the Vercel app. No `app/` or
  `lib/` module imported by the Vercel build may import a browser binary.

## 3. Strict Constraints and Assumptions

- **Mutation boundary.** Reads stay on the cookie/RLS server client; the worker's
  writes use the service-role client and a security-definer RPC. Storage uploads
  live only in `import "server-only"` modules. `lib/supabase/server.ts` remains
  the only place clients are constructed.
- **Storage.** This introduces the repo's first Supabase Storage bucket
  (`qr-assets`, `public = false`). Reads are served by the route handlers
  (service-role download or short-TTL signed URL) only after the existing
  ownership check; never `getPublicUrl`.
- **Idempotent migrations.** `db:migrate` re-applies non-initial migrations every
  run. All DDL uses `create table if not exists`, `create index if not exists`,
  `create or replace function`, `drop policy if exists` + `create policy`,
  `on conflict do nothing`, and `pg_trigger`-guarded `create trigger`.
- **No new Vercel-runtime dependency.** `playwright-core` is added as a
  worker-only dependency that no `app/`/`lib/` Vercel module imports;
  `@playwright/test` stays a devDependency.
- **Design system.** The print page renders through `app/globals.css` tokens and
  real `components/brand` / `components/loyalty` components; no edits to
  `components/ui` primitives. Copy is en-GB, no emoji, no exclamation marks.
- **Asset kinds and slugs are unchanged**: `poster` → `poster_pdf`,
  `till-card` → `till_card_png`, `sticker` → `sticker_png`
  (`assetKindFromSlug`), and the same three values gate `record_qr_download`.

## 4. Decisions Already Made

- Chromium runs on a **separate always-on worker** (Fly.io/Railway/Render),
  driven by `playwright-core`; a `CHROMIUM_WS_ENDPOINT` env var lets the same
  worker connect to a hosted browser instead, with no code change.
- Generation is **event-driven**: an `after insert or update` trigger on
  `qr_codes` (for `destination_type = 'join'`) enqueues three `qr_asset_jobs`
  rows, deduped by `dedupe_key = (qr_code_id, asset_kind, content_version)`.
- `content_version = encode(digest(...), 'hex')` over
  `qr_id, business_name, location_name, card_name, reward_name, is_active,
design_version`. It lands in both `dedupe_key` and the storage object path, so a
  data/template change supersedes the old job and a no-op toggle dedupes.
- The queue table `qr_asset_jobs` mirrors `notification_events`: `status`
  (`queued|rendering|ready|failed|superseded`), `due_at`, `dedupe_key`, `payload`,
  `metadata`, `(status, due_at)` index, `set_updated_at` trigger, service-role
  `for all` policy + an owner-scoped `select` policy.
- The cron handler `/api/cron/qr-assets` mirrors `/api/cron/notifications`
  (`runtime = "nodejs"`, `force-dynamic`, `CRON_SECRET` bearer gate) and itself
  **never imports Chromium**; it triggers the worker drain.
- The download contract is unchanged: same ownership 404, same
  `record_qr_download` + `qr_downloaded` side effects, same
  `Content-Disposition`/`Content-Type`/`Cache-Control` headers on both the stored
  and fallback branches.

## 5. Behavioral Requirements (EARS)

Storage & schema (Slice 1):

- R1. THE `qr_asset_jobs` table SHALL exist with a unique `dedupe_key`, a
  `(status, due_at)` index, and a `status` constrained to
  `queued|rendering|ready|failed|superseded`.
- R2. THE `qr-assets` storage bucket SHALL exist and SHALL be private
  (`public = false`).
- R3. IF a request is made by an `authenticated` role for a `qr_asset_jobs` row
  whose merchant is not owned by that user, THEN THE database SHALL return no row
  (RLS denies cross-tenant reads).
- R4. THE `qr_asset_jobs` table SHALL reject `insert`, `update`, and `delete` from
  the `anon` and `authenticated` roles (only `service_role` writes).
- R5. THE `record_qr_asset_generated` RPC SHALL be executable only by
  `service_role`, and WHEN called SHALL set the matching job `status = 'ready'`
  with its `storage_path`, and record a `qr_asset_generated` product event.

Content version & enqueue (Slice 2):

- R6. WHEN a `join` `qr_codes` row is inserted, THE system SHALL enqueue exactly
  one `queued` job per asset kind (`poster_pdf`, `till_card_png`, `sticker_png`).
- R7. WHEN a `qr_codes` row's `is_active` (or other pixel-affecting input)
  changes, THE system SHALL enqueue jobs whose `content_version` differs from the
  existing rows; a change that does not affect the rendered pixels SHALL dedupe to
  the existing job (no duplicate `queued` row).
- R8. THE `content_version` SHALL change if and only if one of
  `{qr_id, business_name, location_name, card_name, reward_name, is_active,
design_version}` changes.

Fallback-first delivery (Slice 4):

- R9. WHEN a poster/till-card/sticker is downloaded AND a `ready` stored asset of
  that kind exists for the QR, THE download route SHALL stream the stored bytes
  with the same `Content-Type`, `Content-Disposition: attachment`, and
  `Cache-Control: private, no-store` headers as today.
- R10. IF no `ready` stored asset exists (still generating, failed, superseded,
  or storage unreachable), THEN THE download route SHALL fall back to the existing
  synchronous SVG renderer and succeed with identical headers.
- R11. THE download route SHALL preserve today's ownership 404 and its
  `record_qr_download` + `qr_downloaded` side effects on both branches.
- R12. THE `/app/qr/image/[qrCodeId]` route SHALL always render the bare QR PNG
  from the existing pure-JS path (never dependent on storage).

Print page & parity (Slice 3):

- R13. WHEN the print route is requested for an owned QR and a valid asset slug,
  THE system SHALL render the asset using the live Wet Ink tokens and fonts.
- R14. IF the slug is unknown or the QR is not owned (no cookie session and no
  valid worker token), THEN THE print route SHALL respond 404 (or 401 for a bad
  worker token) and SHALL NOT render tenant data.
- R15. THE printed poster SHALL preserve background colours (the page sets
  `print-color-adjust: exact`; the worker captures with `printBackground: true`).

Worker & cron (Slices 5–6):

- R16. WHEN the worker claims a `queued` job, THE system SHALL transition it to
  `rendering` before capture so a second worker cannot claim the same job.
- R17. WHEN rendering succeeds, THE worker SHALL upload bytes to
  `qr-assets/{qr_code_id}/{asset_kind}/{content_version}.{ext}` and only then mark
  the job `ready` via `record_qr_asset_generated` (upload-before-ready ordering).
- R18. IF the `CRON_SECRET` bearer is missing or wrong, THEN
  `/api/cron/qr-assets` SHALL respond 401 and SHALL NOT trigger a drain.
- R19. THE `/api/cron/qr-assets` handler SHALL NOT import a browser binary.

## 6. Verification Criteria and Task Breakdown

Implement strictly Red → Green → Refactor, one slice at a time. Slices 1–4 ship
**zero user-visible change** (no job is `ready` until the worker exists, so every
download still takes the SVG fallback) — the risk is back-loaded onto the worker.

- **Slice 1 — Queue schema + bucket + write RPC.** SQL invariance test proves
  R1–R5 (tenant isolation, service-role-only writes, bucket private). Gate:
  `pnpm db:verify` (static) and `pnpm db:test:rls` (live).
- **Slice 2 — Content version + enqueue trigger + events.** SQL test proves
  R6–R8 (enqueue-on-create, dedupe on no-op, supersede on real change). Add the
  three product event names. Gate: `pnpm db:test:rls`, `pnpm test`.
- **Slice 3 — Wet Ink print route + bare layout + print CSS.** Route test proves
  R13–R14; browser evidence proves R15 (A4, backgrounds, Bricolage type). Gate:
  `pnpm test`, `pnpm build`, scoped browser screenshot.
- **Slice 4 — Asset store + fallback-first routes.** Vitest (mocked Supabase)
  proves R9–R12 against the stored-hit and fallback-miss branches with identical
  headers. Gate: `pnpm test`.
- **Slice 5 — Worker + storage write.** Vitest (mocked Supabase + stubbed page)
  proves R16–R17 (claim ordering, upload-before-ready, path shape). Stand up the
  `worker/qr-assets` service (Dockerfile + entry). Gate: `pnpm test`; deploy
  evidence that a queued job flips `ready`.
- **Slice 6 — Cron trigger + reconcile + observability.** Route test proves
  R18–R19. Add the `*/5` cron to `vercel.json`. Gate: `pnpm test`.
- **Slice 7 — Backfill + e2e parity guard.** One-off enqueue for existing active
  join QRs; e2e asserts computed font resolves to Bricolage before capture. Gate:
  `pnpm qa:e2e`, then full `pnpm qa:full` before merge.

Expected success state: a real Wet Ink PDF is served once generated; every miss
falls back to the SVG asset with byte-identical headers. Expected failure states:
worker down → SVG fallback (not an error); bad cron secret → 401; cross-tenant
job read → empty.
