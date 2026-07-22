# Nabaperks operational API

Generated from `docs/api/openapi.json` by `pnpm docs:generate`. Do not edit this table by hand.

Externally consumed liveness and protected readiness contracts. Product-internal Server Actions are not HTTP APIs and are intentionally out of scope.

| Method | Path                  | Summary                                                | Source                            |
| ------ | --------------------- | ------------------------------------------------------ | --------------------------------- |
| GET    | `/api/health`         | Read public service liveness                           | `app/api/health/route.ts`         |
| GET    | `/api/readiness`      | Read protected dependency readiness                    | `app/api/readiness/route.ts`      |
| POST   | `/api/resend/webhook` | Receive Resend delivery events for loyalty invitations | `app/api/resend/webhook/route.ts` |

The protected readiness endpoint requires `Authorization: Bearer <PRODUCTION_MONITOR_SECRET>`.
