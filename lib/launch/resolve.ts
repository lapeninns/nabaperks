import "server-only"

import { getCurrentUser } from "@/lib/auth/session"
import { getCustomerSession } from "@/lib/customer/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type LaunchDestination = "/admin" | "/app" | "/home"

/**
 * Resolves where an installed-app launch should land based on whichever session
 * is present. Staff (Supabase auth) take precedence over the customer cookie: a
 * Supabase session is a deliberate sign-in, while the customer cookie is set by
 * a casual phone OTP. Returns null for anonymous launches so the caller can show
 * the dual-door chooser. Each destination re-gates itself, so this is only a
 * dispatcher — never the security boundary.
 */
export async function resolveLaunchDestination(): Promise<LaunchDestination | null> {
  const user = await getCurrentUser()

  if (user) {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from("internal_admins")
      .select("is_active")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error) {
      throw new Error(`Unable to resolve launch destination: ${error.message}`)
    }

    return data?.is_active ? "/admin" : "/app"
  }

  const customer = await getCustomerSession()

  if (customer) {
    return "/home"
  }

  return null
}
