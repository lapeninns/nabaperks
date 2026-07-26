import "server-only"

import { cache } from "react"

import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import {
  type AdminMfaState,
  isAdminMfaEnrolled,
  resolveAdminMfaState,
} from "@/lib/admin/mfa-gate"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AdminAccess =
  | {
      status: "allowed"
      email: string
      userId: string
      mfaState: AdminMfaState
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

  // MFA is enforced at the app layer only (never re-add the DB AAL2 check —
  // see lib/admin/mfa-gate.ts). Passing the access token makes Supabase verify
  // the user and factor list with Auth instead of trusting session.user from
  // the cookie-backed storage object. Resolve the assurance level; any failure
  // fails OPEN to "no-factor" so a transient auth error can never lock an admin
  // out.
  let mfaState: AdminMfaState = "no-factor"
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    if (sessionError || !session?.access_token) {
      throw new Error("Unable to verify the admin session assurance level.")
    }
    const { data: aal, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel(
        session.access_token
      )
    if (assuranceError) {
      throw assuranceError
    }
    mfaState = resolveAdminMfaState(aal?.currentLevel, aal?.nextLevel)
  } catch {
    mfaState = "no-factor"
  }

  return {
    status: "allowed",
    email: data.email,
    userId: user.id,
    mfaState,
    mfaRequired: isAdminMfaEnrolled(mfaState),
  }
})

export async function requireAdminRead() {
  const access = await getAdminAccess()

  if (!isAllowedAdminAccess(access)) {
    throw new Error("Internal admin access is required.")
  }

  return access
}

export async function requireAdminAction() {
  const access = await requireAdminRead()

  // Defense-in-depth for direct action calls: an enrolled admin who has not
  // completed the step-up challenge cannot mutate. The layout already blocks the
  // UI in this state, and the MFA enrol/step-up actions use requireAdminRead (not
  // this), so this never bites the legitimate step-up path. Fails open because
  // getAdminAccess resolves an unknown assurance level to "no-factor".
  if (access.mfaState === "step-up-required") {
    throw new Error("Two-factor verification is required before this action.")
  }

  return access
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
