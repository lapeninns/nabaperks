# Security risk register

This register records security risks that have been explicitly accepted rather
than silently treated as fixed. An accepted entry remains a real risk and must
be reviewed by its due date or sooner when a listed trigger occurs.

## SEC-RISK-001: recycled mobile number customer access

| Field      | Decision                                                                  |
| ---------- | ------------------------------------------------------------------------- |
| Status     | Reopened; device continuity disabled in source                            |
| Risk owner | `info@lapeninns.com`                                                      |
| Accepted   | 21 July 2026                                                              |
| Remediated | 3 September 2026                                                          |
| Reopened   | 7 September 2026                                                          |
| Review due | 7 December 2026                                                           |
| Source     | `.deepsec/findings/MEDIUM/Nabaperks-other-account-takeover-1a4d2762eb.md` |

### Decision

A verified phone OTP again establishes continuity with an existing customer on
its own, from any browser or device. The stronger control shipped on
3 September 2026 is retained in the tree but switched off.

It was switched off because it locked out the customers it was meant to
protect. Its migration revoked every device trust row minted before it, so no
browser was recognised for any pre-existing customer, and a recovery email can
only be verified from an already authenticated session. An existing customer
with no verified recovery email therefore had no path back into their own
wallet from any device, including the one they had always used.

### Reopened exposure

A person who is issued a recycled mobile number can open the previous holder's
wallet, and with it their venue cards, stamp balances, and unredeemed rewards.
Phone possession is once more the only proof required. The exposure is real,
accepted, and scoped to customer wallets: merchant, admin, and billing surfaces
are unaffected.

### Retained invariant

- Existing-customer phone login and QR join still share one pre-session
  continuity boundary, so the control is restored in one place.
- Session registration still records the verified device and rejects later
  touches from another device, so a copied cookie still cannot move.
- Sessions minted this way are recorded with the `verified_phone` continuity
  source, which is excluded from device trust, so restoring the control does
  not inherit trust that phone possession alone created.
- The verified-email recovery journey stays wired behind
  `REQUIRE_DEVICE_CONTINUITY` in `lib/customer/access-continuity.ts`.
- Customer existence remains undisclosed until after phone OTP proof.

### Email sign-in (27 September 2026)

Email is a fallback sign-in method. It ships behind
`CUSTOMER_EMAIL_AUTH_MODE` (`off`, `existing`, `full`; default `off`). Phone
always leads on the join page and `/home/login`; email is offered on the phone
code step 30 seconds after the server sent the code, at once when the phone
code cannot be sent, and on the `/home/login` no-cards step (owner decision,
28 September 2026, replacing the earlier email-first plan). The server enforces
the delay from the pending code's own send time and each browser's own
cookies, never from an address, so a refused request reveals nothing.

- It narrows the reopened exposure only for customers who sign in by email: a
  customer who never uses their phone number is not reachable through a
  recycled number unless their wallet also holds that number.
- It does not close it. Phone sign-in is unchanged, so a recycled number
  still opens a wallet that holds it.
- It adds the equivalent email exposure: whoever controls the mailbox opens
  the wallet. Only a verified email opens a wallet, each verified email
  belongs to at most one wallet (unique index on verified `email_hmac`), and
  "no wallet uses this email" is only said after the code is accepted.
- Email sign-in sessions use the existing `new_identity`,
  `recognised_device` and `verified_email` continuity sources;
  `register_customer_session` is unchanged.
- Code guessing is limited per challenge (5), per address (10 an hour), per
  device (20 an hour) and per client IP (60 an hour). A send that admission
  refuses still answers "code sent" and sets a challenge cookie, but that
  challenge holds no code and can never be verified, so refused sends cannot
  be farmed for guesses. There is no global guess limit: guesses need a
  challenge whose code was actually emailed, and sends are capped globally
  (150 an hour), so a global guess bucket would add a way to lock everyone
  out without adding protection.
- Accepted trade-off: the per-address limit can be spent by someone else.
  Anyone can have codes sent to an address (3 per 15 minutes) and submit wrong
  guesses, locking that address out of email sign-in for up to an hour. The
  owner receives those code emails, and a wallet that also holds a phone can
  still sign in by phone; an email-only wallet has to wait. Guesses against a
  refused challenge do not count towards it. Revisit if support sees
  lock-outs, for example by counting only failures from other devices.

### Exit condition

Restore the control once existing wallets carry a verified recovery email, or
once a venue-attested re-trust path exists, so that enabling it no longer
strands customers. Email sign-in on the join page and the add-your-email
prompts are the route to the first condition: they give phone customers a way
to add and use a verified email without relying on this device. Measure the
share of active wallets with a verified email before deciding. Restoring
means setting `REQUIRE_DEVICE_CONTINUITY` to true and reverting
`supabase/migrations/20260908120000_allow_verified_phone_continuity.sql`.

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
- The daily venue code is the only presence proof the fallback relies on. The
  earlier precondition that a valid code be preceded by a server-recorded
  location refusal was removed on 11 September 2026 (`20260911120000`): any
  client could create that refusal by submitting `location_status = 'denied'`,
  so it added no assurance and only forced a wasted, throttled submit before a
  legitimate member could use the code.

### Reconsider immediately when

- copied-QR or remote-stamping abuse is reported;
- reward value or financial impact materially increases;
- a merchant-confirmed, POS-backed, or accessible low-friction proof becomes
  available; or
- monitoring shows repeated geofence anomalies or coordinated account activity.

At review, the risk owner must either record a new acceptance date and rationale
or adopt independent, server-verifiable presence proof. Client GPS alone is not
an acceptable closure condition.

## SEC-RISK-003: customer sessions last until log-out

| Field      | Decision                                            |
| ---------- | --------------------------------------------------- |
| Status     | Accepted                                            |
| Risk owner | `info@lapeninns.com`                                |
| Accepted   | 27 September 2026                                   |
| Review due | 27 December 2026                                    |
| Source     | Product owner decision; SMS code delivery at venues |

### Decision

A customer session no longer expires on the server. The `customer_sessions`
row is open-ended (`expires_at = 'infinity'`) and ends only on log-out, "Log
out on all devices", erasure, or retention anonymisation. The browser cookie
keeps a rolling one-year window, re-signed at most once a day on ordinary page
loads, so a customer who uses Nabaperks within a year is never signed out.

It was chosen because customer codes are sent by SMS only, and SMS often does
not reach guests inside venues. The previous hard 30-day window signed every
customer out a month after joining and forced another code at the bar.

### Residual risk

A lost, stolen, or shared phone stays signed in to the wallet until someone
logs it out. Whoever holds it can see the customer's cards, balances, and
masked contact details, and can start stamp or reward journeys.

### Existing safeguards

- Every request re-checks the session row: revocation, "Log out on all
  devices", and erasure take effect on the next request, whatever the cookie
  says.
- Sessions stay bound to their device, so a copied cookie still cannot move to
  another browser.
- Stamps still require the location check or the staff venue code, and reward
  collection happens in person with a verified email.
- The cookie is only ever renewed with a matching signed expiry; it is never
  stretched past what its signature allows.

### Reconsider immediately when

- a customer reports wallet misuse from a lost or shared device;
- wallets gain stored value or payment capability; or
- an alternative sign-in channel (such as email) removes the SMS dependency
  that motivated this decision.

### Trigger review: email sign-in (27 September 2026)

The third trigger has started to fire. Email codes on the join page arrive
over venue Wi-Fi, which removes the SMS dependency for customers who use
email. The feature ships behind `CUSTOMER_EMAIL_AUTH_MODE`, default `off`, so
nothing changes for customers until the mode is raised.

Proposed decision, pending confirmation by the risk owner: keep this
acceptance unchanged while the mode is `off` or `existing`, because phone-only
wallets still depend on SMS. Within 30 days of the mode reaching `full` in
production, review whether sessions should expire again, using the share of
active wallets with a verified email and the email code delivery rate. Record
the outcome here with its date.

### Owner decision: email sign-in mode `full` (28 September 2026)

On 28 September 2026 the risk owner decided to enable customer email sign-in
in mode `full`, so that email can open an existing wallet and start a new one
on the join page. Customer terms version `2026-09-28` describes joining and
signing in by email, which the production runbook requires before the mode is
raised. This records that decision only; it does not change the session
decision, residual risk or safeguards above.

The conditions already written in this entry still apply:

- Within 30 days of the mode reaching `full` in production, review whether
  sessions should expire again, using the share of active wallets with a
  verified email and the email code delivery rate, and record the outcome here
  with its date.
- Reconsider immediately if a customer reports wallet misuse from a lost or
  shared device, or if wallets gain stored value or payment capability.
- The review due date of 27 December 2026 stands.
