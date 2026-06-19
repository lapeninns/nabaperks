# Cycle Stamp 3 Soft GPS Geofence Code Review

Date: 2026-06-19

## Verdict

PASS

- codeQualityStatus: WATCH
- recommendation: APPROVE
- blockers: []

This was a read-only adversarial review of the current worktree against `Goal/cycle-stamp-3-soft-gps-geofence-plan.md`, repo `AGENTS.md`, and the safety rule not to mutate hosted Supabase. The only file written by this reviewer is this report artifact.

## Skill Perspective Check

Ran:

- `omo:programming`: loaded `/Users/amankumarshrestha/.codex/plugins/cache/sisyphuslabs/omo/4.11.1/skills/programming/SKILL.md` and the TypeScript reference.
- `omo:remove-ai-slops`: loaded `/Users/amankumarshrestha/.codex/plugins/cache/sisyphuslabs/omo/4.11.1/skills/remove-ai-slops/SKILL.md`.

Result:

- No CRITICAL or HIGH violations found.
- WATCH only: `tests/micro-specs/self-service-stamping.test.ts:756` and `tests/micro-specs/self-service-stamping.test.ts:851` include source/implementation-string assertions. They are not deletion-only or tautological enough to block because they sit beside behavior and SQL coverage for the same requirements, but they are brittle and should not become the dominant test style.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

None.

### LOW

- `tests/micro-specs/self-service-stamping.test.ts:756` and `tests/micro-specs/self-service-stamping.test.ts:851` assert implementation/source strings for the cycle-stamp gate and removed join-form geolocation code. This is acceptable as a governance guardrail in this remediation cycle, but future changes should prefer behavior-level coverage where practical.

## Evidence

Files inspected:

- `AGENTS.md`
- `Goal/cycle-stamp-3-soft-gps-geofence-plan.md`
- `components/customer/self-service-forms.tsx`
- `components/customer/stamp-collector.tsx`
- `components/customer/join-forms.tsx`
- `components/customer/join-otp-form.tsx`
- `components/customer/customer-card-experience.tsx`
- `app/card/[membershipId]/actions.ts`
- `app/m/[merchantSlug]/join/actions.ts`
- `lib/customer/stamp.ts`
- `lib/customer/returning-qr-redirect.ts`
- `supabase/migrations/20260619120000_cycle_stamp_soft_geofence.sql`
- `supabase/tests/cycle_stamp_soft_geofence.sql`
- `scripts/run-supabase-sql.mjs`
- `scripts/verify-security.mjs`
- `scripts/verify-supabase-schema.mjs`
- `lib/admin/data.ts`
- `app/admin/fraud/page.tsx`
- `lib/legal/content.ts`
- `docs/QA_MATRIX.md`
- `micro-specs/TRACEABILITY.md`
- `micro-specs/traceability.json`
- `eslint.config.mjs`
- `.omo/evidence/`
- `artifacts/evidence/cycle-stamp-3-soft-gps-client-20260619.md`
- `test-results/.last-run.json`

Key source evidence:

- `components/customer/stamp-collector.tsx:176` computes the next stamp and only attempts browser location when `requireGeofence && nextCycleStampNumber === 3`.
- `components/customer/self-service-forms.tsx:35` records remembered denial but still attempts the current browser geolocation call; `components/customer/self-service-forms.tsx:91` only appends minimized capture fields unless coordinates are granted.
- `components/customer/join-forms.tsx` and `components/customer/join-otp-form.tsx` no longer render or submit GPS fields for QR join-first-stamp.
- `app/m/[merchantSlug]/join/actions.ts:178` routes returning QR stamp issuance without coordinates; join RPC params at `app/m/[merchantSlug]/join/actions.ts:221` omit latitude/longitude.
- `supabase/migrations/20260619120000_cycle_stamp_soft_geofence.sql:174` computes active-cycle stamp count; `:187` applies same-day idempotency before GPS review; `:231` gates soft geofence to configured stamp 3; `:310` writes minimized stamp metadata without raw coordinates; `:458` writes minimized audit/product event metadata.
- `supabase/tests/cycle_stamp_soft_geofence.sql:119` covers stamp 1/2 no GPS flags; `:322` covers stamp 3 out-of-range minimized flagging; `:403` covers later active cycles; `:491` covers stamp 4 ignoring GPS; `:647` covers same-day duplicate before GPS review; `:739` covers legacy RPC compatibility.
- `scripts/run-supabase-sql.mjs:46` refuses write-risk targets before connecting; `scripts/run-supabase-sql.mjs:231` has no hosted override path.
- `lib/admin/data.ts:231` redacts fraud metadata to buckets/status fields; `app/admin/fraud/page.tsx:42` renders only minimized admin fields; `lib/legal/content.ts:24` and `:130` accurately describe non-blocking minimized location evidence.
- `eslint.config.mjs:15` scopes generated artifact ignores to `.vercel/output/**` and `.omo/evidence/**`.

Commands run:

```sh
rg --files -g AGENTS.md /Users/amankumarshrestha/.codex/worktrees/aa82/Nabaperks
sed -n '1,260p' AGENTS.md
sed -n '1,260p' Goal/cycle-stamp-3-soft-gps-geofence-plan.md
sed -n '261,620p' Goal/cycle-stamp-3-soft-gps-geofence-plan.md
git status --short
git branch --show-current
git merge-base main HEAD
git rev-parse --show-toplevel
git diff --stat
git diff -- components/customer/self-service-forms.tsx components/customer/stamp-collector.tsx components/customer/join-forms.tsx components/customer/join-otp-form.tsx components/customer/customer-card-experience.tsx
git diff -- 'app/card/[membershipId]/actions.ts' 'app/m/[merchantSlug]/join/actions.ts' 'lib/customer/stamp.ts' 'lib/customer/returning-qr-redirect.ts'
git diff -- scripts/run-supabase-sql.mjs scripts/verify-security.mjs scripts/verify-supabase-schema.mjs eslint.config.mjs
git diff -- app/admin/fraud/page.tsx lib/admin/data.ts lib/legal/content.ts docs/QA_MATRIX.md micro-specs/TRACEABILITY.md micro-specs/traceability.json
SUPABASE_DB_URL='postgresql://postgres:postgres@db.example.supabase.co:5432/postgres' node scripts/run-supabase-sql.mjs --test
ALLOW_NONLOCAL_DB=1 SUPABASE_DB_URL='postgresql://postgres:postgres@db.example.supabase.co:5432/postgres' node scripts/run-supabase-sql.mjs --test
pnpm vitest run tests/micro-specs/self-service-stamping.test.ts tests/micro-specs/returning-qr-redirect.test.ts tests/micro-specs/cycle-stamp-3-governance-admin-legal.test.ts
pnpm typecheck
pnpm governance
pnpm security:verify
pnpm lint
```

Command outcomes:

- `pnpm vitest run tests/micro-specs/self-service-stamping.test.ts tests/micro-specs/returning-qr-redirect.test.ts tests/micro-specs/cycle-stamp-3-governance-admin-legal.test.ts`: PASS, 3 files, 40 tests.
- `pnpm typecheck`: PASS.
- `pnpm governance`: PASS, 12 checks.
- `pnpm security:verify`: PASS.
- `pnpm lint`: PASS.
- Hosted-like `SUPABASE_DB_URL` with `--test`: refused before connection.
- Hosted-like `SUPABASE_DB_URL` with `ALLOW_NONLOCAL_DB=1 --test`: refused before connection; no hosted override exists.

## Safety Boundary

No SQL apply, seed, reset, e2e, visual, or DB mutation command was run against hosted Supabase. SQL behavior was reviewed from migration/test source and local static/test gates only.
