# Guest journey redesign

Task record for the guest-facing loyalty journey redesign (branch
`codex/guest-journey-redesign`, started 30 September 2026). The screen-by-screen
journey specification (guest intention, entry, primary task, copy, states,
deferred information and constraints) is [designer-brief.md](designer-brief.md).
This file records the server-side decisions, owner rules and research that the
implementation follows.

## Owner rules confirmed for this task

- **Email is never a sign-in option.** It is only the phone code's fallback,
  behind the existing server gate (`lib/customer/email-fallback.ts`): 30
  seconds after the latest phone code, after a failed send, or while an email
  sign-in for the flow is already under way. Email addresses are cheap to
  create, so an email entry point would enable referral abuse. No direct email
  route is added to the welcome, phone or `/home/login` screens.
- Referral qualification still requires the referee's verified phone
  (`supabase/migrations/20261009100200_referral_requires_verified_referee_phone.sql`).
  Unchanged.
- Reward collection requirements are unchanged: name, date of birth, verified
  email and verified phone, plus in-person photo ID when the reward has an age
  check (`lib/customer/profile-completion.ts`,
  `lib/customer/experience/collection-stage.ts`). The redesign changes only
  how the next unmet requirement is presented.

## Server-side decisions

| Case after a valid fallback email code         | Before                                                                            | After                                                                                            |
| ---------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Email holds a wallet with a card at this venue | Signed in, today's stamp                                                          | Unchanged                                                                                        |
| Email holds a wallet, no card here             | Signed in, terms step                                                             | Unchanged                                                                                        |
| No wallet holds it, mode `full`                | Handoff cookie, then an "Email confirmed, continue with your email" choice screen | Wallet created from the verified email at the code step, signed in, terms step. No choice screen |
| No wallet holds it, mode `existing`            | Handoff cookie, choice screen offering only phone                                 | Honest "No card uses this email" state with one action back to the phone                         |
| Handoff cookie left by the previous build      | Choice screen                                                                     | One-action "Email confirmed, continue" transition that still consumes the single-use handoff     |

- Creating the wallet at the code step mirrors the phone path, where a
  verified phone establishes the customer before terms. No membership, stamp
  or marketing consent is created until the guest accepts the required terms
  on the join step.
- The email challenge stays single use (`email-sign-in:consumed:<id>`); a
  failure after the code is spent restores it for one retry
  (`keepEmailSignInForRetry`), as before. Wallet conflicts keep the existing
  conflict message.
- Joining keeps separate required terms and optional marketing controls. The
  "Yes to all" control is removed. Server-side consent recording is unchanged.

## Research (checked 30 September 2026, read-only `gh api`)

| Repository                                                            | Stars  | Licence    | Relevant findings                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [supabase/auth](https://github.com/supabase/auth)                     | 2,571  | MIT        | The provider already in use. Verify clears all outstanding one-time tokens for the user (`internal/models/user.go`); resend throttled by `MaxFrequency` (`internal/api/phone.go`); resend returns the same response for unknown users (`internal/api/resend.go`); linking considers only verified emails and refuses ambiguous candidates (`internal/models/linking.go`). |
| [better-auth/better-auth](https://github.com/better-auth/better-auth) | 30,132 | MIT        | Closest TypeScript match. Phone OTP attempt budget with atomic consumption and a test that exactly one of two concurrent verifies succeeds (`plugins/phone-number`); implicit linking only when the local identifier is verified (`oauth2/link-account.ts` and tests).                                                                                                    |
| [ory/kratos](https://github.com/ory/kratos)                           | 13,899 | Apache-2.0 | Identifier-first login with enumeration mitigation (`selfservice/strategy/idfirst`); duplicate credentials are held and linked only after the guest signs in to the existing identity and the identifier matches (`selfservice/flow/login/hook.go`).                                                                                                                      |

Also checked but not shortlisted: nextauthjs/next-auth (28,372, ISC; magic
links only), zitadel/zitadel (15,135, AGPL-3.0; incompatible to copy),
logto-io/logto (14,647, MPL-2.0; its terms agreement is client-side state
only, not an auditable record).

Limitations: all three are either a different language or would replace
Supabase Auth sessions and RLS, which the repository guide rules out.

**Chosen approach: adapt, no new dependency.** The existing Supabase OTP,
single-use email challenge and verified-only wallet linking already match the
researched patterns. The redesign keeps them and applies the findings that
fit: one decision per identifier (no second "choose email" step, as in
identifier-first flows), enumeration-safe outcomes (no screen reveals another
wallet), linking only after proof of both identifiers (as Kratos does), and
consent built in-project as separate server-recorded choices, because none of
the reviewed projects models optional marketing consent.
