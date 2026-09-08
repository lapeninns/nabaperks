# Security risk register

This register records security risks that have been explicitly accepted rather
than silently treated as fixed. An accepted entry remains a real risk and must
be reviewed by its due date or sooner when a listed trigger occurs.

## SEC-RISK-001: recycled mobile number customer access

| Field      | Decision                                                                  |
| ---------- | ------------------------------------------------------------------------- |
| Status     | Reopened; device continuity disabled in source                            |
| Risk owner | `info@lapeninns.com`                                                      |
| Accepted   | 21 July 2026                                                              |
| Remediated | 3 September 2026                                                          |
| Reopened   | 7 September 2026                                                          |
| Review due | 7 December 2026                                                           |
| Source     | `.deepsec/findings/MEDIUM/Nabaperks-other-account-takeover-1a4d2762eb.md` |

### Decision

A verified phone OTP again establishes continuity with an existing customer on
its own, from any browser or device. The stronger control shipped on
3 September 2026 is retained in the tree but switched off.

It was switched off because it locked out the customers it was meant to
protect. Its migration revoked every device trust row minted before it, so no
browser was recognised for any pre-existing customer, and a recovery email can
only be verified from an already authenticated session. An existing customer
with no verified recovery email therefore had no path back into their own
wallet from any device, including the one they had always used.

### Reopened exposure

A person who is issued a recycled mobile number can open the previous holder's
wallet, and with it their venue cards, stamp balances, and unredeemed rewards.
Phone possession is once more the only proof required. The exposure is real,
accepted, and scoped to customer wallets: merchant, admin, and billing surfaces
are unaffected.

### Retained invariant

- Existing-customer phone login and QR join still share one pre-session
  continuity boundary, so the control is restored in one place.
- Session registration still records the verified device and rejects later
  touches from another device, so a copied cookie still cannot move.
- Sessions minted this way are recorded with the `verified_phone` continuity
  source, which is excluded from device trust, so restoring the control does
  not inherit trust that phone possession alone created.
- The verified-email recovery journey stays wired behind
  `REQUIRE_DEVICE_CONTINUITY` in `lib/customer/access-continuity.ts`.
- Customer existence remains undisclosed until after phone OTP proof.

### Exit condition

Restore the control once existing wallets carry a verified recovery email, or
once a venue-attested re-trust path exists, so that enabling it no longer
strands customers. Restoring means setting `REQUIRE_DEVICE_CONTINUITY` to true
and reverting
`supabase/migrations/20260908120000_allow_verified_phone_continuity.sql`.

## SEC-RISK-002: static QR cannot prove venue presence

| Field      | Decision                                                                    |
| ---------- | --------------------------------------------------------------------------- |
| Status     | Accepted                                                                    |
| Risk owner | `info@lapeninns.com`                                                        |
| Accepted   | 2 September 2026                                                            |
| Review due | 2 December 2026                                                             |
| Source     | Codex Security remediation batch B04; finding records 4, 35, 41, 44, and 46 |

### Decision

Nabaperks will retain its stable static venue QR as the core customer stamping
experience. The product will not require a rotating QR, merchant confirmation,
trusted POS proof, or device-attested venue hardware at this time.

### Residual risk

A static QR can be photographed or copied, and browser-supplied coordinates can
be forged. An attacker who has the QR identifier can therefore submit a remote
self-service stamp that is indistinguishable from a legitimate in-venue request
at the current trust boundary. Daily limits, attempt limits, venue/card checks,
and fraud telemetry constrain abuse but do not prove physical presence.

This acceptance applies only to the presence-proof limitation. Membership,
billing, tenant, reward-state, daily-stamp, rate-limit, and audit controls remain
mandatory and must not be bypassed.

### Rationale

The static poster flow is a core low-friction product requirement. The product
owner explicitly chose to preserve it on 2 September 2026 after being informed
that neither the public identifier nor client GPS can establish venue presence.

### Existing safeguards

- The database requires an active merchant, location, loyalty card, membership,
  and matching QR context.
- The stamp ledger enforces the UK-business-day stamp rule.
- Attempt limits are charged before the mutation and refusal telemetry is
  durable.
- Reward issuance and redemption remain server-authoritative.
- Fraud evidence remains available for review and audited resolution.

### Reconsider immediately when

- copied-QR or remote-stamping abuse is reported;
- reward value or financial impact materially increases;
- a merchant-confirmed, POS-backed, or accessible low-friction proof becomes
  available; or
- monitoring shows repeated geofence anomalies or coordinated account activity.

At review, the risk owner must either record a new acceptance date and rationale
or adopt independent, server-verifiable presence proof. Client GPS alone is not
an acceptable closure condition.
