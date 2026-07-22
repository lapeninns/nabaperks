# Security risk register

This register records security risks that have been explicitly accepted rather
than silently treated as fixed. An accepted entry remains a real risk and must
be reviewed by its due date or sooner when a listed trigger occurs.

## SEC-RISK-001: recycled mobile number customer access

| Field | Decision |
| --- | --- |
| Status | Accepted |
| Risk owner | `info@lapeninns.com` |
| Accepted | 21 July 2026 |
| Review due | 21 October 2026 |
| Source | `.deepsec/findings/MEDIUM/Nabaperks-other-account-takeover-1a4d2762eb.md` |

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
