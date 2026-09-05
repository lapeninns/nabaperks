# Reward collection and in-person ID checks

An otherwise eligible customer may present a reward QR before their date of
birth has been verified. The QR opens a review; it is not permission to serve
or collect a reward. Actual collection still requires a verified adult DOB.

## At the counter

1. The customer opens the reward and shows its QR and photo ID to the venue
   owner. Incomplete profiles must be completed first.
2. The owner scans the code and signs into the merchant account if necessary.
3. For an unverified account, the owner compares the person and stored DOB with
   the photo ID, then explicitly confirms the check. No document upload is
   required or stored.
4. **Verify ID and collect reward** records the check and collects that specific
   reward atomically. **Mark reward collected** remains the action for accounts
   that are already verified. A repeated scan shows the collected result.

If ID is missing or does not match, do not collect. Ask the customer to correct
their profile, or refer the correction to internal-admin support, and reopen the
QR. A changed DOB invalidates prior verification and retires existing tokens.

This release supports venue-owner accounts, not individual staff accounts.
Successful verification is reusable across Nabaperks, including existing
birthday eligibility checks. It records the account check; venue staff may
still request ID when appropriate. Internal-admin verification remains available.

## Trust boundaries and interfaces

- `get_owner_reward_scan_context(scan_token)` uses the authenticated owner
  session and returns `verification_required` with name/DOB only for an eligible
  reward at that owner's venue. Terminal or blocked contexts contain no ID-check
  fields. Email is read through `customers_masked` inside the RPC itself, so
  direct authenticated calls also receive masked contact details in every state.
- `verify_and_collect_reward_scan_token(scan_token, expected_date_of_birth,
id_confirmed)` takes no caller-supplied customer, merchant or verifier identity.
  It rechecks ownership, eligibility and the reviewed DOB under row locks.
- The private verification receipt is tied to the transaction, owner, customer
  and reward. Ordinary profile writes, service-role writes and session flags
  cannot create verification provenance. Receipt and collection failures roll
  back together. Customer erasure removes the private receipts.
- Collection paths lock customer, reward and token in that order. Token minting
  also locks the customer first; global token retention remains the scheduled
  privacy-retention cron's responsibility, in a separate transaction.
- `customer_date_of_birth_verified` audit entries identify the owner, merchant,
  receipt and reward. Do not log DOB, contact details, QR tokens or ID documents.

The QR image and merchant Server Action remain product-internal interfaces;
the operational HTTP API documented in `docs/api/openapi.json` is unchanged.

## Release and rollback

Apply the three `20260905` reward-ID migrations in version order through
**Production database promotion**, then promote the exact tested application
revision through **Production deployment**. No existing account is verified by
these migrations. The old UI continues withholding unverified QRs until the new
application is promoted; old RPC signatures remain available.

Require isolated database proof of denied callers, forged provenance, rollback,
expiry, DOB changes, erasure and simultaneous collection, plus browser proof of
the complete customer/owner journey. Use isolated test fixtures, not production
customer records. Follow the production runbook's release checks and record
the migration ledger and deployment revision after promotion. The ephemeral
release job runs the ID-check mobile/desktop browser journeys against its
production build and locally seeded fixtures before production promotion.
The browser proof uses a loopback HTTPS proxy and a throwaway local certificate
so production CSP remains intact. Only the local browser context accepts that
self-signed certificate.

An application rollback restores the previous UI while retaining completed
verification, collection and audit records. Do not reverse collected rewards or
delete audit history to roll back the UI. Observe ID-check and collection
failures using stable failure reasons and masked identifiers.
