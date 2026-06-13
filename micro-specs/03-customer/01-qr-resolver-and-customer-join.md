# Micro-Spec: QR Resolver and Customer Join

## Exact Goal and User-Visible Outcomes

A customer scans a merchant QR code, lands on a branded mobile web page, joins the loyalty card without downloading an app, accepts loyalty terms, optionally opts into marketing, and sees their digital card.

## Blast Radius

In scope:

- `/q/[qr_id]`
- `/m/[merchant_slug]`
- `/m/[merchant_slug]/join`
- Customer auth/identity flow using Supabase Auth.
- `customers`, `customer_memberships`, and `consent_records` writes.
- QR scan and customer join events.

Out of scope:

- Customer mobile app.
- Mandatory marketing opt-in.
- SMS/WhatsApp campaigns.
- Multi-merchant customer wallet beyond the current membership flow.
- POS purchase verification.

## Strict Constraints and Assumptions

- Customer identity is email or phone-based through Supabase Auth.
- Customers can join loyalty without accepting marketing.
- The join flow must be fast and mobile-first.
- Inactive QR or inactive card must not create a membership.
- QR scans should be tracked even when join conversion does not happen, where privacy-safe.

## Decisions Already Made

- QR scan starts at `/q/{qr_id}`.
- Active QR may route to `/m/{merchant_slug}/join` or `/card/{membership_id}` depending on identity and membership state.
- Join page message: "Join [Business Name] Rewards - no app needed."
- Consent records store channel, consent status, source, timestamp, merchant, customer, and policy version.

## Behavioral Requirements

- WHEN a customer scans an active QR, THE resolver SHALL look up the QR record server-side.
- WHEN a QR is inactive or unknown, THE resolver SHALL show that the loyalty card is unavailable.
- WHEN an active QR is scanned, THE system SHALL record `qr_scanned`.
- WHEN an unauthenticated customer reaches join, THE app SHALL request email or phone identity verification.
- WHEN a customer accepts loyalty terms and completes identity verification, THE system SHALL create or reuse their customer profile and merchant membership.
- WHEN the marketing opt-in checkbox is not selected, THE system SHALL create no opted-in marketing consent.
- WHEN marketing opt-in is selected, THE system SHALL record consent with source and policy version.
- WHEN a returning member scans the same merchant QR, THE app SHALL take them to their existing card instead of creating a duplicate membership.

## Verification Criteria

Acceptance criteria:

- Active QR opens the correct merchant join flow.
- Unknown/inactive QR does not expose internal details.
- Customer can join with no app download.
- Marketing opt-in is visibly separate from loyalty terms.
- Duplicate memberships are prevented for the same merchant/customer pair.

Manual QA:

- Scan active QR as a new customer.
- Join without marketing consent and confirm no opted-in marketing record.
- Join with marketing consent and confirm consent readback.
- Scan again as the same customer and confirm existing card opens.
- Test inactive QR failure state.

Task breakdown:

- Implement QR resolver.
- Implement customer identity and join UI.
- Persist membership and consent records.
- Verify conversion, duplicate prevention, and events.
