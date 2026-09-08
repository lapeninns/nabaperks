# Email deliverability handoff — nabaperks.com

**Date:** 2026-09-08 · **Status:** ready to implement · **Owner:** unassigned
**Symptom:** most Nabaperks emails (OTP codes, loyalty/reward invites, digests) land in recipients' spam.

## 1. Diagnosis (verified, do not re-derive)

Authentication is **not** the problem. A real delivery to Gmail on 2026-09-05 carried:

```
dkim=pass header.i=@nabaperks.com header.s=resend
spf=pass  smtp.mailfrom=...@send.nabaperks.com (54.240.3.12)
dmarc=pass (p=NONE sp=NONE dis=NONE) header.from=nabaperks.com
```

Resend reports every recent send as `delivered`. Supabase auth mail goes through the
Send Email hook (`app/api/auth/hooks/send-email/route.ts`) and out via Resend, so nothing
leaves from Supabase's shared sender. Mailboxes accept the mail and then classify it as
spam on reputation and hygiene signals:

| Signal              | Current state                                                             | Why it hurts                                                                         |
| ------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Apex MX             | none                                                                      | From-domain cannot receive mail; strong spam heuristic (Microsoft, Yahoo especially) |
| Apex SPF            | none (only `send.nabaperks.com` has `v=spf1 include:amazonses.com ~all`)  | Some filters score a From-domain with no SPF at all                                  |
| DMARC               | `v=DMARC1; p=none; pct=100`, no `rua=`                                    | Weakest policy, less trust, zero visibility                                          |
| Domain age / volume | added to Resend 2026-06-28, trickle volume, shared SES IPs (eu-west-1)    | No reputation history; judged on content alone                                       |
| Reply-To            | `reply_to: null` on every send                                            | Unreplyable sender from an unmonitored `login@` address                              |
| List-Unsubscribe    | header absent on invites/digest (body link only)                          | Gmail/Yahoo expect RFC 8058 headers on anything non-transactional                    |
| OTP bursts          | 5 × "NNNNNN is your Nabaperks code" between 13:55–13:58 UTC on 2026-09-08 | Near-identical subjects in quick succession look like a flood                        |
| Sender mix          | OTP, invites and digests all from `Nabaperks <login@nabaperks.com>`       | One invite complaint hurts OTP delivery                                              |

Compare `notifications.nabatable.com` (same Resend account, `p=quarantine` + `rua=`),
whose mail is landing fine.

**Caveat:** production `RESEND_FROM` on Vercel could not be read from the sandbox. The Resend
log shows `Nabaperks <login@nabaperks.com>` for all nabaperks sends, so that is the assumed
production value. Confirm in Vercel → Settings → Environment Variables before starting.

## 2. Workstreams

### A. DNS (Cloudflare, zone `nabaperks.com`) — do first, no code risk

Existing records to **keep**: `resend._domainkey` TXT (DKIM), `send` MX → `feedback-smtp.eu-west-1.amazonses.com` (10), `send` TXT SPF.

| #   | Record                                                             | Name                | Value                                                                                                   | Notes                                                                                                                |
| --- | ------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| A1  | Enable **Cloudflare Email Routing**                                | —                   | forward `dmarc@`, `support@`, `login@`, `unsubscribe@` → the ops Gmail                                  | Cloudflare auto-adds the apex MX records (`route1/2/3.mx.cloudflare.net`) and an SPF record; merge SPF per A2        |
| A2  | TXT                                                                | `@`                 | `v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all`                                      | Replace whatever Cloudflare auto-inserts so both includes are present                                                |
| A3  | TXT                                                                | `_dmarc`            | `v=DMARC1; p=quarantine; sp=quarantine; pct=100; rua=mailto:dmarc@nabaperks.com; adkim=r; aspf=r; fo=1` | Mirrors nabatable. Safe to go straight to `quarantine`: DMARC already passes and nothing else sends as nabaperks.com |
| A4  | Resend → Domains → **Add `mail.nabaperks.com`** (region eu-west-1) | as issued by Resend | DKIM TXT `resend._domainkey.mail`, MX + TXT on `send.mail`                                              | Marketing/invite subdomain (workstream B4). Add its own `_dmarc.mail` TXT identical to A3                            |
| A5  | Google Postmaster Tools verification TXT                           | `@`                 | as issued                                                                                               | Workstream C                                                                                                         |

Verify from a shell (**note:** `dig` inside the Claude sandbox silently drops TXT answers; use DoH):

```bash
for q in "nabaperks.com&type=MX" "nabaperks.com&type=TXT" "_dmarc.nabaperks.com&type=TXT" "resend._domainkey.mail.nabaperks.com&type=TXT"; do echo "== $q"; curl -s "https://dns.google/resolve?name=$q" | python3 -c 'import sys,json; [print(a["data"]) for a in json.load(sys.stdin).get("Answer",[])]'; done
```

### B. Code (one PR, `lib/notifications` + unsubscribe routes + env contract)

**B1. Extend the payload builder** — `lib/notifications/transactional-email-payload.ts`

- Add optional `replyTo?: string` and `headers?: Readonly<Record<string, string>>` to `TransactionalEmailInput`.
- Emit Resend fields `reply_to` and `headers` only when set (keep the existing shape otherwise so `tests/unit/transactional-email-payload.test.mjs` still passes; extend that test for the new fields).

**B2. Reply-To on every send** — `lib/notifications/resend.ts`

- New optional env `RESEND_REPLY_TO` (e.g. `Nabaperks <support@nabaperks.com>`); `readEmailOtpConfig()` returns it; `sendTransactionalEmail` passes it as `replyTo`.
- Register the var in `config/env-contract.json`, `.env.example`, and `config/vercel-governance-contract.json`; `tests/contracts/env-contract-example-parity.test.mjs` and `tests/contracts/vercel-env-sync-target.test.mjs` enforce parity.

**B3. RFC 8058 one-click unsubscribe for invites**

- Add route handlers (page routes with server actions cannot take a raw mailbox-provider POST):
  - `app/api/email/unsubscribe/invite/[token]/route.ts` → `POST` calls `suppress_loyalty_invite_email(p_unsubscribe_token_hash)` exactly as `app/invite/unsubscribe/[token]/actions.ts` does (hash via `hashInviteToken`); `GET` redirects to the existing page. Return 200 with no body on POST; never 30x.
  - `app/api/email/unsubscribe/claim/[token]/route.ts` → same pattern using the RPC in `app/claim/unsubscribe/[token]/actions.ts` (sha256 of token).
  - Both must be unauthenticated, idempotent, and rate-limited with the existing `lib/security/rate-limit` helpers.
- Set headers on the two invite sends:
  ```
  List-Unsubscribe: <https://nabaperks.com/api/email/unsubscribe/invite/{token}>, <mailto:unsubscribe@nabaperks.com?subject=invite-{token}>
  List-Unsubscribe-Post: List-Unsubscribe=One-Click
  ```
  - Loyalty invites: `lib/loyalty-invites/delivery-worker.ts` posts to Resend with its own `fetch` at ~line 215 and its own body. Switch it to `buildTransactionalEmailPayload(...)` so headers/reply-to are applied in one place; keep its status/providerId handling.
  - Reward invites: `app/app/customers/send-reward/actions.ts` (builds `unsubscribeUrl` at ~line 226) → pass `headers` into `sendTransactionalEmail`.
  - Merchant weekly digest (`lib/notifications/merchant-digest.ts`): add the same headers pointing at the digest opt-out (check `tests/contracts/merchant-weekly-digest.test.mjs` for the existing opt-out surface). Optional but recommended.
  - Do **not** add unsubscribe headers to OTP mail.
- Tests: contract test that both API routes suppress on POST and are a no-op on repeat; unit test that the invite payloads carry both headers; extend `tests/contracts/loyalty-invites.test.mjs`.

**B4. Split invites onto the marketing subdomain**

- New optional env `RESEND_MARKETING_FROM` (e.g. `Nabaperks <hello@mail.nabaperks.com>`), same contract/parity plumbing as B2.
- Loyalty invites, reward invites and the digest use it when set, else fall back to `RESEND_FROM`. OTP mail always uses `RESEND_FROM`.
- Ship only after A4 shows `verified` in Resend.

**B5. OTP burst investigation** (may be a no-op)

- Pull the last 100 sends and group by recipient:
  ```bash
  curl -s -H "Authorization: Bearer $RESEND_API_KEY" "https://api.resend.com/emails?limit=100" | python3 -c 'import sys,json,collections; c=collections.Counter(); [c.update([tuple(r["to"])]) for r in json.load(sys.stdin)["data"] if "nabaperks.com" in r["from"]]; print(c.most_common(10))'
  ```
- If the same recipient gets several codes within a minute: merchant OTP already has a 60 s cooldown (`MERCHANT_OTP_RESEND_COOLDOWN_MS` in `lib/auth/merchant-otp-resend.ts`); check the customer email-OTP path and the auth-hook retry/idempotency (`lib/auth/auth-hook-delivery.ts`, `authHookEmailIdempotencyKey`) for double sends. If they are distinct recipients from QA runs, close as no-op and route test traffic to a Resend test address.

### C. Monitoring

| #   | Item                                                                   | Where                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Google Postmaster Tools for `nabaperks.com` (and `mail.nabaperks.com`) | postmaster.google.com, verify via A5                                                                                                                                                                                               |
| C2  | DMARC aggregate reports                                                | `dmarc@nabaperks.com` → routed by A1; optionally feed to a free DMARC aggregator                                                                                                                                                   |
| C3  | Complaint visibility                                                   | `app/api/resend/webhook/route.ts` already ingests `complained`/`bounced`; surface a weekly count (log line or admin tile) and suppress complained addresses from invites                                                           |
| C4  | Post-change check                                                      | send one of each email type to a Gmail, an Outlook.com and a Yahoo test account; confirm inbox placement and that raw headers show `List-Unsubscribe` and `Reply-To`; run one message through mail-tester.com and record the score |

## 3. Order of operations

1. A1–A3, A5 (DNS) → verify with the DoH loop → wait 24 h and confirm Postmaster shows data.
2. PR 1: B1 + B2 + B3 + B5 findings. Merge via the usual Codex-thread gate and local-CI check-runs.
3. A4 (subdomain in Resend) → wait for `verified` → PR 2: B4 + set `RESEND_MARKETING_FROM` in Vercel prod/preview.
4. C4 end-to-end check; record results at the bottom of this doc.

## 4. Definition of done

- DoH loop returns apex MX, apex SPF with both includes, and `_dmarc` with `p=quarantine` + `rua`.
- Gmail raw headers on a fresh OTP show `Reply-To`; on a fresh invite show `Reply-To`, `List-Unsubscribe`, `List-Unsubscribe-Post`, and `header.from=mail.nabaperks.com`.
- Gmail's native "Unsubscribe" affordance on an invite suppresses the address (confirmed via the RPC's table) without loading the page.
- Env contract, `.env.example` and Vercel governance contract list `RESEND_REPLY_TO` and `RESEND_MARKETING_FROM`; parity tests green.
- Postmaster Tools shows the domain with a reputation reading after 7 days.

## 5. Out of scope

- Dedicated Resend IP (not justified at current volume).
- BIMI / VMC.
- Changing OTP copy or template design.

## 6. Results log

_(append: date · change · inbox placement observed · mail-tester score)_

### 2026-09-08 implementation evidence

- **DNS (Google DoH, 15:57 BST):** apex MX now resolves to Cloudflare's
  route1/2/3 hosts. Apex SPF contains both `_spf.mx.cloudflare.net` and
  `amazonses.com`. Apex and marketing-subdomain DMARC use the quarantine policy
  specified above, reporting to `dmarc@nabaperks.com`. Existing apex Resend DKIM
  and `send` MX/SPF were preserved.
- **Inbound routing:** the operator selected `info@lapeninns.com` instead of
  the originally unspecified ops Gmail. Cloudflare shows this destination as
  Verified. Four active rules route `dmarc`, `support`, `login`, and
  `unsubscribe` at nabaperks.com to that destination. Mailto unsubscribe
  requests arrive in this mailbox for manual handling; the HTTP one-click
  route performs suppression automatically after deployment.
- **Resend A4:** `mail.nabaperks.com`, domain ID
  `daaff84d-d654-45c9-b455-f9aad6e89feb`, added in eu-west-1. Provider readback
  reports the domain and all three issued DKIM/MX/SPF records **verified**.
- **Vercel settings:** `RESEND_REPLY_TO=Nabaperks <support@nabaperks.com>` and
  `RESEND_MARKETING_FROM=Nabaperks <hello@mail.nabaperks.com>` were created for
  production and preview, with successful name/scope readback. They take effect
  only in new deployments containing the corresponding implementation.
  `RESEND_FROM` is a sensitive production variable: Vercel readback omits its
  value. Recent Resend sends confirm the observed sender is
  `Nabaperks <login@nabaperks.com>`; the actual Vercel value remains unreadable.
- **B1/B2/B3:** optional Reply-To/custom-header payload plumbing, invite-only
  RFC 8058 headers, anonymous rate-limited POST endpoints, and GET confirmation
  redirects are implemented. Database errors return 503, rate limits 429, and
  successful/unknown/repeated token requests return empty 200 responses. Proxy
  session refresh is bypassed for these endpoints. Only independent unsubscribe
  tokens are accepted; claim capabilities remain separate.
- **B5:** the last-100-send sample included the five reported customer OTP sends
  between 13:55:40 and 13:58:07 UTC. They involved **two recipients** with distinct
  codes, including same-recipient gaps of **3.528 s** and **34.922 s**. Customer
  recovery and profile email verification had 3-per-15-minute and daily limits
  but no one-minute spacing. A shared, normalised-recipient 60-second cooldown
  now runs before either path replaces pending state or sends another code.
  These are confirmed code-path gaps; the provider sample alone does not prove
  which UI action caused each send or whether these recipients were QA users.
  The auth hook retains its existing delivery lease, attempt fencing and stable
  Resend idempotency key. Shared fetch defaults to zero retries, so no evidence
  supports changing its retry behaviour.
- **C3:** the existing Monday digest job logs new global complaint/bounce
  suppression counts over the preceding seven days. These are deduplicated
  suppression rows, **not all provider webhook events**. First-recorded reasons
  are retained by the existing database, and non-loyalty messages are outside
  this webhook's current provider-ID mapping. Reward invite sending also checks
  the existing global loyalty suppression list and fails closed on read errors.
- **Digest one-click opt-out:** deferred. The current worker and its cited
  contract test have no token-based digest opt-out surface. Advertising one-click
  behaviour without an actual endpoint would be misleading.
- **Verification:** focused route/payload/cooldown tests pass. Local Supabase
  transaction tests pass, including repeated loyalty suppression, venue scoping,
  rejection of claim tokens, and existing reward unsubscribe purpose binding.
  Local production build passes with synthetic configuration; the first attempt
  using only `.env.example` failed because required fixture values were absent.
- **Still pending:** protected PR review/CI and deployment, Google Postmaster DNS
  verification (domain is added but unverified), reputation data after seven
  days, raw Gmail DKIM coverage of both unsubscribe headers, Gmail native
  unsubscribe plus production suppression readback, Gmail/Outlook/Yahoo inbox
  placement, and a mail-tester score. No inbox-placement or mail-tester result
  is claimed. Google may withhold reputation data at low sending volumes.

Protocol references: [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058),
[Resend email fields](https://resend.com/docs/api-reference/emails/send-email),
[Google Postmaster setup](https://support.google.com/mail/answer/9981691).
