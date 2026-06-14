# Customer Flow Screenshot Runbook

This captures the Bean & Batch customer journey for `07467586751`
(`+447467586751`) through the permanent QR flow.

## Prerequisites

- `.env.local` has Supabase DB access, service-role keys, Twilio Verify keys,
  `CUSTOMER_SESSION_SECRET`, `CUSTOMER_PHONE_HMAC_SECRET`, and
  `CUSTOMER_PHONE_ENCRYPTION_KEY`.
- Use a non-production OTP bypass value when running locally:
  `CUSTOMER_DEV_OTP_CODE=424242`.
- The seed data includes Bean & Batch, QR `bean-test-qr`, and a 3-stamp active
  card.

## Commands

```bash
pnpm customer-flow:reset --phone 07467586751
pnpm customer-flow:status --phone 07467586751
CUSTOMER_DEV_OTP_CODE=424242 pnpm customer-flow:capture
```

The Playwright capture starts `pnpm dev` on `http://localhost:3000` when no
server is already running.

## Capture Phases

Screenshots are written to `docs/screenshots/customer-flow/`:

- `01-join/01-join-hero.png`
- `01-join/02-phone-filled.png`
- `01-join/03-otp-sent.png`
- `01-join/04-terms.png`
- `02-stamp-day-1/01-confirm.png`
- `02-stamp-day-1/02-card-1-of-3.png`
- `03-stamp-day-2/01-confirm.png`
- `03-stamp-day-2/02-card-2-of-3.png`
- `04-stamp-day-3/01-confirm.png`
- `04-stamp-day-3/02-card-3-of-3-unlocked.png`
- `05-reward-waiting/01-reward-waiting.png`
- `06-redeem/01-reward-ready.png`
- `06-redeem/02-card-reset-cycle.png`

## Phase Helpers

Use these when replaying a single phase manually:

```bash
pnpm customer-flow:advance --phone 07467586751 --stamps 1
pnpm customer-flow:advance --phone 07467586751 --stamps 2
pnpm customer-flow:make-redeemable --phone 07467586751
pnpm customer-flow:status --phone 07467586751 --json
```
