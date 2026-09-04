import { NextRequest, NextResponse } from "next/server"

import { resolveAdminWebAuthnContext } from "@/lib/admin/webauthn-policy"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ allowed: false }, { status: 403 })
  const origin = request.headers.get("origin")
  if (!origin) return response

  try {
    resolveAdminWebAuthnContext(origin)
  } catch {
    return response
  }

  const supabase = createSupabaseRouteHandlerClient(request, response)
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return response

  const { data: allowed, error: eligibilityError } = await supabase.rpc(
    "can_bootstrap_admin_webauthn"
  )
  if (eligibilityError || allowed !== true) return response

  return NextResponse.json({ allowed: true })
}
