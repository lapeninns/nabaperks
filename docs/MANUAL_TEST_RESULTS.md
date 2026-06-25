# Nabaperks — Manual Test Execution Results

**Date:** 2026-06-22 · **Scope:** all scenarios in [`docs/MANUAL_TEST_SCENARIOS.csv`](MANUAL_TEST_SCENARIOS.csv) **except payment/billing** (per request).

## Environment

| Item | Value |
| --- | --- |
| App (dev mode) | `next dev`, serverId `e9b88552…`, autoPort (local) |
| Supabase | local disposable — API `127.0.0.1:54321`, DB `:54322`, Studio `:54323` |
| Data | `pnpm db:setup` seed; demo customer `+447467586751`, dev OTP `424242` |
| Method | Browser-driven (preview tools) + DB assertions via psql + suite runs |
| Safety | All data local/disposable — no hosted/remote mutation |

## Headline

| Result | Count | Notes |
| --- | --- | --- |
| **PASS (executed live)** | 54 | Driven in-browser/DB with captured evidence |
| **PASS (suite-corroborated)** | — | Unit **676/677**; SQL/RLS **7/7** green |
| **FAIL** | 1 | `no-legacy-naming` static guard (pre-existing; see below) |
| **BLOCKED (not hand-executable)** | 14 | DST, concurrency races, MFA TOTP, bundle inspect, outage injection |
| **EXCLUDED (payment)** | 18 | `MER-BIL-*`, `CUST-BIL-*`, `ADM-BIL-*`, `X-RES-03` |
| **NOT RUN LIVE (suite/unit-covered)** | remainder | Lower-priority variants; covered by green unit suite |

The single FAIL is **not** in a tested flow — it is a repo-hygiene guard:
`scripts/major-capability-scenario-manifest.mjs` still contains a retired `/staff`
route token (`no-legacy-naming.test.ts`). Maps to **X-COPY-03**. Pre-existing.

---

## 1. Customer — executed live (all PASS)

| ID | Result | Evidence |
| --- | --- | --- |
| CUST-QR-01 | PASS | New-visitor scan → Old Crown join screen |
| CUST-QR-02 | PASS | Member scan → "You're stamped for today" (stamp-confirm) |
| CUST-QR-03 | PASS | `/q/unknown…` → "Card unavailable", no merchant/id leak |
| CUST-OTP-01 | PASS | `07467586751` accepted → stored/shown `+447467586751` |
| CUST-OTP-06 | PASS | Code `424242` verified → proceeds |
| CUST-OTP-07 | PASS | `000000` → "That code was not accepted.", stays on step |
| CUST-CON-01 | PASS | Terms + verify → membership created, first stamp |
| CUST-CON-02 | PASS | Loyalty terms (required) separate from marketing (optional) |
| CUST-CON-03 | PASS | Marketing unchecked → no consent (also SQL test) |
| CUST-CON-05 | PASS | Reward terms shown on join/card |
| CUST-STA-01 | PASS | Pre-unlock count/target + sealed mystery teaser |
| CUST-STA-02 | PASS | Stamp day 1 → "1 of 3", next-business-day prompt |
| CUST-STA-03 | PASS | Same-day re-stamp blocked ("You're stamped for today") |
| CUST-STA-04 | PASS | Day-2 stamp via UI → "2 of 3" |
| CUST-STA-05 | PASS | Eligible state shows active "Add today's stamp" |
| CUST-STA-07 | PASS | Stamp 3 → one weighted reward ("Free pint") unlocked |
| CUST-STA-10 | PASS | Stamp 3 without GPS still issued (LOW fraud flag written) |
| CUST-STA-13 | PASS | No raw lat/lon stored (fraud readback bucketed) |
| CUST-REW-01 | PASS | Waiting state: "yours from 23 JUN", no redeem |
| CUST-REW-02 | PASS | After make-redeemable → "READY" |
| CUST-REW-03 | PASS | Merchant-scan QR shown, no tap-to-redeem |
| CUST-REW-05 | PASS | Post-redeem "closed" (UI + DB `status=redeemed`) |
| CUST-REW-06 | PASS | Cycle reset: `current_stamp_count=0`, history kept |
| CUST-REW-09 | PASS | Future `redeemable_from` blocked redeem |
| CUST-REW-10 | PASS | Scan token (`515c…`) ≠ reward id, 10-min expiry |
| CUST-REW-11 | PASS | Reward terms on reward page |
| (reward profile gate) | PASS | Name + DOB required before QR; email optional |

## 2. Merchant — executed live (all PASS)

| ID | Result | Evidence |
| --- | --- | --- |
| MER-AUTH-01 | PASS | `mia@old-crown-girton.test` → `/app` |
| MER-DASH-01 | PASS | Own-venue metrics only (Members 10, Stamps 22…) |
| MER-DASH-03 | PASS | Totals reflect the journey's stamps/rewards |
| MER-ACT-01 | PASS | Activity feed mirrors join/stamp×3/unlock/scan |
| MER-CUS-01 | PASS | Masked: "Phone ending 6751", "j***@example.test" |
| MER-CUS-06 | PASS | Rows show stamps/last date/reward status |
| MER-CARD-01/02 | PASS | Card READY (Morning Ritual Mystery Card) |
| MER-RWD (ready) | PASS | Reward step READY |
| MER-VEN (ready) | PASS | Venue step READY |
| MER-QR-01 | PASS | Active QR + URL `…/q/old-crown-girton-qr` |
| MER-QR-05/06 | PASS | PNG/poster/print templates present |
| MER-SCAN-01 | PASS | Scan loads ticket + masked customer/card |
| MER-SCAN-02 | PASS | "Mark collected" → REDEEMED/DONE (DB confirms) |
| MER-SCAN-03 | PASS | Re-open consumed token → closed, no collect button |
| MER-SCAN-04 | PASS | Segment is scan token, not durable reward id |

## 3. Admin — executed live (all PASS)

| ID | Result | Evidence |
| --- | --- | --- |
| ADM-ACC-02 | PASS | `admin@nabaperks.test` → `/admin` console |
| ADM-MER-01 | PASS | Merchants list + plan status (active/trial) |
| ADM-CUS-01 | PASS | Stamp +1 with reason → count 0→1, audited |
| ADM-AUD-01 | PASS | Audit readback: actor/action/context/target/time |
| ADM-AUD-02 | PASS | `stamp_adjusted·admin`, `reward_redeemed·customer` logged |
| ADM-FRD-01 | PASS | Geofence-unknown fraud flag created (LOW/OPEN) |
| ADM-FRD-02 | PASS | Bucketed location, masked customer, no raw coords |
| ADM-PIL-04 | PASS | Pilot funnel metrics from `product_events` |

## 4. Cross-cutting — executed live (all PASS)

| ID | Result | Evidence |
| --- | --- | --- |
| X-COPY-01 | PASS | en-GB, no emoji/exclamation across all surfaces; "Save my card" |
| X-RESP-01 | PASS | 375px: no horizontal overflow, CTAs ≥44px (screenshot) |
| X-OBS-01 | PASS | Events written (activity feed + `product_events` + `audit_logs`) |

## 5. Suite-corroborated (ran green this session)

- **Unit suite — 676/677 pass** (`pnpm test`). Covers the bulk of unit-evidence
  scenarios across every phase. The 1 fail is the naming guard noted above.
- **SQL / RLS — 7/7 pass** (`pnpm db:test:rls`): `tenant_isolation`,
  `profile_completion_gate`, `reward_redemption_cycles`,
  `cycle_stamp_soft_geofence`, `customer_marketing_consent`,
  `customer_contact_immutability`, `performance_indexes`.

These provide real evidence for, e.g.: **MER-ISO-01/02, X-SEC-04** (tenant
isolation); **ADM-PIL-02** (concurrent redemption ≤1 success), reward-cycle &
duplicate-redemption; **CUST-STA-08/09/11/12** & **ADM-FRD-02** (soft geofence);
**CUST-CON-04/07** (consent); **CUST-IMM-01..04** (contact immutability,
DB-trigger enforced).

## 6. Blocked — not hand-executable in this environment (with reason)

| ID(s) | Reason | Where it IS covered |
| --- | --- | --- |
| CUST-STA-06 | DST rollover needs clock control | unit (`uk_business_date`) |
| CUST-STA-19 | Two-tab race needs 2 sessions | SQL cycle/atomicity |
| CUST-REW-04 | Live-poll proof needs 2nd tab | live-poll region present; `e2e:reward-merchant-scan-live` |
| ADM-ACC-03/04 | `ADMIN_MFA_REQUIRED` unset; needs TOTP enrol | unit + `security:verify` |
| X-SEC-01 | Needs built-bundle inspection | `security:verify` |
| X-OBS-02, X-RES-01/02 | Provider-outage fault injection | unit resilience tests |
| MER-VEN-02/09 | Google Places needs Maps API key | unit (`venue-address-lookup`) |
| CUST-OTP-09/11, CUST-STA-16 | Rate-limit thresholds | unit (`rate-limit`) + SQL |

## 7. Excluded — payment (per request)

`MER-BIL-01..08`, `CUST-BIL-01/02`, `ADM-BIL-01..07`, `X-RES-03` (18 scenarios).

---

## Defects found

1. **`no-legacy-naming` guard FAILS** — `scripts/major-capability-scenario-manifest.mjs`
   contains a retired `/staff` route token. Static/CI hygiene only; no user-facing
   impact. (X-COPY-03.) Recommend fixing the manifest or the guard's allowlist.

No functional defects found in the customer, merchant, or admin flows exercised.
