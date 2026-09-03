# Security risk register

This register records security risks that have been explicitly accepted rather
than silently treated as fixed. An accepted entry remains a real risk and must
be reviewed by its due date or sooner when a listed trigger occurs.

## SEC-RISK-001: recycled mobile number customer access

| Field      | Decision                                                                  |
| ---------- | ------------------------------------------------------------------------- |
| Status     | Accepted                                                                  |
| Risk owner | `info@lapeninns.com`                                                      |
| Accepted   | 21 July 2026                                                              |
| Review due | 21 October 2026                                                           |
| Source     | `.deepsec/findings/MEDIUM/Nabaperks-other-account-takeover-1a4d2762eb.md` |

### Decision

Nabaperks will retain phone-only customer access. A successful one-time code
sent to the current holder of the mobile number remains sufficient to open the
existing customer account associated with that number. Email will not become a
mandatory second factor and phone-only customers will not be routed into manual
recovery.

### Residual risk

UK mobile numbers can be reassigned. A new holder can receive a valid phone
code and may therefore inherit the previous holder's customer session, loyalty
memberships, rewards, profile details, and verified-email state. Phone HMACs
protect stored lookup data but do not distinguish the original subscriber from
a later holder of the same number.

The exposure is limited to the customer identity associated with that phone
number. Merchant administration, billing, internal administration, and provider
credentials use separate authentication boundaries.

### Rationale

Customer email is optional today and there is no staffed identity-recovery flow.
Mandatory email step-up or quarantine would lock legitimate phone-only
customers out after changing device or clearing cookies. The product owner has
chosen continuity of phone-only access and explicitly accepts the takeover risk
until the review date.

### Existing safeguards

- Phone possession is verified with a short-lived provider OTP.
- OTP send and verification attempts have phone, trusted-IP, and fail-closed
  request-identity limits.
- Customer sessions are signed, server-registered, revocable, and expire after
  30 days.
- Customer existence is looked up only after OTP proof, so the pre-verification
  cookie does not disclose whether a phone number has an account.
- Abandoned history-free identities and stale customer PII have guarded
  retention workflows.

These controls reduce abuse and disclosure but do not solve number
reassignment.

### Reconsider immediately when

- a suspected recycled-number takeover or disputed customer identity is
  reported;
- the product gains a staffed recovery process or reliable provider
  reassignment signal;
- verified-email coverage is high enough to introduce step-up without broadly
  locking out customers; or
- customer accounts begin holding money, payment authority, or another higher
  impact entitlement.

At review, the risk owner must either record a new acceptance date and rationale
or require recognised-device binding, verified-email step-up, and a recovery
path before phone lookup can establish an existing customer session.

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
