import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"

import { createSupabaseRouteHandlerClient } from "@/lib/supabase/server"

function safeNextPath(next: string | null, origin: string) {
  if (!next) {
    return "/app/onboarding"
  }

  try {
    const url = new URL(next, origin)

    if (url.origin !== origin) {
      return "/app/onboarding"
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return "/app/onboarding"
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

  return NextResponse.redirect(new URL("/login?error=verification", origin))
}
