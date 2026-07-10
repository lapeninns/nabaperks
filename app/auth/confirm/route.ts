import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { merchantLoginHref } from "@/lib/navigation/merchant-auth-hrefs"
import { safeMerchantNextPath } from "@/lib/navigation/safe-next-path"
import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server"

const DEFAULT_CONFIRM_NEXT = "/app/onboarding"

function safeNextPath(next: string | null, origin: string) {
  if (!next) {
    return DEFAULT_CONFIRM_NEXT
  }

  try {
    const url = new URL(next, origin)

    if (url.origin !== origin) {
      return DEFAULT_CONFIRM_NEXT
    }

    return safeMerchantNextPath(
      `${url.pathname}${url.search}${url.hash}`,
      DEFAULT_CONFIRM_NEXT
    )
  } catch {
    return DEFAULT_CONFIRM_NEXT
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeNextPath(searchParams.get("next"), origin)

  const successRedirect = NextResponse.redirect(new URL(next, origin))
  const supabase = createSupabaseRouteHandlerClient(request, successRedirect)

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return successRedirect
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    })

    if (!error) {
      return successRedirect
    }
  }

  return NextResponse.redirect(
    new URL(merchantLoginHref({ error: "verification", next }), origin)
  )
}
