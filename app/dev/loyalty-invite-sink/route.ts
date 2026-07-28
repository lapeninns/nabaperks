import { randomUUID } from "node:crypto"

import { runLoyaltyInviteDrain } from "@/lib/loyalty-invites/delivery-worker"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const HARNESS_HEADER = "x-nabaperks-synthetic-sink"
const HARNESS_VALUE = "loyalty-invite-e2e"

type CapturedDelivery = {
  readonly to: string
  readonly subject: string
  readonly text: string
  readonly idempotencyKey: string
  readonly providerId: string
}

/**
 * Local Playwright-only delivery sink. The production route is inert even if a
 * caller guesses the header; no environment setting can redirect real delivery
 * into this harness. Tests receive rendered text only so they can follow the
 * claim link without contacting Resend.
 */
export async function POST(request: Request): Promise<Response> {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.PLAYWRIGHT_HARNESS !== "1" ||
    request.headers.get(HARNESS_HEADER) !== HARNESS_VALUE
  ) {
    return new Response(null, { status: 404 })
  }

  const deliveries: CapturedDelivery[] = []
  const result = await runLoyaltyInviteDrain({
    maxEmails: 1,
    deliverySink: async ({ to, email, idempotencyKey }) => {
      const providerId = `synthetic-${randomUUID()}`
      deliveries.push({
        to,
        subject: email.subject,
        text: email.text,
        idempotencyKey,
        providerId,
      })
      return { status: 202, providerId }
    },
  })

  return Response.json(
    { ok: result.sent === 1, result, deliveries },
    {
      status: result.sent === 1 ? 200 : 503,
      headers: { "cache-control": "no-store, max-age=0" },
    }
  )
}
