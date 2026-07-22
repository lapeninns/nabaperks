# Bulk Two-Stamp Loyalty Invitations

## Summary

Add `/app/customers/invite`, where eligible merchants can import up to 2,000 email addresses by CSV or paste. Recipients receive a fixed invitation linking to `/invite/[token]`.

After phone OTP and loyalty-terms acceptance at home, the customer’s email is verified by the link, linked to their phone account, and exactly two welcome stamps are awarded without QR or location checks.

## Key Changes

### Campaign creation

- Accept either a UTF-8 CSV with an `email` column or newline/comma-separated addresses.
- Normalise, validate and deduplicate up to 2,000 entries.
- Exclude known existing members, suppressed addresses and addresses previously offered this merchant’s two-stamp invitation.
- Show masked preview rows and aggregate counts: eligible, invalid, duplicate and not eligible.
- Permit one active campaign and 2,000 sends per merchant per rolling 24 hours.
- Require one audited legal basis for the whole campaign:
  - venue-specific email consent; or
  - confirmation of every existing-customer soft-opt-in condition.
- Reject bought, scraped or third-party lists. UK guidance requires consent or the complete soft-opt-in conditions, sender identification and an easy unsubscribe mechanism. [ICO guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/)
- Use controlled British-English copy containing the venue name, two-stamp offer, 30-day expiry, privacy links and venue-scoped unsubscribe link. No custom merchant text.

### Storage and delivery

- Add merchant-scoped campaign, recipient and email-suppression tables with RLS, audit records and service-role-only mutation RPCs.
- Store recipient email as AES-GCM ciphertext for delivery, HMAC for matching and a masked value for merchant readback. Never log raw addresses or tokens.
- Add `CUSTOMER_EMAIL_ENCRYPTION_KEY` and `RESEND_WEBHOOK_SECRET` to both environment-contract sources.
- Queue recipients durably; a five-minute cron drains up to 800 emails per run at no more than four Resend requests per second.
- Use a stable per-recipient Resend idempotency key and store the returned provider email ID. Resend currently retains idempotency keys for 24 hours. [Resend documentation](https://resend.com/docs/dashboard/emails/idempotency-keys)
- Retry only network, `429` and `5xx` failures: three total attempts, with 15-minute and two-hour backoffs. Permanent address failures do not retry.
- Add a signed, replay-safe Resend webhook for delivered, bounced, complained, failed and suppressed events. Globally suppress bounces/complaints; apply unsubscribe suppression per venue. [Resend webhook documentation](https://resend.com/docs/webhooks/verify-webhooks-requests)
- Track queued, sent, delivered, link opened, joined, failed, not eligible, unsubscribed and expired. Do not use tracking pixels; “opened” means the invitation link was visited.
- Cancelling a campaign stops unsent deliveries and invalidates all unclaimed links; sent email cannot be recalled.

### Claim and stamp transaction

- Generate independent 256-bit claim and unsubscribe tokens; store only token hashes.
- On `/invite/[token]`, validate the invitation and transfer its context into an encrypted HttpOnly cookie before entering the existing merchant join flow.
- Anonymous customers complete the regular phone OTP. Existing verified-phone sessions may continue directly to terms.
- At final terms acceptance, one database transaction must:
  - lock and consume the invitation;
  - verify merchant/card/billing availability and 30-day expiry;
  - confirm no merchant membership already exists;
  - bind the invited email as verified without a second email code;
  - create the membership and immutable terms acceptance;
  - insert two separate promotional stamp ledger events;
  - increase current and lifetime stamp totals by exactly two;
  - emit audit and product events;
  - mark the invitation claimed and scrub invitation ciphertext/token data.
- Welcome stamps use source `loyalty_invite`, do not set a venue visit date, and bypass QR, geofence and one-visit-per-day rules.
- Campaigns require an active card with at least three stamps, preventing the welcome grant from immediately completing legacy one- or two-stamp cards.
- Existing members detected during import receive no email. Phone-only existing members that cannot be detected earlier are rejected after OTP, receive no stamps and are shown their existing card.
- Bind the invited email to an existing member only when their account has no verified email or already uses the same email. Never overwrite or merge conflicting verified identities.
- Concurrent or repeated claims remain idempotent; only the first eligible verified-phone account can consume the invitation.

### Privacy and rollout

- Purge abandoned drafts after 24 hours.
- Scrub recipient ciphertext, masked email and claim token when claimed, rejected, cancelled or expired.
- Delete contact-free terminal recipient records after 365 days; retain suppression HMACs as required to honour opt-outs.
- Extend customer export, erasure, retention, legal documentation and the OpenAPI contract for the new data and Resend webhook.
- Launch behind a default-disabled, owner-and-expiry-controlled feature flag for selected merchants.
- Add “Invite customers” beside “Send a reward” on the members page.

## Test Plan

- Unit-test CSV/paste parsing, normalisation, limits, masking, encryption, fixed email copy, retry classification and webhook verification.
- Database-test merchant isolation, campaign caps, eligibility filtering, suppression, leases, cancellation, expiry and concurrent claims.
- Prove an eligible claim creates one membership, two ledger rows and exactly two displayed stamps without QR/geolocation.
- Prove replay, forwarding after claim, expired links, billing lapse, existing membership and conflicting email identities award nothing.
- E2E-test merchant import → preview → send progress and invitation link → phone OTP → terms → two-stamp card.
- Test keyboard, screen-reader and responsive behaviour.
- Run `pnpm quality:fast`, `pnpm quality:check`, `pnpm build`, DB tests and relevant Playwright journeys; report provider-backed checks separately.

## Locked Assumptions

- Email-only MVP; no names, phone imports or SMS invitations.
- Exactly two stamps total—not the normal first stamp plus two.
- Fixed email template, 30-day link and no reminder sends.
- One lifetime two-stamp invitation per venue/email.
- Campaign permission does not automatically opt the customer into future Nabaperks marketing; the normal optional join consent remains separate.
