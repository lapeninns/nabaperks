# Nabaperks operational API

Generated from `docs/api/openapi.json` by `pnpm docs:generate`. Do not edit this table by hand.

Externally consumed liveness and protected readiness contracts. Product-internal Server Actions are not HTTP APIs and are intentionally out of scope.

| Method | Path                                    | Summary                                                | Source                                              |
| ------ | --------------------------------------- | ------------------------------------------------------ | --------------------------------------------------- |
| GET    | `/api/cron/qr-status-email-drain`       | Drain Venue QR status confirmation emails              | `app/api/cron/qr-status-email-drain/route.ts`       |
| GET    | `/api/email/unsubscribe/claim/{token}`  | Open unsubscribe confirmation page                     | `app/api/email/unsubscribe/claim/[token]/route.ts`  |
| POST   | `/api/email/unsubscribe/claim/{token}`  | Suppress future venue invite email                     | `app/api/email/unsubscribe/claim/[token]/route.ts`  |
| GET    | `/api/email/unsubscribe/invite/{token}` | Open unsubscribe confirmation page                     | `app/api/email/unsubscribe/invite/[token]/route.ts` |
| POST   | `/api/email/unsubscribe/invite/{token}` | Suppress future venue invite email                     | `app/api/email/unsubscribe/invite/[token]/route.ts` |
| GET    | `/api/health`                           | Read public service liveness                           | `app/api/health/route.ts`                           |
| GET    | `/api/readiness`                        | Read protected dependency readiness                    | `app/api/readiness/route.ts`                        |
| POST   | `/api/resend/webhook`                   | Receive Resend delivery events for loyalty invitations | `app/api/resend/webhook/route.ts`                   |

The protected readiness endpoint requires `Authorization: Bearer <PRODUCTION_MONITOR_SECRET>`. During a documented zero-downtime rotation, the temporary `PRODUCTION_MONITOR_SECRET_NEXT` is also accepted until cutover completes.
