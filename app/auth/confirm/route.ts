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

/**
 * Merchant auth callback. Only the PKCE code exchange may install a session.
 *
 * `exchangeCodeForSession` fails unless this browser still holds the
 * code-verifier cookie written when it started the flow, so the credential can
 * only authenticate the browser that asked for it.
 *
 * A bare Supabase email token hash is deliberately not redeemed here. It is a
 * bearer proof with no browser binding, so anyone holding one for an account
 * they control could sign an unrelated browser into that account — a login CSRF
 * / session swap. No Nabaperks flow issues such a link: merchant signup and
 * recovery deliver a six-digit alias through the send-email hook and check it in
 * a server action. Restoring direct email links needs a server-side transaction
 * row bound to an HttpOnly nonce cookie in the initiating browser, not a bearer
 * parameter on this GET.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = safeNextPath(searchParams.get("next"), origin)

  const successRedirect = NextResponse.redirect(new URL(next, origin))
  const supabase = createSupabaseRouteHandlerClient(request, successRedirect)

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return successRedirect
    }
  }

  return NextResponse.redirect(
    new URL(merchantLoginHref({ error: "verification", next }), origin)
  )
}
