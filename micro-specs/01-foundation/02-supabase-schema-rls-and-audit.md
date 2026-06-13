# Micro-Spec: Supabase Schema, RLS, and Audit Backbone

## Exact Goal and User-Visible Outcomes

The database can safely store Nabaperks's MVP merchants, locations, staff approval records, loyalty cards, QR codes, customers, memberships, stamp events, reward events, consent records, billing state, product events, and audit logs.

Merchants, customers, staff, and admins only see or mutate the data their role permits.

## Blast Radius

In scope:

- Supabase migrations and seed data.
- Database types generated from Supabase, if the repo uses generated types.
- Server-side data access helpers.
- RLS policies for merchant, staff, customer, admin, billing, event, and audit tables.
- Test fixtures for tenant isolation and audit/event readback.

Out of scope:

- Full UI implementation.
- Stripe webhook logic beyond schema support.
- Multi-location product UX beyond a single MVP location.
- SMS/WhatsApp notification schemas unless needed for future-safe consent channel values.

## Strict Constraints and Assumptions

- RLS is a core MVP requirement.
- All tenant-owned tables must include tenant isolation paths.
- Service-role access is only allowed in trusted server functions.
- Audit logs must avoid storing sensitive secrets and unnecessary personal data.
- Product event tables are the reporting source of truth.
- Database changes must be reversible or documented with clear migration ordering.

## Decisions Already Made

Core entities:

- `merchants`
- `merchant_locations`
- `staff_users` or staff PIN records
- `loyalty_cards`
- `qr_codes`
- `customers`
- `customer_memberships`
- `stamp_events`
- `reward_events`
- `consent_records`
- `billing_customers`
- `audit_logs`
- `product_events`

Roles:

- Merchant owner
- Staff
- Customer
- Internal admin
- System

## Behavioral Requirements

- WHEN a merchant owner queries merchant data, THE database SHALL return only records for that merchant.
- WHEN staff access stamp or redemption functions, THE database SHALL restrict them to their assigned merchant/location.
- WHEN a customer views loyalty data, THE database SHALL return only their own customer profile, memberships, stamps, and rewards.
- WHEN an internal admin performs a support action, THE system SHALL write an audit log.
- WHEN a billing, stamp, reward, consent, QR, or admin mutation succeeds, THE system SHALL write the appropriate audit or product event.
- WHEN unauthenticated users access protected tables directly, THE database SHALL deny access.

## Verification Criteria

Acceptance criteria:

- All MVP tables exist with primary keys, tenant/customer references, timestamps, and required status fields.
- RLS is enabled on all tenant, customer, billing, consent, event, and audit tables.
- Tenant isolation tests cover at least two merchants and two customers.
- Admin and system/service-role paths are explicitly separated from client access.

Manual QA:

- Use two merchant accounts and confirm each cannot see the other's data.
- Use two customer identities and confirm each cannot see the other's cards.
- Perform a sample admin adjustment and confirm an audit log appears.

Task breakdown:

- Define schema migrations.
- Define role helper functions or policy predicates.
- Add RLS policies.
- Add seed/test fixtures.
- Verify read/write isolation and audit readback.
