import "server-only"

import { cache } from "react"

import { createSupabaseServerClient } from "@/lib/supabase/server"

export const getCurrentUser = cache(async () => {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) return null

  return user
})

export const getCurrentMerchant = cache(async () => {
  const user = await getCurrentUser()

  if (!user) return null

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("merchants")
    .select("id, business_name, business_slug, business_type, email, status")
    .eq("owner_user_id", user.id)
    .maybeSingle()

  // Distinguish a real lookup failure from a genuine "no merchant" result.
  // A transient Supabase error must propagate so the route's error.tsx can
  // offer a retry; it must NOT be swallowed into `null`, which callers treat
  // as "not onboarded" and use to redirect to /app/onboarding. Only the
  // genuine no-row case (no error, no data) returns null.
  if (error) {
    throw new Error(`Unable to load merchant profile: ${error.message}`)
  }

  return data ?? null
})
