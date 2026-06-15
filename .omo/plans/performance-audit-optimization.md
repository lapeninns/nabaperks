# Performance Audit and Optimization

Source attachment:
`/Users/amankumarshrestha/.codex/attachments/b71e28f7-3233-4476-b1d9-c1b7b882bdc6/pasted-text.txt`

## Scope

Execute the attached performance plan for the Nabaperks Next.js app. Keep the
micro-spec/TDD contract from `AGENTS.md` and `Instructions_tdd.md`: behavior
changes need failing-first or characterization tests where there is a seam, SQL
invariants need SQL tests, and observable surface QA is required before done.

## TODOs

- [x] Phase 0: Add `lib/perf/server-timing.ts`, `scripts/perf-routes.mjs`, `pnpm perf:routes`, loader timing instrumentation, and `docs/PERF_BASELINE.md` with before route matrix.
- [x] Phase 1a: Make read-path PostHog non-blocking in `app/app/page.tsx` and `recordProductEvent` while keeping Supabase `product_events` awaited.
- [x] Phase 1b-1c: Remove wasted dashboard fetches, cache `getQrSetup` and `getLoyaltyCardSetup`, and parallelize QR/card setup queries where safe.
- [x] Phase 1d: Add merchant route loading skeleton and nav pending state using the existing `Skeleton` primitive and current Next.js `useLinkStatus` API.
- [x] Phase 1e: Parallelize customer card lookups and avoid duplicate stamp-path membership/location work where safe.
- [x] Phase 2a: Stream merchant home/activity with async Suspense children and real data boundaries.
- [x] Phase 3/2c: Add idempotent DB indexes and dashboard/admin count RPC consolidation with SQL/Vitest coverage.
- [x] Phase 4: Reduce client bundle weight by dynamically loading the QR scanner and deferring PWA service-worker registration. Root client-shell route regrouping was inspected and left unchanged because it would require moving several top-level customer routes into new route groups.
- [x] Phase 5: Re-run baselines, add regression coverage, update `docs/PERF_BASELINE.md` with deltas, and complete final verification.

## Acceptance Gates

- `pnpm test` passes, or failures are proven pre-existing and unrelated.
- `pnpm typecheck` passes.
- `pnpm lint` passes.
- `pnpm build` passes.
- Database verification commands for touched SQL are run when environment is available.
- `pnpm perf:routes` produces a route matrix or documents missing auth/env blockers.
- Merchant/customer/admin surfaces are manually driven through a local production or dev server where credentials and seed state allow it.
- No cross-tenant cache keys or service-role scope widening.

## Completion Evidence

- `pnpm test`: passed, 45 files and 325 tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with one existing warning in `lib/legal/content.ts`.
- `pnpm build`: passed on Next.js 16.2.6.
- `pnpm db:verify`: passed.
- `pnpm db:test:rls`: blocked by existing tenant-isolation seed mismatch before the new performance SQL test ran (`merchant owner A saw 1 customers, expected 5`).
- `pnpm perf:routes -- --base-url http://127.0.0.1:3001 --routes /,/pricing,/start,/app,/scan,/q/demo,/m/demo --runs 2 --timeout-ms 10000`: completed and recorded in `docs/PERF_BASELINE.md`.
- Browser smoke on `http://127.0.0.1:3001` covered `/`, `/pricing`, `/start`, `/scan`, `/app`, and `/app/activity` with no Next.js error overlay or console errors.
