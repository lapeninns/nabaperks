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
    .select(
      "id, business_name, business_slug, business_type, email, status, requires_billing"
    )
    .eq("owner_user_id", user.id)
    .limit(2)

  if (error) {
    throw new Error(`Unable to load merchant profile: ${error.message}`)
  }

  if (!data.length) return null

  if (data.length > 1) {
    throw new Error("Unable to load merchant profile: multiple profiles found")
  }

  return data[0] ?? null
})
