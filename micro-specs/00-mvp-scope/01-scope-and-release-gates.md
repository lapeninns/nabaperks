# Micro-Spec: MVP Scope and Release Gates

## Exact Goal and User-Visible Outcomes

The project has a single source of truth for what the Nabaperks MVP includes, excludes, and must prove before a pilot. A merchant, customer, admin, or implementation agent can read this scope and understand the first release without guessing.

The MVP outcome is a no-app QR mystery visit card product where a UK local business can sign up, create one 3-visit digital card, manage a custom surprise reward pool, print/download one permanent venue QR code, let customers join from mobile web, issue one self-service stamp per UK date, reveal an assigned reward on visit 3, redeem it from the next UK business day, view value metrics, and pay GBP 29/month through Stripe.

## Blast Radius

In scope:

- Project documentation under `micro-specs/`.
- Any future implementation files needed to satisfy the specific downstream micro-spec being executed.
- MVP route families listed in the blueprint: `/`, `/pricing`, `/q/[qr_id]`, `/m/[merchant_slug]`, `/m/[merchant_slug]/join`, `/card/[membership_id]`, `/reward/[reward_id]`, `/app`, and `/admin`.

Out of scope:

- POS integrations.
- Customer mobile apps.
- Marketplace or discovery features.
- Multi-location merchant workflows.
- Fixed buy-X-get-Y card campaigns.
- Complex points engines.
- Referral rewards.
- Gift cards or stored value.
- AI segmentation.
- Automated SMS/WhatsApp campaigns.

## Strict Constraints and Assumptions

- The MVP must stay focused on proving merchant willingness to pay for a paper-card replacement.
- The first pricing model is one plan: Growth Plan at GBP 29/month per location, first 30 days free for pilot.
- The customer experience must remain app-free and mobile-web first.
- soft GPS classification is the MVP fraud-control model; full staff accounts may exist later but must not block checkout-counter speed.
- Legal/compliance references in the blueprint are not legal advice and require review before public launch.

## Decisions Already Made

- Initial beachhead: independent cafes, dessert shops, bubble tea shops, barbers, and salons.
- Strongest first segment: cafes and dessert/bubble tea shops.
- MVP default card: 3 visits unlock a surprise reward.
- Reward details are selected from merchant-managed `reward_pool_items` and snapshotted into `reward_events`.
- One active customer join QR is allowed per merchant/location; disabled QR records remain historical.
- Stack: Next.js, Vercel, Supabase, Stripe, PostHog, Resend.
- Source-of-truth events live in Supabase, not only PostHog.

## Behavioral Requirements

- WHEN an implementation agent proposes a feature outside the MVP boundary, THE product plan SHALL reject it unless a new approved micro-spec explicitly adds it.
- WHEN a merchant completes onboarding, THE system SHALL support one active location and one active loyalty card for MVP.
- WHEN a customer joins a card, THE system SHALL not require a mobile app download.
- WHEN customers add stamps, THE system SHALL require a valid venue QR context, enforce one earned stamp per membership/location/UK date, and record the action.
- WHEN the third visit stamp is issued, THE system SHALL assign exactly one active reward pool item and persist the assigned reward details.
- WHEN a reward is revealed, THE system SHALL block redemption until the next UK business day.
- WHEN the MVP is evaluated for pilot readiness, THE project SHALL check every release gate in this spec.

## Verification Criteria

Acceptance criteria:

- The MVP can be described in one checkout-counter workflow from QR scan to reward reveal to return-visit redemption.
- Every downstream feature spec maps to a build-now item from the blueprint.
- Every do-not-build-yet item is explicitly excluded.
- Pilot success metrics are documented before pilot onboarding starts.

Manual QA:

- Read the full `micro-specs/README.md` order and confirm no spec depends on POS, customer app, SMS campaigns, or multi-location workflows.
- Confirm each spec names user-visible outcomes, in-scope areas, out-of-scope areas, EARS requirements, and verification.

Task breakdown:

- Establish global product and engineering context.
- Split blueprint into build-phase specs.
- Use this scope spec to reject unapproved expansion.
