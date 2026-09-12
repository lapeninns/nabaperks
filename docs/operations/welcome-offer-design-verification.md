# Welcome-offer design verification

This application change implements the Wet Ink welcome-offer design approved
on 12 September 2026. The reference defines composition; persisted campaign and
entitlement records define all benefits, dates, identity requirements and terms.

## Application boundaries

- The public offer and merchant creator mount `OfferClaimLanding`. The public
  route supplies the existing claim action; the creator supplies a disabled
  preview control.
- `OfferPass` supplies the percentage, calendar window, identity requirement,
  no-stacking rule and complete merchant terms across landing, held pass and
  counter. The face uses neutral “off at” wording. Any prominently repeated
  eligibility or own-bill restriction is an exact excerpt; the complete original
  text remains available with its line breaks.
- The join reminder reads the existing pending offer cookie, respects venue
  binding and invitation precedence, and uses the existing campaign context.
  It neither joins a member nor grants a benefit.
- A claimed/already-claimed card notice requires a saved claim for the current
  customer and membership. URL parameters alone cannot display an offer grant.
- The card and home tile share an independent pass link outside the card link.
  An unavailable pass still has a route to its authorised face; the pass loader
  remains the authority for whether to render a QR.
- The merchant scan loader exposes `valid_from`, already returned by the RPC,
  through one additional view property. The focused counter retains merchant
  authentication, venue isolation and the existing redemption action. Both
  confirmations remain required. Success reports a recorded use and directs
  staff to apply the discount to eligible items on the till.
- QR decoding observes failures that occur before hydration, and keyboard retry
  restores focus. Issuance, TTL, refresh interval and redemption rules are
  unchanged.

No migration, campaign-record change, authentication change, new consent policy,
grant mutation or POS integration is included. `lib/offers/*` and join actions
are unchanged. Full venue loyalty terms remain in the existing consent journey.

## Local evidence

Verified in an isolated worktree on 12 September 2026:

- `pnpm quality:check`: lint, typecheck, 1,879 contract/unit checks, dead code,
  duplication, debt and documentation gates.
- `pnpm build`: production webpack build.
- Existing offer journey: 96 checks across mobile Safari, Chromium, Firefox
  and desktop Safari, including creator, recovery, reward/pass independence
  and long copy at 375px, 768px and 1280px.
- New welcome composition: landing, phone, code, terms, card, pass and counter
  at 320px, 390px and 1024px with accessibility scans, full long terms and
  separate consent defaults. Counter action visibility and confirmations,
  all held-pass availability states, fast QR failure and keyboard retry.
- A disposable local Supabase journey uses a 15% campaign with two stamps on
  a five-stamp card. Landing/reload and a rejected code grant nothing. Successful
  verification and loyalty consent grant two stamps and one pass. Marketing is
  left unchecked and records no opt-in. The real QR endpoint returns an image
  and refreshes. Repeated scans retain one claim; another existing member cannot
  claim or obtain a success banner by editing the URL.
- 39 local database checks cover atomic/concurrent grants, existing members,
  consent replay, campaign availability, immutable terms, per-venue access,
  required attestations, used/expired codes and repeated use of the same pass.
- Manual Chromium checks at 200% zoom with reduced motion enabled show no
  horizontal overflow on landing, consent and counter; keyboard disclosure
  activation retains focus.
- macOS visual baselines for the affected creator/customer/counter harnesses
  were rendered and reviewed. Five changed canonical Linux snapshots were read
  from hosted CI run `34698588984` at application revision `05746181dbf8`;
  each original/retry image was byte-identical and visually reviewed before
  replacing its previous baseline. The next revision must pass hosted CI.

The `/dev/welcome-offer` display fixture mounts the production components and
is blocked in production by both the dev layout and its own `notFound` gate.
No production claim, SMS, stamp grant or redemption was used for verification.
These local checks do not establish authenticated production outcomes.

## Release and rollback

This is an application-only release. Follow `software-factory.md` and the
protected production workflow, with current-head checks and independent review.
Verify the deployed revision and read the public campaign after deployment;
record authenticated customer and merchant outcomes separately.

Rollback is to redeploy the previous verified application revision through the
normal release process. No data rollback is required: existing claim,
entitlement, consent and redemption records retain their current schema and
meaning. Do not reverse production grants or redemptions to roll back this UI.
