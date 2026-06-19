# Remediation lane B evidence

Date: 2026-06-19
Worktree: `/Users/amankumarshrestha/.codex/worktrees/aa82/Nabaperks`

## Scenarios

1. Cycle stamp GPS gating
   - Invocation: `pnpm exec vitest run tests/micro-specs/self-service-stamping.test.ts`
   - Red observable before production change: exit 1; four new GPS tests failed because `shouldRequestStampLocation`, `prepareSelfStampFormData`, and `resolveStampLocation` were not exported.
   - Final observable: included in focused final run below; `tests/micro-specs/self-service-stamping.test.ts` passed 20 tests.
   - Proves:
     - no `navigator.geolocation.getCurrentPosition` call when geofence is disabled or next stamp is not cycle stamp 3.
     - cycle stamp 3 GPS is requested before submit payload preparation.
     - denial memory does not skip the current GPS attempt and returns `denied_remembered` only after current permission denial.
     - denied, timeout, and unsupported outcomes remain non-blocking and append `locationStatus` plus `locationElapsedMs`.

2. Dev preview stamp-day-3 primary action
   - Invocation: `pnpm exec vitest run tests/micro-specs/customer-flow-preview.test.ts`
   - Final observable: included in focused final run below; `tests/micro-specs/customer-flow-preview.test.ts` passed 3 tests.
   - Proves `stamp-day-3-confirm` renders a primary action link to `/dev/customer-flow/preview/card-3-of-3-unlocked`.

3. Source-string GPS test replacement
   - Invocation: `pnpm exec vitest run tests/micro-specs/customer.test.ts`
   - Final observable: included in focused final run below; `tests/micro-specs/customer.test.ts` passed 24 tests.
   - Proves the older source-string GPS assertions were removed while the customer contract suite still passes.

## Verification

1. `pnpm typecheck`
   - Exit: 0
   - Binary observable: `tsc --noEmit` completed with no diagnostics.

2. `NODE_PATH="$PWD/node_modules" bun /Users/amankumarshrestha/.codex/plugins/cache/sisyphuslabs/omo/4.11.1/skills/programming/scripts/typescript/check-no-excuse-rules.ts components/customer/self-service-forms.tsx components/customer/stamp-collector.tsx app/dev/customer-flow/preview/mock-forms.tsx app/dev/customer-flow/preview/screens.tsx tests/micro-specs/self-service-stamping.test.ts tests/micro-specs/customer.test.ts tests/micro-specs/customer-flow-preview.test.ts`
   - Exit: 0
   - Binary observable: `No violations in 7 file(s).`

3. `pnpm exec vitest run tests/micro-specs/self-service-stamping.test.ts tests/micro-specs/customer-flow-preview.test.ts tests/micro-specs/customer.test.ts`
   - Exit: 0
   - Binary observable: 3 test files passed, 47 tests passed.
   - Noted stderr: existing tests emit expected logger lines and React invalid-hook-call warnings while still passing.

## Changed files

- `components/customer/self-service-forms.tsx`
- `components/customer/stamp-collector.tsx`
- `app/dev/customer-flow/preview/mock-forms.tsx`
- `app/dev/customer-flow/preview/screens.tsx`
- `tests/micro-specs/self-service-stamping.test.ts`
- `tests/micro-specs/customer.test.ts`
- `tests/micro-specs/customer-flow-preview.test.ts`

