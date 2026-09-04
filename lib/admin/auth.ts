import "server-only"

import { cache } from "react"

import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import type { AdminMfaState } from "@/lib/admin/mfa-gate"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AdminAccess =
  | {
      status: "allowed"
      email: string
      userId: string
      mfaState: AdminMfaState
      /** Authoritative (database-sourced) enrolment state, not the cookie's. */
      mfaEnrolled: boolean
      /** Trusted activation is separate from browser-reachable factor enrolment. */
      mfaActivated: boolean
      /** Exact-factor, post-activation session evidence from the DB boundary. */
      mfaAuthority: boolean
      mfaRequired: boolean
    }
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
    userId: user.id,
    mfaState: "no-factor",
    mfaEnrolled: false,
    mfaActivated: false,
    mfaAuthority: true,
    mfaRequired: false,
  }
})

export async function requireAdminRead() {
  const access = await getAdminAccess()

  if (!isAllowedAdminAccess(access)) {
    throw new Error("Internal admin access is required.")
  }

  return access
}

export async function requireAdminStepUp() {
  // MFA is an explicitly accepted risk for the current product policy. Keep
  // this shared guard so every service-role caller still proves authenticated,
  // active internal-admin membership before receiving elevated data access.
  return requireAdminRead()
}

export async function requireAdminAction() {
  return requireAdminStepUp()
}

export async function canRenderAdminPage(): Promise<boolean> {
  const access = await getAdminAccess()

  return isAllowedAdminAccess(access)
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
