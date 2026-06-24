import "server-only"

import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AdminAccess =
  | { status: "allowed"; email: string; mfaRequired: boolean }
  | { status: "denied"; reason: string }

export async function getAdminAccess(): Promise<AdminAccess> {
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

  const mfaRequired = isAdminMfaRequired()

  if (mfaRequired) {
    const { data: mfa, error: mfaError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

    if (mfaError) {
      throw new Error(`Unable to verify admin MFA: ${mfaError.message}`)
    }

    if (mfa.currentLevel !== "aal2") {
      return {
        status: "denied",
        reason: "Admin MFA verification is required.",
      }
    }
  }

  return {
    status: "allowed",
    email: data.email,
    mfaRequired,
  }
}

export function isAdminMfaRequired(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  configured = process.env.ADMIN_MFA_REQUIRED
) {
  const normalized = configured?.trim().toLowerCase()
  if (nodeEnv === "production") return true
  if (normalized === "true") return true
  if (normalized === "false") return false
  return false
}

export async function requireAdminAction() {
  const access = await getAdminAccess()

  if (access.status !== "allowed") {
    throw new Error("Internal admin access is required.")
  }

  return access
}
