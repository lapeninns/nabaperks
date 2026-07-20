import "server-only"

import { cache } from "react"

import { redirect } from "next/navigation"

import { getCurrentUser } from "@/lib/auth/session"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AdminGate =
  | { readonly status: "anonymous" }
  | { readonly status: "denied"; readonly reason: string }
  | { readonly status: "mfa_required"; readonly email: string }
  | {
      readonly status: "allowed"
      readonly email: string
      readonly mfaRequired: boolean
    }

export type AdminAccess =
  | { status: "allowed"; email: string; mfaRequired: boolean }
  | { status: "denied"; reason: string }

type AllowedAdminAccess = Extract<AdminAccess, { status: "allowed" }>

export const getAdminGate = cache(async (): Promise<AdminGate> => {
  const user = await getCurrentUser()
  if (!user) {
    return { status: "anonymous" }
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
      return { status: "mfa_required", email: data.email }
    }
  }

  return {
    status: "allowed",
    email: data.email,
    mfaRequired,
  }
})

export const getAdminAccess = cache(async (): Promise<AdminAccess> => {
  const gate = await getAdminGate()

  if (gate.status === "anonymous") {
    redirect("/login?next=/admin")
  }

  if (gate.status === "denied") {
    return { status: "denied", reason: gate.reason }
  }

  if (gate.status === "mfa_required") {
    return {
      status: "denied",
      reason: "Admin MFA verification is required.",
    }
  }

  return {
    status: "allowed",
    email: gate.email,
    mfaRequired: gate.mfaRequired,
  }
})

export function isAdminMfaRequired() {
  return true
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
