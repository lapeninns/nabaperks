import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

import { clearCustomerSession } from "@/lib/customer/session"
import {
  customerLoginHref,
  safeNextPath,
} from "@/lib/navigation/safe-next-path"

export async function GET(request: NextRequest): Promise<NextResponse> {
  const next = safeNextPath(request.nextUrl.searchParams.get("next") ?? "/home")

  await clearCustomerSession()

  return NextResponse.redirect(new URL(customerLoginHref(next), request.url))
}
