# Security risk register

This register records security risks that have been explicitly accepted rather
than silently treated as fixed. An accepted entry remains a real risk and must
be reviewed by its due date or sooner when a listed trigger occurs.

## SEC-RISK-001: recycled mobile number customer access

| Field      | Decision                                                                  |
| ---------- | ------------------------------------------------------------------------- |
| Status     | Remediated in source; production rollout pending                          |
| Risk owner | `info@lapeninns.com`                                                      |
| Accepted   | 21 July 2026                                                              |
| Remediated | 3 September 2026                                                          |
| Source     | `.deepsec/findings/MEDIUM/Nabaperks-other-account-takeover-1a4d2762eb.md` |

### Decision

Phone possession remains the first verification step, but no longer establishes
continuity with an existing customer by itself. A genuinely new phone identity
can still create its first wallet. An existing phone can open its historical
wallet only from a previously customer-bound device or after a fresh code sent
to the verified email already on that customer record.

An unrecognised device without a verified recovery email fails closed. It does
not receive the historical session, create a replacement wallet, or reassign
the phone. Unbound legacy sessions are revoked during migration rather than
being attached to whichever device presents them first.

### Restored invariant

- Session registration records the verified device and rejects later touches
  from another device.
- Existing-customer phone login and QR join share the same pre-session
  continuity decision.
- Recovery state is encrypted, short-lived, customer/phone/device-bound, and
  releases the session only while the original phone and verified email remain
  unchanged.
- Customer existence remains undisclosed until after phone OTP proof.
- Static QR routing, wallet identifiers, membership, stamping, and rewards are
  unchanged after legitimate authentication.

### Rollout note

Local source and database tests can establish the control design but do not
prove production deployment. Keep this item operationally open until the
continuity migration and compatible application release have been read back in
production. A production holder of the old build remains exposed until then.

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
