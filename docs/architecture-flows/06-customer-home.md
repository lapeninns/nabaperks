# Customer Home And Account Flows

Flows covered: 40-44.

## Axis Architecture

Customer home is a wallet/account surface under `/home`. Login uses phone OTP
and signed httpOnly customer cookies backed by service-role-only session rows.
The authenticated layout gates every child route through current customer
resolution. Server components and actions then use service-role reads/writes
scoped by that current customer id.

## Flow Analysis

| ID  | Flow                                     | Architecture                                                                                               | Pitfalls                                                                                                                                                                                                              | Improvements                                                                                                                                                     |
| --- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 40  | Customer login/sign-out/session reset    | `/home/login` issues/verifies OTP and sets customer session; reset route clears stale customer session.    | Unknown numbers now receive a real OTP under rate limit; no linked cards are revealed only after successful phone verification. Wrong-code and no-card verify feedback now renders from the verify action state.      | Add expired OTP, known-number success, stale-reset, and Twilio provider smoke tests.                                                                             |
| 41  | Customer dashboard `/home`               | Authenticated dashboard reads cards, rewards, top redeemable item, and recent activity.                    | Dashboard completeness depends on reward grouping and session scoping helpers.                                                                                                                                        | Add customer-owned dashboard fixture tests for no cards, one card, reward waiting, reward redeemable, redeemed.                                                  |
| 42  | Customer profile/consent/push settings   | Profile page/actions update customer details, marketing consent, email verification, and push preferences. | Push route/source contracts now cover current-customer scoping, refresh/unsubscribe lifecycle reasons, no-store responses, and preference writes; browser/service-worker state can still diverge from server records. | Keep shared push consent and route contracts covered; add browser/provider tests for service-worker refresh, unsubscribe, permission denial, and stale sessions. |
| 43  | Customer rewards library `/home/rewards` | Server page groups rewards into redeemable/upcoming/redeemed/expired views.                                | Expired rewards are rendered in a history section, included in empty-state calculation, and now have local browser proof alongside redeemable, upcoming, and redeemed rewards.                                         | Keep mixed-state browser coverage in the customer-flow gate and re-run it against staging after session/seed parity is available.                                |
| 44  | Customer activity `/home/activity`       | Server readback of customer-owned activity stream.                                                         | Service-role reads derive scope from the current session, product-event metadata is parsed through a customer-safe allow-list before display, and populated/empty states now have local browser proof.                | Keep current-customer scoping, metadata allow-list contracts, and populated/empty browser coverage in the required gate set.                                     |

## Trust Boundaries

- Customer id must always come from the signed session, never from request input.
- Service-role reads are acceptable only behind current-customer scoping.
- Browser push subscription state is cache/integration data; consent and
  notification decisions remain server-owned.

## Verification Gaps

- Customer session ownership tests.
- Browser/service-worker push preference and lifecycle tests.

## Priority

P1 for consent and reward visibility before broader customer rollout.
