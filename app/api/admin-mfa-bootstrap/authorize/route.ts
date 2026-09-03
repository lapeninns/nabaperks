import { NextRequest, NextResponse } from "next/server"

import { resolveAdminWebAuthnContext } from "@/lib/admin/webauthn-policy"
import {
  createSupabaseRouteHandlerClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server"

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

  const serviceRole = createSupabaseServiceRoleClient()
  const [{ data: admin }, { data: authUser, error: authUserError }] =
    await Promise.all([
      serviceRole
        .from("internal_admins")
        .select("is_active")
        .eq("user_id", data.user.id)
        .maybeSingle(),
      serviceRole.auth.admin.getUserById(data.user.id),
    ])

  const verifiedFactors = authUser.user?.factors?.filter(
    (factor) => factor.status === "verified"
  )
  if (
    authUserError ||
    admin?.is_active !== true ||
    !verifiedFactors ||
    verifiedFactors.length !== 0
  ) {
    return response
  }

  return NextResponse.json({ allowed: true })
}
