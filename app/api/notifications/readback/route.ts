import { type NextRequest } from "next/server"

import { getCurrentCustomer } from "@/lib/customer/identity"
import { noStoreJson as json } from "@/lib/http/no-store-json"
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
