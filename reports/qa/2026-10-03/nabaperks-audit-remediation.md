# Nabaperks audit remediation

Checked: 2026-10-03. Candidate scope: **SCOPED_LOCAL_REMEDIATION_VERIFIED**.
Artifact stage: **FROZEN**; artifact QA: **PASS**.

Five scoped local corrections are tracked here. Passing local boundaries do not establish whole-product or release acceptance.

The frozen original retains **PARTIAL_RETAINED_FINDINGS / NOT_READY**. Its exact source SHA has not been rewritten or fixed in place.

## Source and preservation

- Base: `a62c3ea2965ff78943c6cedff37860e65fcd2d1d`.
- Branch: `codex/audit-remediation-20261003`.
- Checkout: `/Users/amankumarshrestha/.codex/worktrees/nabaperks-audit-remediation/naba-perks`.
- Candidate: Base a62c3ea plus the uncommitted scoped remediation diff. No new commit exists.
- Source fingerprint: `21dc583c59bb8911f9640bc0c991a2a4eb7d67da3c64aa057b8d1bde03093130`.
- Frozen original: [/Users/amankumarshrestha/Documents/Codex/qa-nabaperks-a62c3ea-20261002](/Users/amankumarshrestha/Documents/Codex/qa-nabaperks-a62c3ea-20261002/CLOSURE-CHECKPOINT.md).
- Original closure archive SHA-256: `d71e3c6d9d8ecdf0af5cb676efe90edfb8d6a697ec27b747474ded55b7636c89`.

The original 1,435-file audit and 2,715-member closure archive remain historical. This separate pack does not replace their ledgers, verdicts, unrun clauses or historical failures.

## Verification boundaries

| Boundary                            | Actual status             | Detail                                                                                                                                                                                                                                                                                                             | Invocation                                                                        | Receipt                                                                                     |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Focused unit boundaries             | PASS_AT_DECLARED_BOUNDARY | 15 recovery/continuity + 27 billing + 42 shared QR/poster + 10 worker tests. Shared suite is counted once. Full final quality rerun separately passes.                                                                                                                                                             | `Per-finding commands below, with Node 24.18.0`                                   | evidence/unit-proof.json                                                                    |
| Final integrated quality            | PASS_AT_DECLARED_BOUNDARY | Final quality attempt 005 exits 0: 862 contract tests and 2876 unit tests pass, 0 fail, 0 skipped. Clean baseline environment with required owned local HMAC prerequisite; no NODE_OPTIONS override. Earlier failed attempts remain diagnostic history.                                                            | `pnpm quality:check`                                                              | evidence/quality.json                                                                       |
| Production build                    | PASS_AT_DECLARED_BOUNDARY | Root pnpm build exit 0 with Node 24.18.0, pnpm 10.28.0 and production webpack. Nine built-production HTTP cases and exact fixture-state readback also pass. Local guard-only provider sink; no deployment acceptance.                                                                                              | `pnpm build; built-runtime HTTP/state driver`                                     | evidence/build.json; evidence/built-runtime.json                                            |
| Browser and local database          | PASS_AT_DECLARED_BOUNDARY | Root billing/worker browser 12/12; QR/poster 6/6 desktop/mobile; recovery 1/1 desktop. Fresh local fixture/readback limitations remain explicit.                                                                                                                                                                   | `Standalone e2e run; exact per-lane invocations retained with authoring receipts` | evidence/root-browser.json; evidence/qr-poster-browser.json; evidence/recovery-browser.json |
| Artifact manual QA                  | PASS_AT_DECLARED_BOUNDARY | Root viewer 3/3 passes desktop/tablet/mobile controls and geometry; every nine-page PDF page was directly inspected. Earlier real research-link overflow and a separate locator harness error remain preserved. Final-byte root capture and two independent visual PASS receipts are required before ZIP creation. | `Viewer e2e plus PDF page rendering and direct inspection`                        | evidence/artifact-qa.json; evidence/visual-a.json; evidence/visual-b.json                   |
| Hosted / protected release          | NOT_RUN_OUTSIDE_SCOPE     | Historical seven PASS roots, fast FAIL and visual SKIP do not become green. No commit, push, merge or deployment is authorized.                                                                                                                                                                                    | `No hosted candidate run requested`                                               | Frozen original hosted report                                                               |
| Provider / real customer acceptance | NOT_RUN_OUTSIDE_SCOPE     | No production write or real Twilio, Stripe, Resend or Web Push outcome is claimed.                                                                                                                                                                                                                                 | `No provider write requested`                                                     | None                                                                                        |

## BUG-A62-001: Recovery resend retains the earlier proof after delivery failure

Status: **LOCAL_BOUNDARY_VERIFIED**.

A failed recovery email resend cleared the pending proof and lost useful feedback, leaving the guest unable to continue with the previously issued code.

The recovery resend preserves the previous pending proof until replacement delivery succeeds. Failed or refused delivery keeps the earlier proof and expiry, returns clear feedback, and issues no customer session. Success replaces the pending proof only after delivery.

**Exact scenario:** Call the real recovery action with a bound pending email recovery and failed delivery, successful delivery, admission refusal, device proof, phone proof, and absent proof.

**Binary observable:** Failure keeps the previous pending proof and expiry, exposes failure feedback and issues zero sessions. Success accepts only the delivered replacement. Refused or ineligible states dispatch no message.

**Before:** Final regression replay on pinned base: 7 tests, 5 pass, 2 fail, 0 skipped; command exit 1. The product red is retained separately from earlier harness attempts.

**After:** Focused final unit and continuity-contract run: 15 tests, 15 pass, 0 fail, 0 skipped; command exit 0. This includes the final 7 recovery tests, digest binding and continuity contract controls.

```sh
node scripts/ci/node-test-runner.mjs --import ./tests/support/register-alias.mjs --test tests/unit/customer-access-recovery-resend.test.mjs tests/unit/customer-access-recovery-hmac.test.mjs tests/contracts/customer-access-continuity.test.mjs
```

Safe receipts: [evidence/recovery-red.txt](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/recovery-red.txt), [evidence/recovery-green.txt](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/recovery-green.txt), [evidence/recovery-browser.json](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/recovery-browser.json), [evidence/recovery-state.json](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/recovery-state.json)

Changed files: `lib/customer/access-continuity.ts`, `tests/unit/customer-access-recovery-resend.test.mjs`.

**Manual proof:** Fresh owned fixture: standalone e2e 1/1 PASS, visible failure feedback, code field and enabled retry; pending proof and expiry unchanged; no customer session or loyalty row created. Empty-sender refusal occurs before transport. The zero-row fixture does not prove conservation of an existing nonzero stamp balance. Exact invocation: e2e run --config e2e.config.ts --output browser-green-001 --reporter list,markdown --trace off --no-cache from recovery-feedback/.

**Limits:** Deterministic action-boundary proof uses controlled delivery adapters. Browser feedback, persisted recovery continuation and actual provider delivery are separate evidence states.

## BUG-A62-002: Confirmed billing returns schedule cache invalidation after rendering

Status: **LOCAL_BOUNDARY_VERIFIED**.

An owned completed checkout committed billing and QR readiness but the launch return displayed That did not load. Immediate cache invalidation ran inside the Next render phase.

Both confirmed checkout and portal returns call supported Next after() with revalidateMerchantLaunchSurfaces after readiness and QR provisioning. The return can render before cache invalidation. Catching-up outcomes schedule no invalidation.

**Exact scenario:** Execute confirmed checkout and portal return workflows inside actual installed Next work/work-unit async contexts; drain the actual AfterContext only after rendering. Include a catching-up checkout control.

**Binary observable:** Both confirmed returns render without the Next during-render revalidateTag error. No cache invalidation occurs during render; deferred cache paths/tags execute after response completion. Catching-up has no callback.

**Before:** Corrected real Next render context: 3 tests, 1 pass, 2 fail, 0 skipped; exit 1. Initial AsyncLocalStorage harness misconfiguration is preserved as infrastructure evidence and is excluded from product-red counting.

**After:** Billing contracts plus runtime regression: 27 tests, 27 pass, 0 fail, 0 skipped; exit 0.

```sh
node scripts/ci/node-test-runner.mjs --import ./tests/support/register-alias.mjs --test tests/unit/billing-return-render-phase.test.mjs tests/unit/billing-checkout-return.test.mjs tests/unit/billing-checkout-core.test.mjs
```

Safe receipts: [evidence/billing-red.txt](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/billing-red.txt), [evidence/billing-green.txt](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/billing-green.txt), [evidence/root-browser.json](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/root-browser.json), [evidence/built-runtime.json](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/built-runtime.json)

Changed files: `lib/merchant/billing-checkout-return.ts`, `tests/unit/billing-return-render-phase.test.mjs`.

**Manual proof:** Standalone root e2e run-002 passes on desktop and mobile: owned verified checkout renders You're live and Checkout confirmed; portal renders Billing details refreshed; unknown checkout stays unconfirmed. HTTP readback finds no render crash and the exact fixture state unchanged. Earlier advisory banner predicates used incorrect strings and are not banner proof or product failures. Exact browser assertions provide the heading proof. Local Stripe transport adapters are disclosed; no actual payment is claimed.

**Limits:** The render-phase regression uses actual installed Next cache and after contexts with controlled Stripe/QR boundaries. Served local return and independent state readback pass with an existing genuine local Auth fixture and recorded Stripe GET-only sink. No live payment or hosted rollout is inferred.

## CASE-009-002: Paused QR recovery explains that the QR is paused

Status: **LOCAL_BOUNDARY_VERIFIED**.

A paused QR rendered generic broken-QR copy, failing the audit's literal paused-state oracle even though safe recovery was visible.

The landing read model preserves the QR pause state. The page explains the pause, retains safe recovery navigation, and avoids membership and stamp actions. Suspended-venue state remains distinct from QR pause.

**Exact scenario:** Resolve a switched-off QR, a suspended venue with an active QR, and render the paused receipt. Retain available, re-enabled, transient failure and signed-out controls.

**Binary observable:** The visible receipt contains paused wording; the read model carries the correct pause flag. No membership or stamp mutation occurs in the unavailable lane.

**Before:** Shared QR/poster base reproduction: 18 tests, 14 pass, 4 fail, 0 skipped; exit 1. Three failures concern preserved pause/suspension state and paused copy; one concerns poster status.

**After:** Final expanded shared QR/poster contracts and units: 42 tests, 42 pass, 0 fail, 0 skipped; exit 0. Earlier 24/24 is intermediate evidence. The shared suite is counted once across both findings.

```sh
node scripts/ci/node-test-runner.mjs --import ./tests/support/register-alias.mjs --test tests/contracts/customer-p2-polish.test.mjs tests/contracts/public-qr-router-contract.test.mjs tests/unit/qr-entry-failures-bug-041-042.test.mjs tests/unit/public-qr-stale-unavailable-bug-041.test.mjs tests/unit/invalid-poster-response-status.test.mjs tests/unit/customer-session-dead-cookie-clearing.test.mjs
```

Safe receipts: [evidence/qr-poster-red.txt](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/qr-poster-red.txt), [evidence/qr-poster-green.txt](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/qr-poster-green.txt), [evidence/qr-poster-browser.json](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/qr-poster-browser.json), [evidence/qr-state.json](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/qr-state.json)

Changed files: `lib/customer/join.ts`, `app/q/[qrId]/qr-entry.ts`, `app/q/[qrId]/page.tsx`, `tests/contracts/customer-p2-polish.test.mjs`, `tests/contracts/public-qr-router-contract.test.mjs`, `tests/support/public-qr-page.mjs`, `tests/unit/qr-entry-failures-bug-041-042.test.mjs`, `tests/unit/public-qr-stale-unavailable-bug-041.test.mjs`, `tests/e2e/public-qr-router-live-db.spec.ts`.

**Manual proof:** Standalone QR/poster browser-final-002: 6/6 PASS across desktop and mobile. Customer scans are paused appears with recovery links and no loyalty entry. Fresh fixture counts remain stamps 1, earned 1, redeemed 0, stamp events 0, reward events 0 and QR inactive. This is fixture conservation, not the historical customer's actual balance.

**Limits:** The suite proves pause-state propagation and guards; served desktop/mobile and owned local DB readbacks prove this fixture boundary. The updated project live-DB Playwright spec was not executed. Physical camera scanning and hosted visual approval remain unproved.

## CASE-021-002: Invalid poster templates return HTTP 404 before streaming

Status: **LOCAL_BOUNDARY_VERIFIED**.

The invalid poster displayed the correct no-image recovery while responding HTTP 200; the authored status oracle requires 404.

The proxy marks invalid poster-template route responses as 404 before route streaming starts. Supported templates and neighboring routes preserve their existing response behavior.

**Exact scenario:** Request an invalid poster-template pathname; retain controls for valid tally, encoded valid template, malformed path encoding, neighboring tent, extra path segment and ordinary QR route.

**Binary observable:** Invalid poster template is HTTP 404 and retains the existing no-image recovery. Valid and unrelated route responses preserve status. Authentication and ownership checks remain required.

**Before:** Shared QR/poster base reproduction: HTTP response assertion observed 200 rather than required 404; suite totals 18 tests, 14 pass, 4 fail, 0 skipped; exit 1.

**After:** Final shared QR/poster contracts and units: 42 tests, 42 pass, 0 fail, 0 skipped; exit 0. Earlier 24/24 is intermediate. Encoded and malformed-path controls are included.

```sh
node scripts/ci/node-test-runner.mjs --import ./tests/support/register-alias.mjs --test tests/contracts/customer-p2-polish.test.mjs tests/contracts/public-qr-router-contract.test.mjs tests/unit/qr-entry-failures-bug-041-042.test.mjs tests/unit/public-qr-stale-unavailable-bug-041.test.mjs tests/unit/invalid-poster-response-status.test.mjs tests/unit/customer-session-dead-cookie-clearing.test.mjs
```

Safe receipts: [evidence/qr-poster-red.txt](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/qr-poster-red.txt), [evidence/qr-poster-green.txt](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/qr-poster-green.txt), [evidence/qr-poster-browser.json](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/qr-poster-browser.json), [evidence/built-runtime.json](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/built-runtime.json)

Changed files: `proxy.ts`, `tests/unit/invalid-poster-response-status.test.mjs`.

**Manual proof:** Standalone QR/poster browser-final-002: authenticated invalid poster HTTP 404, visible Poster not found heading, zero images and Back to Poster recovery link on desktop/mobile. Unauthenticated invalid-poster access retains HTTP 307 authentication redirect. Exact HTTP evidence is retained separately from visual behavior.

**Limits:** Proxy, actual authenticated browser recovery and built-production HTTP checks pass at their stated local boundaries. Foreign QR recovery retains HTTP 200 with zero images; tenant authorization remains authoritative. No visual baseline was changed.

## CONT-033-T02: Malformed notification text uses the existing 180-character limit

Status: **LOCAL_BOUNDARY_VERIFIED**.

The malformed-JSON fallback passed raw push text to the notification body; the original audit observed a 201-character body against the 180-character limit.

Malformed JSON fallback text now passes through cleanNotificationText, trimming outer whitespace, capping at 180 characters, and using the existing account-update body when blank. Existing destination allowlisting is retained.

**Exact scenario:** Invoke the registered push listener in the real worker source with oversized malformed text, whitespace-only text, empty text, missing data, valid JSON, oversized JSON, and a foreign destination.

**Binary observable:** Actual showNotification arguments contain the trimmed first 180 characters or existing default body. The foreign destination and requested window path both resolve to /home.

**Before:** Pinned worker source: 10 tests, 8 pass, 2 fail, 0 skipped; exit 1. Oversized malformed text and whitespace-only fallback failed.

**After:** Patched real worker VM execution: 10 tests, 10 pass, 0 fail, 0 skipped; exit 0. Seven observed notification option objects are captured separately.

```sh
node scripts/ci/node-test-runner.mjs --test tests/unit/service-worker-push.test.mjs
```

Safe receipts: [evidence/notification-red.txt](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/notification-red.txt), [evidence/notification-green.txt](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/notification-green.txt), [evidence/root-browser.json](/Users/amankumarshrestha/Documents/Codex/nabaperks-remediation-20261003/deliverables/evidence/root-browser.json)

Changed files: `public/sw.js`, `tests/unit/service-worker-push.test.mjs`.

**Manual proof:** Root run-002 passes the production-installed worker's malformed long text, blank text and valid external destination on desktop/mobile. Synthetic push and the isolated local notification adapter observe actual installed worker output. Trusted OS displayed-notification clicking and real Web Push remain outside that proof.

**Limits:** Deterministic VM proof observes actual worker callbacks; an installed-browser worker is a separate scenario. Trusted native notification clicking and real Web Push delivery retain their own prerequisites.

## Retained findings and prerequisites

- CASE-002-003: successful signup PKCE callback remains PARTIAL because the actual code exchange is refused by the immutable OTP/TOTP policy with 403. Resolution needs an authorized policy prerequisite; no policy patch is included.
- CASE-033-001: trusted native displayed-notification click remains blocked because the accessible native surface exposes no trusted click target. Installed-worker creation or a synthetic callback does not close that clause.
- Four oracle dispositions remain model issues: selected first-handoff AUDIT_MODEL_DEFECT; referral conflict exception phase AUDIT_MODEL_DISPUTE; supplemental SQL CLI refusal primitive and alerts 503 versus authored 500 AUDIT_MODEL_DISPUTE. No business behavior was changed to satisfy those models.
- Frozen hosted snapshot: seven roots PASS, fast FAIL, actual visual matrix SKIPPED, CodeQL PASS. Four Linux merchant visual failures and missing historical visual-002 pixels remain. No baselines, masks, tolerances or budgets were changed.
- The historical original has 1,435 earlier deliverable files and a 2,715-member closure archive. Its 76 canonical, 140 selected and 130 supplemental populations remain historical; these five local corrections do not rewrite those ledgers.
- LSP diagnostics are unavailable: the TypeScript language server is absent and installation was declined. No configuration change was made. This limitation remains distinct from executed lint/type/test checks.
- A local diagnostic incident is retained: an initial root parser matched the local PKCE code-verifier cookie as an auth-token cookie and its JSON parsing exception printed an owned local verifier into session output. Exact cookie-name matching and safe private JSON errors corrected the diagnostic. No production or provider credential exposure is claimed; private authentication fixtures and verifier/key values are excluded from export.
- A read-only local database inspection initially queried a wrong reward table name; the actual reward_events boundary was then used. The harmless failed read occurred before mutation and remains in private diagnostic history. It is not a product regression or passing state proof.
- Earlier quality attempts retain their actual failures: root reserved variable names were corrected; missing HMAC prerequisite caused one unit failure; a full runtime NODE_OPTIONS guard conflicted with compiler-boundary tests. Final attempt 005 uses a clean baseline plus the private HMAC prerequisite and passes. No assertion, budget or test skip was weakened.
- Application deployment, database promotion, protected approval, served production revision, real provider delivery and actual customer acceptance remain unperformed and unproved.

## Research and chosen approach

- Primary upstream reviewed: vercel/next.js, MIT, 143,004 stars checked 2026-10-03; inspected SHA 65498960a66473c0bf937ad41270e27b33949854. Stars are a discovery filter, not suitability proof.
- Inspected packages/next/src/server/after/after-context.ts and test/e2e/app-dir/revalidate-tag-in-after/revalidate-tag-in-after.test.ts, plus installed Next 16.3.6 after.md. The chosen approach adapts the supported after() lifecycle, adds no dependency, and keeps provider/identity authorization within existing project boundaries.
- Upstream implementation: https://github.com/vercel/next.js/blob/65498960a66473c0bf937ad41270e27b33949854/packages/next/src/server/after/after-context.ts
- Upstream regression: https://github.com/vercel/next.js/blob/65498960a66473c0bf937ad41270e27b33949854/test/e2e/app-dir/revalidate-tag-in-after/revalidate-tag-in-after.test.ts

## Reproduction prerequisites

1. Use the exact checkout and base SHA named above. The candidate is an uncommitted diff, so replay requires the captured source fingerprint and file inventory, not merely checkout of the base SHA.
2. Use Node 24 from .nvmrc and pnpm 10.28.0. Keep existing .env.local private. No environment templates or real provider values are copied into this sanitized pack.
3. Run per-finding deterministic commands from the repository root. Base-red replay uses final regressions on fresh copied base sources; preserve the original red and any harness-error dispositions.
4. For browser proof, verify the owned local URL, served revision, fresh fixture provenance, local adapters, sink prerequisites and persisted-state readback. With Node 24 first on PATH, the root invocation from browser/ is /Users/amankumarshrestha/node_modules/.bin/e2e run --config e2e.config.ts --output run-002 --no-cache. The QR invocation from qr-poster/ is QR_POSTER_FIXTURE_FILE=<private fixture> QR_POSTER_AUTH_FILE=<private current merchant cookies> /Users/amankumarshrestha/node_modules/.bin/e2e run --config e2e.config.ts --output browser-final-002 --no-cache. The placeholders identify private prerequisites; they are not executable credentials. Historical fixture identifiers are not reusable ownership authority.
5. Successful PKCE callback needs a compatible authorized Auth policy. Native notification activation needs an accessible trusted click target. Real provider outcomes require separate scope and environment authority.
6. The bounded generator reads only remediation-ledger.json and templates. The validator permits only explicitly reviewed deliverable members, rejects private directories, env files, cookies, credential-shaped values, raw traces/logs and database files, and independently reads every archived member.

## Cleanup and artifact integrity

Owned app/sink processes were closed after PID, cwd, command and port identity checks; ports 3203, 3205, 3206 and 3207 are closed. Shared databases, original audit fixtures and the new QR fixture remain retained. Viewer port 3208 serves only deliverables for final artifact QA. The task-generated tsconfig was privately backed up and restored to exact base bytes; pnpm typecheck then exited 0. Root preservation receipt confirms all 17 candidate file hashes, the original checkout's dirty diff, historical archive hash, three copied private fixture bytes and the unchanged lockfile. No shared service reset or provider cleanup occurred.

The archive contains only the explicit reviewed allowlist. Private runtimes, environment values, cookies, credential-bearing payloads, raw traces, raw logs and database data are excluded. Manifest hashes bind every included file. CRC, exact-member comparison and full member hash readback are separate artifact checks. The external archive validation and checksum are written only after root freeze authority and final artifact QA.
