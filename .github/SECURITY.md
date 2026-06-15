# Security policy

## Reporting a vulnerability

Please report security issues **privately**. Do not open a public issue or pull
request for a vulnerability.

- Open a private advisory: <https://github.com/lapeninns/nabaperks/security/advisories/new>

We aim to acknowledge reports within 3 working days and to agree a remediation
timeline based on severity.

## Scope and sensitive data

Nabaperks handles customer phone numbers (stored E.164, encrypted/HMACed) and
loyalty activity. When reporting, **never include real customer personal data**;
redact phone numbers and use synthetic examples.

Areas of particular interest:

- The mutation boundary — the security-definer RPCs (`issue_self_service_stamp`,
  `redeem_self_service_reward`, `join_customer_membership`,
  `create_merchant_onboarding`) and Row Level Security tenant isolation.
- The service-role boundary — service-role code must never reach a client bundle
  (`import "server-only"`).
- Customer session signing, phone HMAC/encryption, and webhook signature
  verification (Stripe, Supabase auth hooks).

## Supported versions

This is an actively developed application deployed from `main`; fixes land on
`main` and roll out via the standard deploy. There are no separately maintained
release branches.

## Automated controls

Code scanning (CodeQL), dependency review, Dependabot, secret scanning with push
protection, and a static `pnpm security:verify` gate run in CI. See
[`docs/OBSERVABILITY.md`](../docs/OBSERVABILITY.md) for runtime monitoring.
