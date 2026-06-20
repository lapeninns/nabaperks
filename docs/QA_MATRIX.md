# Nabaperks QA Matrix

The master map from every current micro-spec requirement to its risk class, covered
behaviour, test type, evidence path, verification command, current status, and any
known gap. "100% QA" here means every important requirement has appropriate evidence
at the right layer — not literal 100% line coverage.

- **Source of truth for intent:** [`docs/PROJECT_SPEC.md`](PROJECT_SPEC.md), [`docs/ARCHITECTURE.md`](ARCHITECTURE.md).
- **Source of truth for governance:** [`micro-specs/README.md`](../micro-specs/README.md), [`micro-specs/GLOBAL_CONTEXT.md`](../micro-specs/GLOBAL_CONTEXT.md).
- **Machine-readable traceability:** [`micro-specs/traceability.json`](../micro-specs/traceability.json) / [`micro-specs/TRACEABILITY.md`](../micro-specs/TRACEABILITY.md).
- **Route contract:** [`docs/ROUTES.md`](ROUTES.md). **Observability:** [`docs/OBSERVABILITY.md`](OBSERVABILITY.md).

> This document is reviewed against live code, not against the backlog. Where a
> requirement's only evidence is a manual rationale, that is stated explicitly in the
> "Gap / note" column so it is never mistaken for an automated gate.

---

## 1. Baseline evidence (this QA pass)

| Signal                           | Value                                                                  | Command                                                                               |
| -------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Unit suite                       | 581 tests / 70 files passing                                           | `pnpm test:coverage`                                                                  |
| Coverage (lib/\*\*)              | S 69.74% · B 57.57% · F 76.84% · L 72.51% (thresholds S60/B47/F67/L62) | `pnpm test:coverage`                                                                  |
| Static + quality gates           | passing (quality ratchet re-pinned 31 → 29)                            | `pnpm qa:static`                                                                      |
| Security checks                  | passing                                                                | `pnpm qa:security`                                                                    |
| Schema / migration static checks | passing                                                                | `pnpm db:verify`                                                                      |
| SQL / RLS checks                 | passing against disposable local Supabase (`127.0.0.1:54322`)          | `pnpm db:test:rls`                                                                    |
| Customer e2e flow                | passing (89 Playwright tests)                                          | `CUSTOMER_DEV_OTP_CODE=424242 pnpm qa:e2e`                                            |
| Visual screenshots               | passing (customer, launch, design-system)                              | `CUSTOMER_DEV_OTP_CODE=424242 pnpm qa:visual`                                         |
| Accessibility                    | passing (10 WCAG A/AA axe surfaces, colour contrast enabled)           | `pnpm qa:a11y`                                                                        |
| All-route render sweep           | 44 routes × 3 viewports = 132 captures, 0 issues                       | custom Playwright sweep, output `/tmp/nabaperks-proof-route-sweep-rerun/results.json` |
| Route contract                   | in sync                                                                | `pnpm docs:routes:check`                                                              |

Counts include the tests added in this QA pass (see §6). Re-run the commands to
refresh; do not edit the numbers without re-running. The pre-pass coverage baseline
was S 66.3% / B 54.4% / F 72.8% / L 68.9% across 512 tests.

---

## 2. Risk class → required gates → qa:\* command

Gates come from the governance risk-to-gate mapping; the `qa:*` column is the
aggregate script that runs them (added to `package.json` in this pass).

| risk_class          | Required gates                                        | qa:\* command(s)                                         |
| ------------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `docs-tooling`      | governance, lint, typecheck, test                     | `qa:static`, `qa:unit`                                   |
| `ui-only`           | lint, typecheck, test, browser/playwright             | `qa:static`, `qa:unit`, `qa:visual`, `qa:a11y`           |
| `product-analytics` | lint, typecheck, test, coverage (when `lib/` changes) | `qa:static`, `qa:unit`                                   |
| `customer-pii`      | lint, typecheck, test, security:verify                | `qa:static`, `qa:unit`, `qa:security`                    |
| `auth-session`      | lint, typecheck, test, security:verify, build         | `qa:static`, `qa:unit`, `qa:security`, build (`qa:full`) |
| `billing`           | lint, typecheck, test, security:verify, build         | `qa:static`, `qa:unit`, `qa:security`, build (`qa:full`) |
| `webhooks`          | lint, typecheck, test, db:verify, security:verify     | `qa:static`, `qa:unit`, `qa:db`, `qa:security`           |
| `rls-rpc-ledger`    | lint, typecheck, test, db:verify, security:verify     | `qa:static`, `qa:unit`, `qa:db`, `qa:security`           |
| `migrations`        | lint, typecheck, test, db:verify, security:verify     | `qa:static`, `qa:unit`, `qa:db`, `qa:security`           |

### The `qa:*` scripts

| Script        | Runs                                                                                                                           | Runnable without external services?                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `qa:static`   | `typecheck` + `lint` + `quality` (governance, naming, todos, n+1, agents, route contract, lint:quality, deadcode, duplication) | Yes                                                      |
| `qa:unit`     | `test:coverage` (Vitest, mocked Supabase)                                                                                      | Yes                                                      |
| `qa:db`       | `db:verify` (static) + `db:test:rls` (live Postgres)                                                                           | `db:verify` yes; `db:test:rls` needs a **disposable** DB |
| `qa:e2e`      | `CUSTOMER_DEV_OTP_CODE=424242 playwright test` (all specs)                                                                     | Needs dev server + DB; **mutates** demo data             |
| `qa:visual`   | customer-flow + launch + design-system screenshot specs                                                                        | Needs dev server + DB; **mutates** demo data             |
| `qa:a11y`     | WCAG A/AA axe smoke over marketing, QR/merchant unavailable, customer previews, launch, design-system, offline, and 404        | Needs dev server                                         |
| `qa:security` | `security:verify` + focused auth/session/webhook/PII tests                                                                     | Yes                                                      |
| `qa:perf`     | `check:nplus1` + `deps:analyze` + `bundle:size`                                                                                | n+1/deps yes; `bundle:size` needs a prior `pnpm build`   |
| `qa:full`     | static → unit → security → db → build → perf → e2e → visual → a11y                                                             | No (DB + browser + build)                                |

Route timing (`pnpm perf:routes`) is a server-dependent check kept out of the
unconditional `qa:full` chain so the aggregate stays green in headless runs; run it
against a live server when measuring latency. See §5 Performance.

---

## 3. Requirement-level matrix (per micro-spec)

Evidence keys: `u:` = `tests/micro-specs/`, `sql:` = `supabase/tests/`,
`e2e:` = `tests/e2e/`, `manual:` = recorded manual rationale (no automated gate).
All product specs are `active`; the two governance specs are `implemented`.

### Phase 0 — MVP scope

**MS-MVP-SCOPE-RELEASE-GATES** · `docs-tooling` · gates: `qa:static`, `qa:unit`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Reject features outside the MVP boundary | unit + governance | u:analytics-dashboard-pilot, u:customer, u:self-service-stamping | — |
| 002 | One active location + one loyalty card per merchant | unit | u:self-service-stamping, u:customer | — |
| 003 | No app download required for customers | unit | u:customer | — |
| 004 | Valid venue QR, one stamp per date, action recorded | unit + sql | u:self-service-stamping | reinforced by sql:reward_redemption_cycles |
| 005 | Exactly one reward on the third visit | unit | u:self-service-stamping | — |
| 006 | Block redemption until next business day | unit | u:customer | — |
| 007 | Every release gate checked for pilot readiness | governance | u:analytics-dashboard-pilot, manual:legacy billing/admin Vitest filename | retained-name evidence noted |

### Phase 1 — Foundation

**MS-FOUNDATION-PROJECT-SHELL-ENVIRONMENTS** · `auth-session` · gates: `qa:static`, `qa:unit`, `qa:security`, build
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | App starts with valid env vars | unit + build | u:foundation, u:full-app-pwa | — |
| 002 | Clear error if a server-only secret is missing | unit | u:vercel-env-guard, u:foundation | — |
| 003 | Bundle excludes service-role and webhook secrets | security | u:foundation + `security:verify` | client-secret scan in verifier |
| 004 | Routes compatible with App Router structure | build | u:full-app-pwa, u:health-endpoint | — |
| 005 | Dev knows which vars each environment needs | unit | u:vercel-env-guard | `env:check` contract |

**MS-FOUNDATION-SUPABASE-SCHEMA-RLS-AUDIT** · `migrations` · gates: `qa:static`, `qa:unit`, `qa:db`, `qa:security`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Merchant owner sees only their records | sql-rls | sql:tenant_isolation | needs disposable DB to run |
| 002 | Customer sees only their own data | sql-rls | sql:tenant_isolation, u:customer | — |
| 003 | Admin support actions write audit logs | unit + sql | u:foundation, manual:legacy billing/admin filename | — |
| 004 | Billing/stamp/reward mutations write events | sql | sql:reward_redemption_cycles | — |
| 005 | Unauthenticated access to protected tables denied | sql-rls | sql:tenant_isolation | — |

**MS-FOUNDATION-WET-INK-MOTION-SYSTEM** · `ui-only` · gates: `qa:static`, `qa:unit`, `qa:visual`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Reduced motion renders static children | unit + browser | u:wet-ink-motion | browser via design-system catalog spec |
| 002 | StampDot slam timing + tilt | unit + browser | u:wet-ink-motion, u:earned-stamp-redesign | — |
| 003 | Optional WetInkShake wrapper | unit | u:wet-ink-motion | — |
| 004 | All 9 vocabulary exports available | unit | u:wet-ink-motion | — |
| 005 | No inline `animation: w-*` strings remain | unit/lint | u:wet-ink-motion | — |
| 006 | Motion tokens return Framer-compatible objects | unit | u:wet-ink-motion | — |

**MS-FOUNDATION-WET-INK-FULL-UI-REWRITE** · `ui-only` · gates: `qa:static`, `qa:unit`, `qa:visual`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Choreographed motion uses WetInk primitives | unit | u:wet-ink-motion | — |
| 002 | Wet Ink via tokens/data-slot, no `components/ui/**` edits | unit | u:foundation | — |
| 003 | British, value-first copy, no emoji/exclamation | manual | manual:copy-register-en-gb-review | **manual review only** |
| 004 | Single RewardSeal/RewardTicket vocabulary | unit | u:customer-flow-redesign | — |
| 005 | Customer self-service from permanent QR | unit | u:customer-flow-redesign | — |
| 006 | Merchant console mirrors reference shapes, PII masked | unit | u:merchant-readbacks | — |
| 007 | Loading skeletons | unit | u:merchant-readbacks | — |
| 008 | Admin quieter ink | unit | u:admin-console-redesign | — |
| 009 | Marketing composes reference, no localStorage | unit | u:marketing-redesign | — |
| 010 | Merchant auth keeps Supabase email+password | unit | u:auth-redesign | — |
| 011 | `/dev/design-system` catalog renders, static under reduced motion | browser | manual:dev-design-system-catalog-smoke, e2e:design-system-catalog, e2e:dev-harness-a11y-registry | registry-driven axe over all 18 customer-flow + 3 launch preview states |
| 012 | Loaders/redirects/actions unchanged | manual | manual:route-loaders-unchanged-diff-review | **diff review only** |

### Phase 2 — Merchant

**MS-MERCHANT-AUTH-ONBOARDING-BUSINESS-PROFILE** · `auth-session` · gates: `qa:static`, `qa:unit`, `qa:security`, build
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | New merchant signup creates/links owner | unit | u:marketing-auth-legal, u:foundation | — |
| 002 | Verified auth + no profile routes to onboarding | unit | u:marketing-auth-legal | — |
| 003 | Business fields create profile + first location | unit | u:merchant-launch-readiness | — |
| 004 | Invalid fields preserved with field errors | unit | u:marketing-auth-legal | — |
| 005 | Saved profile + no location recreates location | unit | u:merchant-launch-readiness | — |
| 006 | Returning post-onboarding routes onward | unit | u:merchant-launch-readiness | — |
| 007 | Onboarding mutations write product/audit events | unit | u:foundation | — |

**MS-MERCHANT-LOYALTY-CARD-BUILDER** · `rls-rpc-ledger` · gates: `qa:static`, `qa:unit`, `qa:db`, `qa:security`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Default 3-visit Mystery Visit card | unit | u:merchant-launch-readiness | — |
| 002 | Valid card persists per merchant/location | unit | u:merchant-qr, u:merchant-qr-mutations | — |
| 003 | Valid reward pool item persists | unit | u:merchant-qr-mutations | — |
| 004 | Invalid values rejected with reasons | unit | u:merchant-launch-readiness | — |
| 005 | Active card blocks a second active card | unit | u:merchant-qr | — |
| 006 | Assigned reward archived, not hard-deleted | unit | u:analytics-dashboard-pilot | — |
| 007 | Inactive card blocks new stamp claims | unit/sql | u:self-service-stamping | — |
| 008 | Card create/change writes events | unit | u:merchant-qr-mutations | — |
| 009 | Venue pin drag persists a manual override and records `merchant_pin` provenance, separate from address source | unit + browser | u:venue-address-lookup, e2e:high-accuracy-geofence-precision | invalid manual pin rejected before write; address edits reset pending source to geocoded; browser proof needs the :3100 dev server |
| 010 | Google Places venue selection fills the structured address and persists `provider_lookup`/`google_places`/place id with server-validated GB coordinates; manual entry, Nominatim fallback, and manual pin override unchanged | unit + browser | u:venue-address-lookup, e2e:google-places-venue-autocomplete | mocked Google (no live call); invalid provider id/coords or non-GB rejected before write; missing/blocked key renders manual-only fallback; manual edit after selection resets to `manual_entry` |

**MS-MERCHANT-DYNAMIC-QR-GENERATION-DOWNLOADS** · `rls-rpc-ledger` · gates: `qa:static`, `qa:unit`, `qa:db`, `qa:security`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Active card + 3+ rewards shows active QR + URL | unit | u:merchant-qr | — |
| 002 | No active QR: create or guide | unit | u:merchant-qr | — |
| 003 | Active QR reused, not duplicated | unit | u:merchant-qr | — |
| 004 | <3 active rewards blocks QR launch | unit | u:merchant-qr, u:merchant-launch-readiness | — |
| 005 | Download provides scannable `/q/{qr_id}` asset | unit + browser | u:merchant-qr-mutations, e2e:authenticated-merchant-admin-surfaces | image/preview/download routes return PNG for seeded QR |
| 006 | Disabled QR keeps scans, blocks entry | unit | u:customer | also admin disable path |
| 007 | QR generate/download writes events | unit | u:merchant-qr-mutations | `qr_created` / `qr_downloaded` |

### Phase 3 — Customer

**MS-CUSTOMER-QR-RESOLVER-JOIN** · `auth-session` · gates: `qa:static`, `qa:unit`, `qa:security`, build
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Active QR resolves server-side | unit | u:customer, u:returning-qr-redirect | — |
| 002 | Inactive/unknown QR shows unavailable | unit + browser | u:customer, e2e:public-auth-legal-surfaces | also covers /m/missing-merchant + invalid card/reward safe-fail without id leak |
| 003 | Active QR records `qr_scanned` | unit | u:customer | — |
| 004 | Unauthenticated customer prompted for phone (Twilio Verify) | unit | u:customer-phone-auth | OTP send+check covered by u:customer-dev-otp, u:customer-otp-bypass, u:customer-otp-delivery |
| 005 | Terms + verification create/reuse profile + membership | unit | u:customer, u:customer-legal-sheets | — |
| 006 | No marketing opt-in → no marketing consent | unit + sql | u:customer, sql:customer_marketing_consent | — |
| 007 | Opt-in records consent (source + version) | unit + sql | u:customer, sql:customer_marketing_consent | — |
| 008 | Returning member opens card, no duplicate join | unit | u:returning-qr-redirect | — |

**MS-CUSTOMER-DIGITAL-STAMP-CARD** · `rls-rpc-ledger` · gates: `qa:static`, `qa:unit`, `qa:db`, `qa:security`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Pre-unlock shows count, target, locked teaser | unit | u:customer-card-loader, u:customer-card-stamps | — |
| 002 | Unlocked reward shows assigned details from `reward_events` | unit + browser | u:customer, u:customer-home, e2e:customer-home-surfaces | smoke + axe over /home, activity, profile, rewards + session reset |
| 003 | Unauthorised customer denied | unit + sql | u:customer-card-loader, sql:tenant_isolation | — |
| 004 | Plain card tells customer to scan venue code | unit | u:customer-card-loader | — |
| 005 | Stamp route with valid QR shows add-stamp action | unit | u:customer-stamp-loader | — |
| 006 | GPS optional, never blocks | unit | u:customer | also self-service-stamping fraud flags |
| 007 | Future `redeemable_from` shows come-back, no redeem | unit | u:customer | also e2e:customer-flow-journey |
| 008 | Ready reward shown as redeemable | unit | u:customer | — |
| 009 | Redeemed reward not redeemable again | unit + sql | u:reward-redemption-cycles, sql:reward_redemption_cycles | — |

### Phase 4 — Staff / rewards

**MS-STAFF-REWARDS-SELF-SERVICE-STAMP-ISSUING** · `rls-rpc-ledger` · gates: `qa:static`, `qa:unit`, `qa:db`, `qa:security`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Member scan routes to stamp-confirm with QR context | unit | u:returning-qr-redirect, u:customer-stamp-loader | — |
| 002 | Valid tap creates `stamp_events`, increments membership | unit + sql | u:self-service-stamping, sql:reward_redemption_cycles | — |
| 003 | Cycle stamp 1 and 2 do not request GPS; cycle stamp 1 and 2 do not write GPS unknown fraud flags | unit + sql | u:cycle-stamp-3-governance-admin-legal, u:self-service-stamping | SQL proof needs disposable DB before qa:db, qa:e2e, or qa:visual |
| 004 | Cycle stamp 3 requests a fresh high-accuracy browser GPS fix when soft geofence is enabled; denied, timeout, unsupported, unavailable, or poor-accuracy GPS still issues the stamp | unit + sql | u:cycle-stamp-3-governance-admin-legal, u:self-service-stamping | SQL/browser proof needs disposable DB before qa:db, qa:e2e, or qa:visual; precision tightened to cap 100m / tolerance 10m / poor 100m |
| 005 | Reward-cycle reset reapplies the cycle stamp 3 trigger; new stamp evidence stores no raw customer latitude or longitude | unit + sql | u:cycle-stamp-3-governance-admin-legal, u:self-service-stamping | Admin fraud readback is minimized and bucketed |
| 006 | Duplicate per membership/UK-date rejected | unit + sql | u:self-service-stamping, sql:reward_redemption_cycles | — |
| 007 | Target stamp selects one weighted reward pool item | unit + sql | u:self-service-stamping, sql:reward_redemption_cycles | — |
| 008 | Cancelled/suspended billing blocks issuance | unit | u:self-service-stamping, u:customer-billing-matrix | — |
| 009 | Stamp writes `stamp_issued` + audit | unit | u:self-service-stamping | — |

**MS-STAFF-REWARDS-REWARD-UNLOCK-REDEMPTION** · `rls-rpc-ledger` · gates: `qa:static`, `qa:unit`, `qa:db`, `qa:security`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Required stamp count creates exactly one reward | unit + sql | u:reward-redemption-cycles, sql:reward_redemption_cycles | — |
| 002 | Pre-`redeemable_from` shows come-back, no redeem | unit | u:reward-profile-gate | — |
| 003 | Redeemable shows name, terms, QR (no tap-to-redeem) | unit + browser | u:merchant-scanned-reward, e2e:reward-merchant-scan-live | — |
| 004 | Pool edit after assignment preserves details | unit | u:reward-redemption-cycles | — |
| 005 | Merchant scan marks reward redeemed once | unit + sql + browser | u:merchant-scanned-reward, sql:reward_redemption_cycles, e2e:reward-merchant-scan-live | live polling proof: customer page updates without reload |
| 006 | Duplicate redemption rejected/replayed safely | unit + sql | u:reward-redemption-cycles, sql:reward_redemption_cycles | — |
| 007 | Success starts next stamp cycle | unit + sql + browser | u:reward-redemption-cycles, sql:reward_redemption_cycles, e2e:reward-merchant-scan-live | — |
| 008 | Success/failure records audit/product events | unit | u:merchant-scanned-reward | — |

### Phase 5 — Merchant value

**MS-MERCHANT-VALUE-DASHBOARD-ACTIVITY-ROI** · `product-analytics` · gates: `qa:static`, `qa:unit`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | `/app` shows current metrics for own merchant only | unit + coverage + browser | u:analytics-dashboard-pilot, e2e:authenticated-merchant-admin-surfaces | smoke + axe over the authenticated merchant console |
| 002 | Zero states + QR launch prompts | unit | u:merchant-launch-readiness | — |
| 003 | Totals reflect recorded stamps/rewards | unit | u:analytics-dashboard-pilot | — |
| 004 | ROI estimate updates, stays labelled estimate | unit | u:analytics-dashboard-pilot | — |
| 005 | Billing status surfaces correct warning/disabled | unit | u:merchant-console-trust-ia, u:customer-billing-matrix | — |
| 006 | Activity feed lists recent events with timestamps | unit | u:perf-rpc-consolidation, u:merchant-console-trust-ia | — |

**MS-MERCHANT-VALUE-CONSOLE-TRUST-IA-CLEANUP** · `customer-pii` · gates: `qa:static`, `qa:unit`, `qa:security`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001–010 | Activity in nav; single Account hub; masked email/phone readbacks; masked search excludes raw PII; shared billing-notice model; dashboard load skips activity fetch | unit + security | u:merchant-console-trust-ia | PII masking reinforced by `security:verify` |

**MS-OBSERVABILITY-COMPLIANCE-CUSTOMER-CONTACT-IMMUTABILITY** · `auth-session` · gates: `qa:static`, `qa:unit`, `qa:db`, `qa:security`, build
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Verified phone read-only on self-service | unit | u:customer-contact-immutability, u:home-profile | — |
| 002 | Verified email read-only on self-service | unit | u:customer-contact-immutability, u:home-profile | — |
| 003 | Tampered form cannot replace/clear verified email | unit | u:reward-profile-actions, u:customer-contact-immutability | — |
| 004 | Stale pending email cannot replace verified email | unit | u:reward-profile-gate, u:customer-contact-immutability | — |
| 005 | Direct SQL mutation of verified anchors fails | sql-rls | sql:customer_contact_immutability | DB-enforced trigger |

### Phase 6 — Admin / billing

**MS-ADMIN-BILLING-STRIPE-BILLING-ACCESS-CONTROL** · `billing` · gates: `qa:static`, `qa:unit`, `qa:security`, build
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Start checkout creates Growth Plan session | unit | u:customer, manual:legacy billing filename | — |
| 002 | Verified webhook creates/updates billing record | unit + security | u:backend-hardening, u:stripe-webhook-events (this pass) | webhook claim + mark paths |
| 003 | Subscription updates sync plan/status/period end | unit | u:stripe-billing (this pass), u:staff-billing-admin | status mapping covered |
| 004 | Payment failure shows warning + grace behaviour | unit | u:customer-billing-matrix | — |
| 005 | Cancelled blocks issuance, keeps dashboard | unit | u:customer-billing-matrix | — |
| 006 | Suspended disables customer card use | unit | u:customer-billing-matrix | — |
| 007 | Failed webhook signature rejected, billing unchanged | security | u:backend-hardening, `security:verify` | signature verify gate |

**MS-ADMIN-BILLING-INTERNAL-ADMIN-SUPPORT-CONSOLE** · `auth-session` · gates: `qa:static`, `qa:unit`, `qa:security`, build
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Non-admin `/admin` denied | unit | u:admin-console-redesign | — |
| 002 | Admin MFA requires AAL2 | unit + security | u:admin-console-redesign, `security:verify` | AAL2 marker in verifier |
| 003 | Searchable merchant + plan status | unit + browser | u:admin-console-redesign, e2e:authenticated-merchant-admin-surfaces | smoke + axe over the authenticated admin console |
| 004 | Manual stamp adjustment + audit | unit | u:admin-console-redesign | — |
| 005 | Cancel reward records why | unit | u:admin-console-redesign | — |
| 006 | Disable QR stops resolution, keeps history | unit | u:admin-console-redesign, u:customer | — |
| 007 | Audit log readback (actor/action/context/time) | unit | u:admin-console-redesign | — |

### Phase 7 — Observability / compliance

**MS-OBSERVABILITY-COMPLIANCE-EVENTS-ANALYTICS-FUNNELS** · `product-analytics` · gates: `qa:static`, `qa:unit`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Critical event writes Supabase product event w/ tenant + time | unit | u:analytics-dashboard-pilot, u:observability | — |
| 002 | Funnel action sends PostHog event | unit | u:analytics-dashboard-pilot | — |
| 003 | PostHog down → Supabase event still writes | unit | u:analytics-dashboard-pilot | best-effort mirror |
| 004 | Customer payloads avoid unnecessary PII | unit | u:observability | — |
| 005 | Pilot report uses source-of-truth events | unit + coverage | u:perf-rpc-consolidation, u:analytics-dashboard-pilot | — |

**MS-OBSERVABILITY-COMPLIANCE-CONSENT-LEGAL-DATA-REQUESTS** · `customer-pii` · gates: `qa:static`, `qa:unit`, `qa:security`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Loyalty terms separate from marketing opt-in | unit | u:customer, u:customer-legal-sheets | — |
| 002 | Unchecked opt-in ≠ marketing consent | unit + sql | u:customer, sql:customer_marketing_consent | — |
| 003 | Opt-in records full consent record | sql | sql:customer_marketing_consent | — |
| 004 | Opt-out recorded without deleting history | unit + sql | u:home-profile, sql:customer_marketing_consent | — |
| 005 | Reward terms display before/during participation | unit | u:customer-legal-sheets | — |
| 006 | Admin data-request lookup context | unit | u:admin-console-redesign | — |
| 007 | Soft GPS legal copy explains minimized evidence, no raw coordinates by default, and non-blocking stamps | unit + security | u:cycle-stamp-3-governance-admin-legal, u:customer-legal-sheets | — |

**MS-OBSERVABILITY-COMPLIANCE-SECURITY-FRAUD-RATE-LIMITS** · `webhooks` · gates: `qa:static`, `qa:unit`, `qa:db`, `qa:security`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001 | Repeated stamp attempts rate-limited | unit | u:rate-limit (this pass), u:self-service-stamping | RPC + key hashing covered |
| 002 | QR/identity limits use durable server-side storage | unit + sql | u:rate-limit (this pass), sql:tenant_isolation | — |
| 003 | Multiple stamps in cooldown rejected | unit + sql | u:self-service-stamping, sql:reward_redemption_cycles | — |
| 004 | Unusual stamp volume creates fraud flag for admin review | unit + sql | u:cycle-stamp-3-governance-admin-legal, u:self-service-stamping | Generic fraud readback preserves signal and reason without exposing raw metadata |
| 005 | Concurrent redemption: at most one success | sql | sql:reward_redemption_cycles, sql:tenant_isolation | — |
| 006 | Disabled QR blocks entry, keeps scans | unit | u:customer | — |
| 007 | Admin MFA requires AAL2 | unit + security | u:admin-console-redesign, `security:verify` | — |
| 008 | Unauthorised privileged attempt denied + audit | sql-rls | sql:tenant_isolation | role-denial test |
| 009 | Invalid Stripe webhook signature rejected | security | u:backend-hardening, `security:verify` | — |
| 010 | Soft GPS admin readback is minimized and bucketed without raw coordinates | unit + sql | u:cycle-stamp-3-governance-admin-legal, sql:reward_redemption_cycles | Admin readback exposes cycle stamp number, location status, distance bucket, accuracy bucket, confidence, reason, merchant, masked customer, severity, status, and created_at |

### Phase 8 — Pilot

**MS-PILOT-READINESS-VALIDATION** · `product-analytics` · gates: `qa:static`, `qa:unit`
| Req | Behaviour | Test type | Evidence | Gap / note |
| --- | --- | --- | --- | --- |
| 001–008 | Onboarding <5 min; staff training <3 min audited note; pilot metrics (launch/scan/join/repeat/redemption/support/paid); paid-proof from active billing + events; cancellation/decline reasons; dispute history; export separates source-of-truth from estimates | unit + coverage | u:analytics-dashboard-pilot, u:perf-rpc-consolidation, u:admin-console-redesign | dashboards reinforced by coverage thresholds |

### Governance specs (`implemented`)

**GOV-GOVERNANCE-FOUNDATION** · `docs-tooling` — hierarchy, status vocabulary, risk
rubric, gate mapping, CLI-first policy. Evidence: u:ai-governance + `governance`
(`scripts/check-governance.mjs`), CI workflow.

**GOV-HANDOFF-FIXTURES-TESTS** · `docs-tooling` — handoff workflow fixtures and
checks. Evidence: `tests/fixtures/governance/handoff-workflows.json`, u:ai-governance,
`scripts/check-governance.mjs`.

---

## 4. QA layer coverage

| Layer                                                                                  | Command(s)               | Evidence                                                                                                 | Status       | Gap / rationale                                        |
| -------------------------------------------------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------ |
| Static (TS/ESLint/route contract/governance/dead/dup/naming/todos/n+1)                 | `qa:static`              | tsc, eslint, `scripts/*`                                                                                 | Green        | —                                                      |
| Unit / domain logic                                                                    | `qa:unit`                | `tests/micro-specs/**` (70 files)                                                                        | Green        | coverage above ratchet                                 |
| Integration (actions, route handlers, Supabase/Stripe/notify boundaries)               | `qa:unit`                | mocked-boundary tests                                                                                    | Green        | no live-service integration env; mocked by design      |
| SQL / RLS / atomicity / tenant isolation                                               | `qa:db` (`db:test:rls`)  | `supabase/tests/*.sql` (6)                                                                               | Green        | needs DB; use disposable DB for release proof (see §7) |
| E2E customer journey                                                                   | `qa:e2e`                 | `tests/e2e/customer-flow-*.spec.ts`                                                                      | Green        | mutates demo data; use disposable/demo DB (see §7)     |
| Visual / screenshots                                                                   | `qa:visual`              | `docs/screenshots/**`                                                                                    | Green        | server + DB required                                   |
| Accessibility                                                                          | `qa:a11y`                | `tests/e2e/a11y.spec.ts`                                                                                 | Green        | colour contrast enabled; no disabled axe rules         |
| Security (secret isolation, auth redirects, MFA, webhook sig, rate limit, unsafe next) | `qa:security`            | `scripts/verify-security.mjs` + focused tests                                                            | Green        | —                                                      |
| Privacy (PII masking, consent separation, contact immutability)                        | `qa:security`, `qa:db`   | u:merchant-console-trust-ia, u:customer-contact-immutability, sql:\*                                     | Green        | —                                                      |
| Observability (product events, PostHog best-effort, sanitised payloads, request IDs)   | `qa:unit`                | u:observability, u:analytics-dashboard-pilot                                                             | Green        | —                                                      |
| Performance (route timing, bundle, deps, n+1)                                          | `qa:perf`, `perf:routes` | `scripts/perf-routes.mjs`, `check-bundle-size.mjs`, `analyze-deps.mjs`                                   | Static green | route timing server-dependent (see §5)                 |
| Resilience (Twilio/Resend/PostHog/Stripe/RPC failures, offline)                        | `qa:unit`                | u:resilience-backed tests, u:twilio-notifications + u:resend-notifications (this pass), pwa offline spec | Green        | external outage paths exercised via mocks              |

---

## 5. Performance and route timing

`qa:perf` runs the always-on static budgets: N+1 (`check:nplus1`), dependency
footprint (`deps:analyze`), and bundle size (`bundle:size`, after `pnpm build`).
Route TTFB (`pnpm perf:routes`, default `/ /pricing /start /app /q/demo /m/demo`)
needs a running server and is therefore run on demand rather than chained into
`qa:full`; this is the single deliberate deviation from a fully self-contained
aggregate and is recorded here as the explicit rationale.

Dashboard query consolidation (the N+1 risk for `/app`) is covered by
`u:perf-rpc-consolidation` and the `get_merchant_dashboard_metrics` /
`get_product_event_counts` RPCs verified in `sql:performance_indexes`.

---

## 6. QA hardening added in this pass

| Change                              | File(s)                                                                                                                                                                                                                      | Why                                                                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live customer-journey OTP fix       | `lib/customer/verification.ts`, `tests/micro-specs/customer-dev-otp.test.ts`, `.env.example`, `.env.local`                                                                                                                   | OTP send now skips Twilio when a dev code is configured (non-production), mirroring the check side, so `pnpm customer-flow:capture` is deterministic and never sends a real SMS to the demo number.                                                                                                                                                                  |
| `qa:*` aggregate scripts            | `package.json`                                                                                                                                                                                                               | One command per QA layer plus `qa:full`.                                                                                                                                                                                                                                                                                                                             |
| High-risk unit coverage             | `tests/micro-specs/customer-phone-pii.test.ts`, `rate-limit.test.ts`, `stripe-webhook-events.test.ts`, `twilio-notifications.test.ts`, `resend-notifications.test.ts`, `stripe-billing.test.ts`, `reward-scan-token.test.ts` | Raise real coverage on PII crypto, rate limiting, webhook idempotency/signature, Stripe status mapping, and delivery clients — the security-bearing modules that were under-tested. Module coverage went from near-zero to: phone-pii 100%, reward-scan-token 100%, rate-limit 100%, stripe/billing 100%, webhook-events 94%, twilio 93%, resend 92%.                |
| Quality-ratchet false-positive fix  | `eslint.quality.config.mjs`, `package.json`                                                                                                                                                                                  | The code-health config stubbed `@next/next/*` rules but still flagged 3 legitimate `<img>` disable directives as unused, holding `lint:quality` at 32 vs a pinned 31 (pre-existing breach). Turned off unused-directive reporting in the code-health config only (the functional `eslint.config.mjs` still enforces it) and tightened the pin to the true count, 29. |
| Closed edge-case register           | `micro-specs/traceability.json`, `scripts/check-governance.mjs`, `tests/micro-specs/ai-governance.test.ts`                                                                                                                   | Full-corpus traceability now requires every requirement to declare an explicit `edge_cases` array. Current proof: 165 / 165 requirements closed, 167 / 167 registered edge cases covered, 0 gaps, 0 accepted risks.                                                                                                                                                  |
| Automated accessibility gate        | `tests/e2e/a11y.spec.ts`, `package.json`, `app/globals.css`, `components/loyalty/reward-ticket.tsx`, `components/loyalty/status-banner.tsx`                                                                                  | The prior colour-contrast waiver is removed. `qa:a11y` now runs axe WCAG A/AA with contrast enabled across 10 stable route/flow surfaces, and `qa:full` includes it.                                                                                                                                                                                                 |
| Terms-route failure-state hardening | `app/merchant/[merchantSlug]/terms/page.tsx`                                                                                                                                                                                 | The all-route sweep found a 500 when Supabase/API-key failures reached merchant terms. The route now fails closed to an unavailable terms surface; rerun proof: 44 routes × 3 viewports, 0 issues.                                                                                                                                                                   |

### Open gaps with rationale (acceptance: no uncovered requirement without one)

1. **`manual:` evidence requirements** — `MS-FOUNDATION-WET-INK-FULL-UI-REWRITE-003`
   (en-GB copy register), `-011` (design-system smoke, also covered by
   `e2e:design-system-catalog`), `-012` (loaders unchanged) rely on review, not a
   gate. This is consistent with their `ui-only` risk class.
2. **DB / browser environment safety** — `qa:db` (`db:test:rls`), `qa:e2e`, and
   `qa:visual` need a configured database and dev server. This proof run executed
   them against the configured environment; future release proof should use a
   disposable/demo database because browser flows reset and seed demo rows (see §7).

---

## 7. Environment-gated and deferred checks

The configured `SUPABASE_DB_URL` / `NEXT_PUBLIC_SUPABASE_URL` can point at a hosted
Supabase project, and `qa:e2e` / `qa:visual` run browser flows that reset and seed
demo customer rows. Do not mutate hosted Supabase for cycle-stamp-3 proof: use a
disposable DB before qa:db, qa:e2e, or qa:visual. The safe default for release
proof remains: point `SUPABASE_DB_URL` at a disposable or demo database before
running `qa:db`, `qa:e2e`, or `qa:visual`.

`pnpm perf:routes` still needs a running server and is intentionally kept out of
`qa:full` because it measures route timing rather than pass/fail behaviour.

---

## 8. How to use this matrix

1. Pick the requirement or layer you are changing.
2. Run the `qa:*` command in its row before and after the change.
3. If you add behaviour, add the test at the layer named here and update the
   requirement's row plus `micro-specs/traceability.json`.
4. Never weaken a test, mark `.skip`, or record evidence that was not produced by a
   real passing run.
