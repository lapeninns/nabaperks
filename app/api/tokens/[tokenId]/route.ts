import { NextResponse } from "next/server"

import { getTokenStatus } from "@/lib/customer/stamp-code"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ tokenId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { tokenId } = await context.params
  const status = await getTokenStatus(tokenId)

  if (!status) {
    return NextResponse.json({ status: "not_found" }, { status: 404 })
  }

  return NextResponse.json(status)
}
