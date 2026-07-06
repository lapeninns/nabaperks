# Legacy / Offer-v1 Cleanup Goal

A targeted, **audit-first** cleanup pass over the "legacy code, copy, and offer"
surface in Nabaperks. The desired verdict is `CLEANUP GREEN` (the two in-scope
changes land, gates green, nothing load-bearing deleted) or `CLEANUP NOT READY`.

This is **not** a bulk deletion, an offer teardown, or a pricing change. Scope
was set with the owner on 2026-07-06:

- **Offer:** keep the live v2 apparatus; only tidy dead **offer-v1** remnants.
- **Legacy:** full audit of every back-compat shim / migration helper; remove
  only what is provably safe, flagging breakage risk on each first.

---

## 0. Why this shape (read first)

The audit **inverted the premise**. "Remove legacy completely" sounds like a
deletion sweep; it is not one here. Nabaperks is a mature, heavily-audited live
product, and the £29→£49 offer-v2 change shipped to prod **the same day** this
goal was scoped (PR #71/#72, `a70ad823`/`c1cf4364`). As a result:

> The "legacy/offer" surface is almost entirely **load-bearing or historical**.
> offer-v1 was *absorbed* into offer-v2 (its test is a live dependency, its
> facts.ts mentions are provenance for live constants). The "legacy" shims are
> old-URL redirects, localStorage migrations, and default-copy detectors that
> **break real users or CI if deleted**. The one `@deprecated` component is
> **still rendered in production**.

So the honest deliverable is small and precise:

1. **One real bug** — a stale `£29` hardcoded in a live preflight check that
   went out of date when £49 shipped. Fix it.
2. **One sanctioned tidy** — mark the `offer-v1` Micro-Spec `superseded` (the
   governance-correct "dead v1" move), **not** deleted.

Everything else is either **KEEP** (with rationale, so it is not re-litigated)
or a **separate future spec** (the `@deprecated` component migration).

Every audited item ends in exactly one terminal status:

- `FIX` — real defect, in scope, change it.
- `SUPERSEDE` — governance status transition, in scope.
- `KEEP` — inspected; load-bearing or historical; **must not be deleted**.
- `DEFER(<reason>)` — real work found, out of scope for a cleanup (own spec).

The register in §2 **is** the coverage proof.

---

## 1. Hard invariants (DO-NOT-DELETE rails)

These are the audit's `KEEP` verdicts, promoted to no-go rails. Any change that
deletes one of these is out of scope and will break behaviour, users, or CI.

1. **offer-v1's test is a live dependency.**
   `tests/micro-specs/marketing-offer-v1.test.mjs` is listed in **offer-v2's**
   `related_tests` (`micro-specs/marketing/offer-v2.md:35`). Deleting it fails
   `governance:check` for offer-v2. **Keep.**
2. **offer-v1's evidence ledger is honest history.**
   `micro-specs/evidence/MS-marketing-offer-v1.json`. Deleting it triggers the
   orphan-ledger failure in `validateEvidenceLedgers`
   (`scripts/governance-rules.mjs:399-408`) and rewrites shipped history.
   **Keep.**
3. **facts.ts offer-v1 comments are provenance for LIVE constants.**
   `lib/marketing/facts.ts:15,106,119` annotate why `cancelLine` and `GUARANTEE`
   exist (owner-approved commercial terms). The constants render in prod.
   **Keep** (re-word only inside a marketing spec if ever needed; do not strip).
4. **`LEGACY_DEFAULT_REWARD_TERMS` is migration logic.**
   `lib/merchant/loyalty-card-copy.ts:7` detects merchants still holding the old
   default reward copy so their card regenerates current wording. Delete it and
   any such merchant's card **freezes on stale "Complete 3 visits" copy**.
   Retiring it needs a prod-DB check (zero rows equal the legacy string), not a
   code edit. **Keep.**
5. **`legacyDraftStorageKey` is the prefix of the current key.**
   `components/merchant/onboarding-form.tsx:41` — the current per-user key is
   `` `${legacyDraftStorageKey}:${userId}` ``. Only the one-time
   `removeItem(legacyDraftStorageKey)` (`:131`) is truly legacy, and it is cheap
   insurance. **Keep** (at most, drop only the `removeItem` effect, never the
   constant).
6. **Back-compat routes/redirects are contracts.**
   `app/app/settings/page.tsx` redirects old settings bookmarks to the Account
   hub; `tests/e2e/merchant-account-compat-routes.spec.ts` pins that old URLs
   still resolve. Deleting either breaks live links. **Keep.**
7. **data-table "legacy markup" is a render promise, not dead code.**
   `components/data/data-table.tsx` comments guarantee byte-identical output for
   existing call sites. **Keep.**
8. **No pricing/billing/offer change.** £49/£490 Stripe billing, the offer-v2
   apparatus (`OFFER`, `OFFER_STACK`, `GUARANTEE`, `SETUP`, `PROMO`), and all
   render surfaces are frozen. This goal never touches `app/pricing/**`,
   `lib/marketing/promo.ts`, or the offer constants.

---

## 2. Audit register (baseline)

Audited surface as of 2026-07-06 @ `c1cf4364`. `FIX`/`SUPERSEDE` are in scope;
`KEEP`/`DEFER` are not.

| # | Item | What it is | Verdict | Risk if wrongly deleted |
| --- | --- | --- | --- | --- |
| 1 | `scripts/provider-readiness/checks.mjs:138,142,144` | Live preflight check hardcodes `unit_amount === 2900` / "GBP 29/month" | **FIX → 4900 / £49** | Leaving it: `pnpm smoke:providers` false-fails the correct live price |
| 2 | `micro-specs/marketing/offer-v1.md` | `status: implemented`, fully absorbed by offer-v2 | **SUPERSEDE** (`--superseded-by MS-marketing-offer-v2`) | Deleting breaks offer-v2 deps + rewrites history |
| 3 | `lib/marketing/facts.ts:15,106,119` | offer-v1 provenance comments on live constants | KEEP | Strips the "why" from prod copy |
| 4 | `micro-specs/evidence/MS-marketing-offer-v1.json` | Governance evidence ledger | KEEP | Orphan-ledger CI failure |
| 5 | `tests/micro-specs/marketing-offer-v1.test.mjs` | Pins offer-v1 copy | KEEP | Live dependency of offer-v2 |
| 6 | `lib/merchant/loyalty-card-copy.ts:7` `LEGACY_DEFAULT_REWARD_TERMS` | Old-default detector (migration) | KEEP | Stale card copy freezes for old merchants |
| 7 | `components/merchant/onboarding-form.tsx:41` `legacyDraftStorageKey` | Prefix of current key + 1-time cleanup | KEEP | Breaks current draft key |
| 8 | `app/app/settings/page.tsx` | Old-link redirect | KEEP | Dead bookmarks |
| 9 | `components/data/data-table.tsx` | Byte-identical render promise | KEEP | Layout regressions |
| 10 | `tests/e2e/merchant-account-compat-routes.spec.ts` | Old-URL redirect tests | KEEP | Loses redirect coverage |
| 11 | `components/loyalty/reward-teaser.tsx` `@deprecated RewardTeaser` | **Still rendered** at `app/m/[merchantSlug]/page.tsx:86` | **DEFER** (own migration spec) | Breaks the merchant public page |
| 12 | `reports/*.md`, `docs/architecture-flows/11-remediation-log.md`, `offer-v2.md:70` | Point-in-time snapshots citing old £29 | KEEP (excluded) | Loses/rewrites audit history |

---

## 3. In-scope work (the only two edits)

### 3a. FIX — stale £29 in the provider-readiness preflight

**File:** `scripts/provider-readiness/checks.mjs` (function `checkStripe`).
**Severity:** preflight-only. `smoke:providers` (`scripts/check-provider-readiness.mjs`)
is **not** wired into any CI workflow, so this does not block CI or prod — but it
**false-fails the operator's manual pre-launch check** against the correct £49
Stripe price.

Exact change (three lines):

| Line | From | To |
| --- | --- | --- |
| 138 | `body.unit_amount === 2900 &&` | `body.unit_amount === 4900 &&` |
| 142 | `"Growth price is active GBP 29/month."` | `"Growth price is active GBP 49/month."` |
| 144 | `"Growth price does not match active GBP 29/month."` | `"Growth price does not match active GBP 49/month."` |

Notes:
- The pinning test `tests/micro-specs/provider-readiness-smoke.test.mjs` carries
  **no price literal** (verified) — **no test edit required**.
- `scripts/provider-readiness/runtime.mjs` carries no price literal.
- This validates the **monthly** Growth price only. Adding an annual-price
  (£490) readiness check would be a **new** check — **out of scope** here.
- The £4900 value must equal the live Stripe `unit_amount` for the current
  Growth Price (`price_1Tq0Wk…`, per prod records). Confirm against Stripe if in
  doubt before hardcoding.

### 3b. SUPERSEDE — the offer-v1 Micro-Spec

The governance-correct "tidy dead v1". **Do not delete** the spec, its ledger,
its test, or the facts.ts provenance (see §1).

```bash
pnpm governance:advance MS-marketing-offer-v1 --to superseded \
  --superseded-by MS-marketing-offer-v2
```

This inserts `superseded_by: MS-marketing-offer-v2` and records the transition
in the evidence ledger. `superseded` = non-current, blocked for new
implementation, still reference (`micro-specs/README.md:119`). Run the advance
CLI's own preconditions and follow any message it emits (it validates before
transitioning). **Owner confirmation required** before running — this is a
governance state change on shipped work.

> Optional/secondary: `offer-v2.md:70` prose still says "no change to the £29
> price" (now £49). Editing an `implemented` spec's body is a governance change
> in its own right; treat as a nice-to-have inside the same spec's blast radius,
> not a requirement.

---

## 4. Deferred / excluded

- **DEFER — `RewardTeaser` → `RewardTicket` migration.** `@deprecated` but live
  on `app/m/[merchantSlug]/page.tsx:86` (also exported from
  `components/loyalty/index.ts`, previewed in `.design-sync/previews/`). Removing
  it is a component migration + visual-baseline refresh, not a cleanup. **Author
  its own Micro-Spec** (`MS-*-reward-teaser-retire`) when prioritised.
- **EXCLUDE — historical £29 in reports/docs.** `reports/*.md`,
  `docs/architecture-flows/11-remediation-log.md` are dated snapshots. Leave as
  history; do not "correct" them.

---

## 5. Execution constraint (governance)

`validateBlastRadius` (`scripts/governance-rules.mjs:411`) means: **with changed
files present and no `active` Micro-Spec, `governance:check` fails outright**;
with active specs present, **every changed file must fall inside some active
spec's `allowed_blast_radius`**. The only currently-`active` specs are
`governance/ai-delivery-framework` and `platform/pwa` — neither covers `scripts/`
or `micro-specs/marketing/`.

Therefore this cleanup **must** run under a new active Micro-Spec (via
`write-micro-spec` → `implement-micro-spec`, exactly how today's £49 change
shipped):

- **spec id (suggested):** `MS-cleanup-price-remnant`
- **allowed_blast_radius:**
  - `scripts/provider-readiness/**` (3a)
  - `micro-specs/marketing/**` (3b supersede — offer-v1.md frontmatter)
  - `micro-specs/evidence/**` (ledger transition record)
  - `tests/micro-specs/**` (safety; none expected)
- **risk_class:** lowest class that fits a **tooling / no-runtime-behaviour**
  change — this touches a preflight script and spec metadata, not app runtime,
  DB, or billing code. Confirm against `RISK_CLASSES` in
  `scripts/governance-constants.mjs` and `Instructions_MircroSpecsCreation.md`.
- **verification_gates (floor):** `pnpm typecheck`, `pnpm test:micro-specs`,
  `pnpm governance:check`. The risk-class floor in `validateActiveSpec` may
  require more; let the checker tell you and satisfy it — do not weaken gates.

---

## 6. Verification gates

Run before the spec advances and before any PR merges:

```bash
pnpm typecheck
pnpm test:micro-specs         # provider-readiness-smoke stays green
pnpm governance:check         # blast radius + ledger + docs-drift green
pnpm governance:run-gates --spec MS-cleanup-price-remnant --record
```

Live-only (needs real Stripe key; manual, optional): `pnpm smoke:providers`
should now report **"Growth price is active GBP 49/month."**

---

## 7. Definition of done

- [ ] `checks.mjs` Stripe check asserts `4900` / "GBP 49/month"; `smoke:providers`
      passes against the live price (or is confirmed correct offline).
- [ ] `MS-marketing-offer-v1` status = `superseded`, `superseded_by:
      MS-marketing-offer-v2`, transition recorded in its ledger. **(owner-gated)**
- [ ] Every §1 KEEP item **untouched** (`git diff` shows only `checks.mjs` +
      `offer-v1.md` frontmatter + ledger).
- [ ] `RewardTeaser` migration filed as its own spec (not done here).
- [ ] All §6 gates green; `MS-cleanup-price-remnant` advanced to `implemented`
      with evidence recorded.
- [ ] Pushed per the two-account governance workflow.

---

## 8. Execution prompt (agent hand-off)

> Implement the "Legacy / Offer-v1 Cleanup Goal"
> (`docs/product/legacy-offer-v1-cleanup-goal.md`). Scope is exactly two edits;
> delete nothing on the §1 DO-NOT-DELETE list.
>
> 1. Author an active Micro-Spec `MS-cleanup-price-remnant` via
>    `pnpm governance:new-spec` with the blast radius, risk_class, and gates in
>    §5 (use the `write-micro-spec` skill; grill the risk_class against
>    `governance-constants.mjs`).
> 2. **Red→green** the £29→£49 fix in `scripts/provider-readiness/checks.mjs`
>    (lines 138/142/144, per §3a). No test edit expected — confirm
>    `provider-readiness-smoke` stays green.
> 3. **Owner-gate:** confirm before superseding, then
>    `pnpm governance:advance MS-marketing-offer-v1 --to superseded
>    --superseded-by MS-marketing-offer-v2` (§3b).
> 4. Run §6 gates, `governance:run-gates --record`, advance the cleanup spec to
>    `implemented`, and open the PR per the governance workflow.
>
> Stop and surface if: any KEEP item would have to change, the risk_class floor
> demands gates you cannot satisfy, or the supersede CLI reports a precondition
> failure.

---

## Appendix. Provenance & governance

- **Audit date:** 2026-07-06, on `main` @ `c1cf4364` (offer-v2 + £49 pricing live
  as of PR #71/#72).
- **Owner scope decisions (2026-07-06):** offer = "tidy dead v1 remnants only";
  legacy = "full audit, flag risk before deleting". Bulk deletion rejected by the
  audit as unsafe.
- **Source-of-truth pointers:** governance model —
  `scripts/governance-rules.mjs` (`validateBlastRadius`,
  `validateEvidenceLedgers`); lifecycle vocab — `micro-specs/README.md:106-139`;
  offer facts — `lib/marketing/facts.ts`; offer specs —
  `micro-specs/marketing/offer-v1.md`, `offer-v2.md`.
- **Related goals:** `docs/product/grand-slam-offer.md` (the live offer this goal
  deliberately preserves), `docs/product/comprehensive-refactor-program-goal.md`
  (broader hygiene program; `RewardTeaser` retirement belongs to a spec, not this
  goal).
