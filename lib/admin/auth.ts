import "server-only"

import { cache } from "react"

import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import {
  type AdminMfaState,
  adminStepUpSatisfied,
  isAdminMfaEnrolled,
  resolveAdminMfaStateFromFacts,
} from "@/lib/admin/mfa-gate"
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

  const [enrolment, activation, authority] = await Promise.all([
    supabase.rpc("viewer_has_verified_mfa_factor"),
    supabase.rpc("viewer_has_activated_admin_mfa"),
    supabase.rpc("is_internal_admin"),
  ])
  const mfaEnrolled = enrolment.data
  const mfaActivated = activation.data
  const mfaAuthority = authority.data

  // An assurance level we cannot read means the session itself is unusable, so
  // there is nothing to step up FROM and no in-console way out. Send the admin
  // back through sign-in, which mints a fresh session: fail-closed, and
  // recoverable without a dead-end card.
  if (
    enrolment.error ||
    typeof mfaEnrolled !== "boolean" ||
    activation.error ||
    typeof mfaActivated !== "boolean" ||
    authority.error ||
    typeof mfaAuthority !== "boolean"
  ) {
    redirect("/login?next=/admin")
  }

  // The grant is server-verified and tied to the live signed Auth session,
  // exact activated credential, origin, RP and activation epoch.
  const mfaState = resolveAdminMfaStateFromFacts(mfaEnrolled, mfaAuthority)
  if (mfaState === "unknown") redirect("/login?next=/admin")

  return {
    status: "allowed",
    email: data.email,
    userId: user.id,
    mfaState,
    mfaEnrolled: isAdminMfaEnrolled(mfaState),
    mfaActivated,
    mfaAuthority,
    mfaRequired: true,
  }
})

export async function requireAdminRead() {
  const access = await getAdminAccess()

  if (!isAllowedAdminAccess(access)) {
    throw new Error("Internal admin access is required.")
  }

  return access
}

/**
 * Admin identity only. Never step-up-gated, because /admin/security must stay
 * reachable for the admin to complete the challenge. Callers that reach real
 * admin data must use requireAdminStepUp (directly or via the service-role
 * factory) instead.
 */
export async function requireAdminStepUp() {
  const access = await requireAdminRead()

  if (!access.mfaAuthority || !adminStepUpSatisfied(access.mfaState)) {
    throw new Error("Two-factor verification is required before this action.")
  }

  return access
}

export async function requireAdminAction() {
  return requireAdminStepUp()
}

export async function canRenderAdminPage(): Promise<boolean> {
  const access = await getAdminAccess()

  // Leaf pages are gated on the step-up too, not just the role: the layout card
  // is presentation, and a direct RSC-payload request for a nested admin
  // segment does not have to render the layout at all.
  return (
    isAllowedAdminAccess(access) &&
    access.mfaAuthority &&
    adminStepUpSatisfied(access.mfaState)
  )
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
