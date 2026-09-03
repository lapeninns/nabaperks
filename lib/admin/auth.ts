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

  const mfaState = await resolveAssuranceState(supabase)
  const { data: mfaActivated, error: activationError } = await supabase.rpc(
    "viewer_has_activated_admin_mfa"
  )
  const { data: mfaAuthority, error: authorityError } =
    await supabase.rpc("is_internal_admin")

  // An assurance level we cannot read means the session itself is unusable, so
  // there is nothing to step up FROM and no in-console way out. Send the admin
  // back through sign-in, which mints a fresh session: fail-closed, and
  // recoverable without a dead-end card.
  if (mfaState === "unknown") {
    redirect("/login?next=/admin")
  }
  if (
    activationError ||
    typeof mfaActivated !== "boolean" ||
    authorityError ||
    typeof mfaAuthority !== "boolean"
  ) {
    redirect("/login?next=/admin")
  }

  // A token challenged before trusted activation (or for a replaced factor)
  // can still carry `aal2`. The database correlates the signed token with the
  // authoritative Auth session and activation epoch; make the app present a
  // fresh step-up instead of treating that stale claim as authority.
  const effectiveMfaState =
    mfaState === "satisfied" && !mfaAuthority ? "step-up-required" : mfaState

  return {
    status: "allowed",
    email: data.email,
    userId: user.id,
    mfaState: effectiveMfaState,
    mfaEnrolled: isAdminMfaEnrolled(mfaState),
    mfaActivated,
    mfaAuthority,
    mfaRequired: true,
  }
})

/**
 * Enrolment comes from the database and the current level from the signed JWT.
 * Neither may come from `getAuthenticatorAssuranceLevel().nextLevel`, which
 * supabase-js computes from the cached session cookie's factor list — stale for
 * any session minted before the factor was enrolled.
 *
 * Note `getAuthenticatorAssuranceLevel` reports failure by RETURNING
 * `{ data: null, error }`; it does not throw. Both shapes must be handled or
 * the gate silently degrades to "no factor" and lets everything through.
 */
async function resolveAssuranceState(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<AdminMfaState> {
  let hasVerifiedFactor: boolean | null = null
  let currentLevel: string | null = null

  try {
    const { data: enrolled, error: enrolledError } = await supabase.rpc(
      "viewer_has_verified_mfa_factor"
    )
    if (!enrolledError && typeof enrolled === "boolean") {
      hasVerifiedFactor = enrolled
    }

    const { data: aal, error: aalError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (!aalError && aal) {
      currentLevel = aal.currentLevel ?? null
    }
  } catch {
    return "unknown"
  }

  return resolveAdminMfaStateFromFacts(hasVerifiedFactor, currentLevel)
}

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
