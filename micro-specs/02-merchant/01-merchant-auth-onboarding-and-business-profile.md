# Micro-Spec: Merchant Auth, Onboarding, and Business Profile

## Exact Goal and User-Visible Outcomes

A merchant can create an account, verify their identity, complete a simple business profile, and arrive in the merchant app ready to create a loyalty card. The setup must feel achievable without support.

## Blast Radius

In scope:

- Merchant auth pages/actions.
- `/app/onboarding`
- Business profile and first location data flows.
- Merchant session handling and protected app shell.
- Transactional signup/trial-start email hooks if needed.

Out of scope:

- Social login.
- Password reset beyond Supabase default support.
- Multi-location onboarding.
- Staff account invitations.
- Billing checkout, except showing a required later step or billing status placeholder.

## Strict Constraints and Assumptions

- Use Supabase Auth.
- Merchant owner identity must map to `merchants.owner_user_id`.
- MVP required fields: name, email, password or magic link, business name, business type, location name, optional phone number.
- Onboarding must create exactly one merchant and one MVP location for the owner.
- A partially completed onboarding state must be recoverable after refresh/login.

## Decisions Already Made

- Merchant app route family begins at `/app`.
- Onboarding route is `/app/onboarding`.
- Default timezone is `Europe/London`.
- Merchant statuses include trial, active, paused, and cancelled.

## Behavioral Requirements

- WHEN a new merchant signs up successfully, THE system SHALL create or link a merchant owner account.
- WHEN a merchant verifies auth and has no completed profile, THE app SHALL route them to onboarding.
- WHEN the merchant submits required business fields, THE system SHALL create the merchant profile and first location.
- WHEN required fields are missing or invalid, THE system SHALL preserve entered values and show field-level errors.
- WHEN a merchant has a saved profile but no first location, THE app SHALL route them back to onboarding with saved business fields and SHALL create the missing first location on submit.
- WHEN a merchant returns after completing onboarding, THE app SHALL route them to the dashboard or next incomplete setup step.
- WHEN onboarding creates or updates merchant records, THE system SHALL record `merchant_signed_up` or equivalent product/audit events.

## Verification Criteria

Acceptance criteria:

- Merchant can sign up and access `/app/onboarding`.
- Merchant can complete business profile and first location.
- Refreshing during onboarding does not lose persisted completed steps.
- Protected app routes reject unauthenticated users.

Manual QA:

- Complete onboarding as a new merchant.
- Attempt to access `/app` while signed out.
- Attempt onboarding with missing business name, business type, and location name.
- Confirm created records are tenant-owned by the merchant owner.

Task breakdown:

- Implement protected merchant shell.
- Implement signup/login and session checks.
- Implement onboarding form and persistence.
- Verify tenant-owned profile creation and event logging.
