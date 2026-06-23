import { NextResponse, type NextRequest } from "next/server"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { getCustomerNotificationReadback } from "@/lib/notifications/readback"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const customer = await getCurrentCustomer()
  if (!customer) return json({ error: "unauthenticated" }, 401)

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? 50)
  const notifications = await getCustomerNotificationReadback({
    customerId: customer.id,
    limit: Number.isFinite(limit) ? limit : 50,
  })

  return json({ ok: true, notifications }, 200)
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "cache-control": "no-store, max-age=0" },
  })
}
