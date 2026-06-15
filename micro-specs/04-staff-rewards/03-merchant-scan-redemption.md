# Micro-Spec: Merchant-Scan Reward Redemption

## Exact Goal and User-Visible Outcomes

Customers do not self-mark rewards as redeemed. A redeemable reward page shows a
short-lived QR code and code string. A signed-in merchant scans or pastes that
token in `/app/redeem`, previews the reward, and confirms redemption.

## Blast Radius

In scope:

- `/reward/[reward_id]` QR token display and status polling.
- `/reward/[reward_id]/qr` protected QR image route.
- `/r/[public_token]` public resolver into merchant login or scanner.
- `/app/redeem` merchant scanner and manual paste fallback.
- `redemption_tokens` table and token RPCs.
- `reward_events` redeemed state, merchant attribution, audit logs, and product
  events.

Out of scope:

- Staff PINs, station sessions, or shared staff secrets.
- Customer identity document checks.
- Marketing consent changes.
- Stored value, payments, or settlement.

## Behavioral Requirements

- WHEN a customer opens a redeemable owned reward, THE system SHALL create or
  reuse one active unexpired redemption token for that reward.
- WHEN the customer shows the reward page, THE UI SHALL display assigned reward
  details, a QR code, and the short token code without exposing a customer-side
  redeem button.
- WHEN a merchant opens `/r/{public_token}`, THE system SHALL route the token to
  `/app/redeem?token=...` after merchant authentication.
- WHEN a signed-in merchant scans or pastes a token, THE system SHALL verify the
  token belongs to that merchant before showing reward details.
- WHEN the merchant confirms a valid token, THE system SHALL redeem the reward
  once, attribute the action to the merchant user, decrement the visible stamp
  cycle, and write product/audit events.
- WHEN a token is expired, cancelled, consumed, not found, or belongs to another
  merchant, THE UI SHALL show a blocked state and SHALL NOT redeem the reward.
- WHEN a token is already consumed by the same merchant flow, THE mutation SHALL
  replay safely without creating a second redemption.

## Verification Criteria

Acceptance criteria:

- Customer reward UI uses `RewardQrPanel`, not `SelfServiceRedeemForm`.
- `create_redemption_token` and `get_redemption_token_status` are customer-owned
  RPC paths.
- `lookup_redemption_token_for_merchant` and `consume_redemption_token` are
  merchant-owned RPC paths.
- `/app/redeem` supports camera scanning and manual paste.
- Duplicate and wrong-merchant attempts do not mutate the reward twice.

Manual QA:

- Unlock a reward, open `/reward/[rewardId]`, and confirm the QR appears.
- Open `/app/redeem`, scan or paste the QR, and confirm the preview.
- Confirm redemption and verify customer card/reward/activity readbacks.
- Retry the same token and verify the blocked or idempotent response.
