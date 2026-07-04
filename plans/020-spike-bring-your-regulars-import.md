# Plan 020: Spike — "bring your regulars" import (contradicts the paper-card pitch)

> **Executor instructions**: This is a DESIGN SPIKE, not a build. The deliverable
> is a written design doc + a recommendation on a consent-safe model. Do NOT ship
> an import feature or insert customer rows from this plan. If a "STOP condition"
> occurs, stop and report. Update this plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4a04c141..HEAD -- components/merchant lib/customer`

## Status

- **Priority**: P3
- **Effort**: L (spike: ~1–2 days; the build is a larger, consent-constrained effort)
- **Risk**: LOW (spike); the eventual build is GDPR-sensitive
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `4a04c141`, 2026-07-03

## Why this matters (product)

The core pitch is "switch from paper cards" (`faq.tsx:43`,
`components/marketing/landing/pub-counter-flow.tsx`), yet customers only ever
enter via the self-serve join QR (`app/q/[qrId]`, `lib/customer/stamp.ts`), and
there is **no** merchant-side "import existing regulars" or "credit N starting
stamps" surface anywhere in `components/merchant/`. A pub with 200 loyal regulars
on paper cards must make every one re-scan from zero — exactly the switching
friction the product claims to remove. This is a create-without-bulk / no-import
asymmetry against the stated positioning. The right shape is genuinely open and
consent-constrained (you cannot fabricate GDPR consent), so this spike defines a
compliant model before any build.

## Current state (evidence)

- Rich read/browse roster exists: `components/merchant/customer-readback-table.tsx:353`
  (paginate/filter/search), masked-identifier formatting
  (`formatMerchantCustomerIdentifier`) — a mature *read* path.
- Customers only enter via the join QR: `app/q/[qrId]`, join actions
  (`app/m/[merchantSlug]/join/actions.ts`), `lib/customer/stamp.ts`. No
  merchant-side create/import/starting-credit surface in `components/merchant/`.
- Consent + PII are first-class: consent capture at join, phone encrypted/HMAC'd,
  a real erasure RPC — so any import must respect the same consent model (no raw
  inserts of un-consented contacts).
- The moat: "one stamp per UK day", single-use redemption, billing gates live in
  `SECURITY DEFINER` RPCs — starting-stamp credit must interact with these safely.

## Spike deliverable

Write `docs/product/spikes/bring-your-regulars.md` covering:
1. **The compliant model** (recommend one): almost certainly an **invite-to-claim**
   flow (merchant uploads names/contacts → customers receive an invite → they
   consent + claim, which creates the membership), NOT a raw bulk insert of
   customer rows (which would fabricate consent). Justify against GDPR lawful basis.
2. **Starting-stamp credit**: how a claimed membership can carry N pre-credited
   stamps without violating "one stamp per UK day" or the ledger's append-only /
   immutability rules — must it go through `issue_self_service_stamp`, or a new
   audited "migration credit" RPC? Confirm the moat isn't weakened.
3. **Input surface**: CSV/paste upload UX in the merchant console, validation
   (phone normalization via the existing `libphonenumber-js` path), dedupe against
   existing members.
4. **Consent & deliverability**: how invites are sent (reuse Resend/Twilio — see
   plan 019's channel work), unsubscribe, and what happens to un-claimed invites
   (expiry/purge, consistent with retention).
5. **Abuse/fraud**: an import that credits stamps is a fraud vector — how does the
   existing fraud-flag system (`app/admin/fraud`) see imported credits? Rate limits?
6. **Go/no-go**: effort for a v1 (recommend the smallest compliant slice — e.g.
   invite links with 0 starting stamps first), top risks, recommendation.

Optional: a throwaway `spike/*` branch sketching the invite-token data shape (no
migration on `main`). Do NOT merge.

## Commands you will need

Read-only investigation; `pnpm typecheck` for any throwaway stub.

## Scope

**In scope**: `docs/product/spikes/bring-your-regulars.md` (create); an optional
never-merged `spike/*` branch.

**Out of scope**: inserting/importing any customer data, new migrations on `main`,
changes to the stamp/redemption RPCs, and the fraud system.

## Done criteria

- [ ] `docs/product/spikes/bring-your-regulars.md` exists and answers all six points
- [ ] The recommended model is explicitly consent-safe (invite-to-claim, not raw
      insert) with a stated GDPR basis
- [ ] The starting-stamp-credit design is reconciled against the moat invariants
      (one-per-day, append-only ledger, fraud visibility)
- [ ] A smallest-compliant-v1 recommendation with effort + top risks
- [ ] No customer data imported; no production code changed on `main`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:
- Any viable model appears to require fabricating consent or bypassing the stamp
  RPCs — stop and flag; that is a non-starter, not a design tradeoff.
- Starting-stamp credit can't be expressed without weakening the one-per-day
  invariant — surface this as the central open question for a product decision.

## Maintenance notes

- This spike likely composes with plan 019 (the invite transport is the same
  email/SMS channel work).
- Reviewer of the future build: consent lawful basis, moat interaction, and fraud
  visibility are the three things that must be right before any import ships.
