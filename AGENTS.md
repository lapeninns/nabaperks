# Nabaperks — Agent Guide

Project context and stack decisions for AI agents working in this repo.

---

## Stack

| Layer         | Recommendation                                                           |
| ------------- | ------------------------------------------------------------------------ |
| Frontend      | Next.js / React on Vercel                                                |
| Backend       | Next.js Route Handlers, Server Actions, Vercel Functions                 |
| Database      | Supabase Postgres                                                        |
| Auth          | Supabase Auth + Row Level Security                                       |
| QR            | Dynamic QR codes pointing to your own `/q/{qr_id}` redirect URLs         |
| Payments      | Stripe Billing + Customer Portal + Stripe webhooks into Supabase         |
| Hosting       | Vercel + Supabase                                                        |
| Admin         | Internal Next.js admin                                                   |
| Analytics     | PostHog for product analytics + Supabase event tables as source of truth |
| Notifications | Resend for email; Twilio later for SMS/WhatsApp                          |
| Logging       | Vercel logs + PostHog Error Tracking/Logs; Sentry later if needed        |
| Backups       | Supabase daily backups; PITR when data-loss tolerance becomes lower      |
| Security      | HTTPS, RLS, RBAC, audit logs, rate limits, MFA, service-role isolation   |

---

## Spec pack and global context

`nabaperks-micro-specs-final.md` (v3) is the binding micro-spec pack. Its
"Global Context for AI Agents" applies to all work in this repo; the essentials:

### Product assumptions

- UK small/mid local businesses; web-first MVP. Customers need no app, staff
  use a web counter station, merchants a web console, operators an admin console.
- Currency GBP; default timezone `Europe/London`. Phone-first customer
  identity: accept `07...`, store E.164. Browser storage is cache only — the
  server is the source of truth.
- The core trust mechanic: **the customer keeps their phone, and staff approve
  short-lived codes only from paired counter stations.** The customer shows a
  short-lived single-use code; a paired counter station with a named staff
  session approves it.

### Architectural constraints

- Every loyalty-affecting action is an auditable server-side event; customer
  card state is recoverable from server state.
- Every venue action is attributable to venue, station, staff session,
  timestamp, and action type.
- Tokens are short-lived single-use Postgres rows consumed by an atomic
  conditional update; the approval idempotency key is the token id.
- No shared staff secrets as primary verification; no customer ID documents;
  no raw phone numbers exposed to merchants by default; no marketing without
  explicit opt-in; no reward promise mismatch between poster, QR landing,
  card, and merchant configuration.

### Repo domain mapping

The spec pack's monorepo domains map onto this single Next.js app:

| Spec domain                            | Here                                  |
| -------------------------------------- | ------------------------------------- |
| `apps/customer-web`                    | `app/q`, `app/m`, `app/card`, `app/reward` |
| `apps/staff-station`                   | `app/staff`                           |
| `apps/merchant-console`                | `app/app`                             |
| `apps/admin-console`                   | `app/admin`                           |
| `packages/api`                         | server actions + `app/api`            |
| `packages/domain` / `db`               | `lib/*` + `supabase/migrations`       |
| `packages/risk` / `compliance` / etc.  | `lib/security`, `lib/analytics`, ...  |

Do not widen a micro-spec's blast radius without approval.

### TDD workflow (binding — see `Instructions_tdd.md`)

Red → Green → Refactor. Every in-scope EARS requirement gets a failing test
before production code. Fake It, then Triangulate; Obvious Implementation only
for trivial behaviour. Refactor only under green; duplication waits for the
Rule of Three. Tests live in `tests/micro-specs/` (Vitest) and
`supabase/tests/` (SQL against real Postgres for invariants RLS/atomicity
mocks cannot exercise).

---

## Related Docs

| Doc                    | Purpose                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE.md` | As-built architecture map for routes, data/RLS, flows, integrations, traceability, and known gaps |
| `DESIGN.md`            | Design system — tokens, typography, components, UI conventions                                    |

---

<!-- BEGIN:nextjs-agent-rules -->

## Next.js

This is NOT the Next.js you know.

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->
