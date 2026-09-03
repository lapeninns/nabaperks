"use server"

import { revalidatePath } from "next/cache"

import { requireAdminRead } from "@/lib/admin/auth"
import {
  adminMfaEnrollmentAllowed,
  adminMfaUnenrollmentAllowed,
} from "@/lib/admin/mfa-gate"
import { createSupabaseServerClient } from "@/lib/supabase/server"

export type AdminMfaFormState = { ok: boolean; error: string | null }

const ENROLLMENT_BLOCKED =
  "Verify with your existing passkey or security key before adding another one."

/** Authorise the browser ceremony before it can mint a WebAuthn factor. */
export async function authorizeAdminMfaEnrollment(): Promise<AdminMfaFormState> {
  const access = await requireAdminRead()
  if (!adminMfaEnrollmentAllowed(access.mfaState)) {
    return { ok: false, error: ENROLLMENT_BLOCKED }
  }
  return { ok: true, error: null }
}

/** Remove an enrolled authenticator (returns the admin to no-factor). */
export async function unenrollAdminMfa(
  _prev: AdminMfaFormState,
  formData: FormData
): Promise<AdminMfaFormState> {
  const access = await requireAdminRead()
  if (!adminMfaUnenrollmentAllowed(access.mfaState)) {
    return {
      ok: false,
      error:
        "Verify with your passkey or security key before turning off two-factor authentication.",
    }
  }

  const factorId = String(formData.get("factorId") ?? "")
  if (!factorId) return { ok: false, error: "Missing security-key factor." }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) {
    return { ok: false, error: error.message }
  }

  // The database factor-lifecycle trigger records the deletion atomically and
  // invalidates any trusted binding in the same Auth transaction.
  revalidatePath("/admin")
  revalidatePath("/admin/audit")

  return { ok: true, error: null }
}
