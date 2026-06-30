# Admin And Support Console

Flows covered: 52-60.

## Axis Architecture

The admin console is server-rendered under `/admin`. The admin layout gates
access through admin status and MFA requirements before rendering `AdminShell`.
Readbacks are mostly service-role queries in admin data modules. Mutations are
server actions that call `requireAdminAction()`, validate required context, and
delegate to audited SQL RPCs with internal-admin checks.

## Flow Analysis

| ID | Flow | Architecture | Pitfalls | Improvements |
| --- | --- | --- | --- | --- |
| 52 | Admin access gate | `/admin/layout.tsx` gates unauthenticated, inactive/non-admin, and missing-MFA users before shell render. | Admin service-role reads now use a guarded client that calls `requireAdminRead()` before bypassing RLS; anonymous admin route gating has browser smoke coverage. | Add broader admin route/action tests for inactive, non-admin, no-MFA, and valid admin paths once an admin test session is available. |
| 53 | Admin overview/funnel | Overview page aggregates pilot/product metrics and source labels. | Latest/summary readbacks can hide exact records needed for support. | Add drill-down links and filters once support volume grows. |
| 54 | Admin merchant/QR operations | Merchant and QR readbacks plus actions for QR active state and regeneration. | QR state changes affect public customer acquisition; destructive changes need idempotency/confirmation/rate limits. | Add confirmation, idempotency keys, reason categories, and tests for QR active/regenerate RPCs. |
| 55 | Admin customer/reward interventions | Customer/reward readbacks plus stamp adjustment and reward cancellation actions. | Reward/stamp interventions are high-impact and must be audited and reversible enough for support. | Add stronger reason taxonomy, double-submit protection, and tests for authorization, invalid ids, and audit writes. |
| 56 | Admin privacy/consent/data requests | Privacy readbacks and actions for consent opt-out and data request logging. | PII selection and masking are split between data and UI layers. | Return masked DTOs from admin data helpers by default and isolate raw PII access behind named fields. |
| 57 | Admin fraud signals | Fraud flags and redemption failure readbacks. | Product event metadata can grow into raw payload exposure if not curated. | Allow-list fraud/event display fields and keep raw metadata out of client DTOs. |
| 58 | Admin audit logs | Readback of admin/product audit evidence. | Latest-only audit pages limit investigation; no direct action/id search. | Add filters by actor, merchant, action, target id, severity, and time range. |
| 59 | Admin billing | Service-role billing rows are shaped into masked admin DTOs with formatted support status before page render. | Webhook-derived billing state is still sensitive operational data and can drift from provider truth. | Link billing readback to webhook/audit history and keep provider/live reconciliation proof separate from local UI masking tests. |
| 60 | Admin pilot report/notes | Pilot status and note logging. | Notes can become unofficial source of truth unless linked to specific merchant/action context. | Add structured note categories and links to merchant/customer/support records. |

## Trust Boundaries

- Admin browser can request actions, but SQL RPCs and `requireAdminAction()`
  must prove internal-admin status.
- Service-role reads should be treated as privileged data access, not ordinary
  model reads.
- Admin read DTOs should minimize PII before reaching client components.

## Verification Gaps

- Admin gate tests for inactive, non-admin, no-MFA, and admin sessions.
- Service-role helper self-guard tests.
- Admin action tests for success, invalid id, unauthorized, missing reason,
  replay/double submit, and audit writes.
- PII and provider-id masking tests.

## Priority

P1 before relying on admin support at live scale.
