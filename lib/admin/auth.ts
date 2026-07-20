import "server-only"

import { cache } from "react"

import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AdminAccess =
  | { status: "allowed"; email: string; mfaRequired: boolean }
  | { status: "denied"; reason: string }

type AllowedAdminAccess = Extract<AdminAccess, { status: "allowed" }>

// Memoized per request: the admin layout, page guard, and every
// service-role read (`requireAdminRead`) resolve admin access independently,
// which otherwise repeats the `internal_admins` SELECT ~7x per admin page.
export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login?next=/admin")
  }

  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from("internal_admins")
    .select("email, is_active")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    throw new Error(`Unable to verify admin access: ${error.message}`)
  }

  if (!data?.is_active) {
    return { status: "denied", reason: "Internal admin access is required." }
  }

  return {
    status: "allowed",
    email: data.email,
    // Authenticator MFA is not required — admin signs in with email + password
    // (and email OTP for signup/reset). Kept on the type for shell display.
    mfaRequired: false,
  }
})

export function isAdminMfaRequired() {
  return false
}

export async function requireAdminRead() {
  const access = await getAdminAccess()

  if (!isAllowedAdminAccess(access)) {
    throw new Error("Internal admin access is required.")
  }

  return access
}

export async function requireAdminAction() {
  return requireAdminRead()
}

export async function canRenderAdminPage(): Promise<boolean> {
  return isAllowedAdminAccess(await getAdminAccess())
}

function isAllowedAdminAccess(
  access: AdminAccess
): access is AllowedAdminAccess {
  switch (access.status) {
    case "allowed":
      return true
    case "denied":
      return false
    default:
      return assertNeverAdminAccess(access)
  }
}

function assertNeverAdminAccess(value: never): never {
  throw new Error(`Unknown admin access status: ${JSON.stringify(value)}`)
}
