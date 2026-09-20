# Customer messaging with Twilio

Nabaperks can deliver selected loyalty messages through WhatsApp, then SMS,
with browser push as the final channel. The feature is disabled by default.
Do not enable it until the provider setup, approved templates, consent review,
legal review and local verification in this runbook are complete.

## Safety model

`CUSTOMER_MESSAGING_MODE=off` is the deployment default. A venue must also have
`merchants.customer_messaging_enabled=true` before any phone delivery is
eligible. Transactional and reminder messages respect their notification
preference plus the phone STOP switch. Marketing messages require the latest
venue consent for the selected phone channel. The push marketing preference is
separate and does not grant phone marketing permission.

An inbound STOP disables WhatsApp and SMS service messages and records explicit
marketing opt-outs for both channels at every joined venue. START re-enables
service messages only; it does not restore marketing consent. Birthday gifts,
direct rewards, collection-window nudges and venue announcements are marketing.

Provider acceptance means Twilio accepted the API request. Delivery, read and
failure states arrive later through the signed status callback. Do not report
provider acceptance as customer receipt.

## External prerequisites

Create a dedicated Twilio Messaging Service with the reviewed WhatsApp sender
and UK SMS sender. Enable Twilio Advanced Opt-Out and point inbound messages to
`https://<canonical-host>/api/twilio/inbound`. Point status callbacks to
`https://<canonical-host>/api/twilio/status`; the application adds a signed
`delivery_id` query parameter to each send.

Submit and obtain Meta approval for every WhatsApp template referenced in
`TWILIO_CONTENT_SIDS`. Template approval and legal review are external
prerequisites. This repository does not prove either has happened.
The environment validator requires an approved Content SID for every event in
`config/customer-messaging-content-events.json` before dry-run or live mode.
Each approved template must use variable `1` for the notification title,
variable `2` for its body and variable `3` for its Nabaperks path. The worker
derives SMS and WhatsApp content from the same catalogue payload.

Twilio documents that webhook signatures use the exact configured URL, all
form parameters and HMAC-SHA1. Its webhook fields can grow without notice, so
the routes validate all received form fields rather than a fixed signing list:

- [Twilio webhook security](https://www.twilio.com/docs/usage/webhooks/webhooks-security)
- [Twilio request validation](https://www.twilio.com/docs/usage/security)
- [Twilio inbound message webhooks](https://www.twilio.com/docs/messaging/guides/webhook-request)
- [Twilio Content Templates](https://www.twilio.com/docs/content/send-templates-created-with-the-content-template-builder)

The WhatsApp fallback set is `63003`, `63024`, `63016` and `63049`. Check the
current provider definitions before changing it. Twilio's official references
include [error 63003](https://www.twilio.com/docs/api/errors/63003) and the
[WhatsApp error mapping](https://www.twilio.com/docs/whatsapp/api/error-code-mapping).

## Environment

Set these server-only values through the deployment environment. Keep tokens,
phone numbers and message bodies out of logs and screenshots.

```text
CUSTOMER_MESSAGING_MODE=off
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_CUSTOMER_MESSAGING_SERVICE_SID=MG...
TWILIO_CONTENT_SIDS={"reward_ready":"HX..."}
CUSTOMER_MESSAGING_BYPASS_MODE=
```

An API key SID and secret can replace Auth Token credentials for outbound API
authentication, but Twilio webhook verification still requires the primary
Auth Token. `CUSTOMER_MESSAGING_BYPASS_MODE=log` is local-only and is rejected
in CI and hosted environments. The bypass records channel and delivery ID only.

The database enforces global ceilings of 60 per minute, 600 per hour and 3,000
per day, plus 500 marketing messages per venue per day. A refused admission is
deferred for one hour. Change limits only through a reviewed migration.

## Local signed webhook proof

Use Node 24 and placeholder local secrets. Never use a production token in a
shell history or evidence file. The signer prints a header and form body for a
local request without contacting Twilio:

```bash
node scripts/dev/twilio-webhook-sign.mjs \
  --url 'http://127.0.0.1:3000/api/twilio/status?delivery_id=00000000-0000-4000-8000-000000000001' \
  --auth-token 'local-fixture-token' \
  --field 'MessageSid=SM11111111111111111111111111111111' \
  --field 'MessageStatus=delivered'
```

Run the unit HTTP fixture and route-boundary tests. They cover valid signatures,
bad signatures, malformed form encoding, unsupported content types, oversized
bodies, exact callback correlation and plaintext exclusion:

```bash
node scripts/ci/node-test-runner.mjs \
  --import ./tests/support/register-alias.mjs \
  --test tests/unit/twilio-webhook-http.test.mjs \
  tests/unit/twilio-routes.test.mjs
```

Database proof must use the disposable local Supabase target and rolled-back
transactions. It must cover duplicate fencing, SID mismatch, monotonic status,
fallback requeue, STOP/START, consent inheritance, erasure and budgets:

```bash
pnpm test:db -- tests/db/customer-messaging-deliveries.test.mjs
```

## Staged activation

1. Deploy the schema and code with mode `off`. Confirm no venue is enabled.
2. Complete provider, Meta template and legal prerequisites.
3. Set `dry_run` for at least one week. Review planned-channel ledger volume,
   consent exclusions, caps and projected cost. No phone request is sent.
4. Set `live` for one venue with transactional messages only. Confirm signed
   callbacks against the delivery ledger and independently confirm a controlled
   recipient journey.
5. Enable marketing only after the consent and STOP journeys pass again.
6. Expand venue by venue. Keep browser push available as the last channel.

To pause, set the mode to `off`; the worker continues existing browser push.
For one venue, set `customer_messaging_enabled=false`. These switches stop new
phone sends and do not erase delivery audit rows. Treat queued events and
provider-accepted messages as already in flight. A rollback does not withdraw
them from Twilio.
