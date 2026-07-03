import { createServerClient } from "@supabase/ssr"
import type { NextRequest, NextResponse } from "next/server"

import { getPublicEnv } from "@/lib/env/public"

/**
 * Refreshes the Supabase auth session on the edge before Server Components run.
 * Without this, token rotation cannot write cookies back from RSC/actions and
 * merchants appear randomly logged out.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  createResponse: () => NextResponse
): Promise<NextResponse> {
  const env = getPublicEnv()
  let response = createResponse()

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          response = createResponse()
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  await supabase.auth.getUser()

  return response
}
