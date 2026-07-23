"use server"

import { revalidatePath } from "next/cache"

import { requireAdminRead } from "@/lib/admin/auth"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Admin authenticator (TOTP) enrol / step-up server actions.
 *
 * All gate on requireAdminRead (an active internal admin) — NOT
 * requireAdminAction, because that refuses when step-up is required and the
 * whole point of step-up is to reach aal2 from aal1. MFA is enforced at the app
 * layer only (lib/admin/mfa-gate.ts); these actions never touch the DB gate.
 */

export type AdminMfaEnrollment =
  | { ok: true; factorId: string; qrCodeSvg: string; secret: string }
  | { ok: false; error: string }

export type AdminMfaFormState = { ok: boolean; error: string | null }

const OTP_CODE = /^\d{6}$/

function readCode(formData: FormData): string {
  return String(formData.get("code") ?? "").replace(/\s+/g, "")
}

/** Start enrolment: mint a new unverified TOTP factor and return its QR + secret. */
export async function beginAdminMfaEnrollment(): Promise<AdminMfaEnrollment> {
  await requireAdminRead()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `admin-totp-${Date.now()}`,
  })

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Could not start enrolment." }
  }

  return {
    ok: true,
    factorId: data.id,
    qrCodeSvg: data.totp.qr_code,
    secret: data.totp.secret,
  }
}

async function challengeAndVerify(
  factorId: string,
  code: string
): Promise<AdminMfaFormState> {
  if (!factorId) return { ok: false, error: "Missing authenticator factor." }
  if (!OTP_CODE.test(code)) {
    return {
      ok: false,
      error: "Enter the 6-digit code from your authenticator app.",
    }
  }

  const supabase = await createSupabaseServerClient()
  const challenge = await supabase.auth.mfa.challenge({ factorId })
  if (challenge.error || !challenge.data) {
    return {
      ok: false,
      error: challenge.error?.message ?? "Could not start the challenge.",
    }
  }

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  })
  if (verify.error) {
    return {
      ok: false,
      error: "That code was not accepted. Try the current code.",
    }
  }

  revalidatePath("/admin")
  return { ok: true, error: null }
}

/** Confirm a freshly enrolled factor (client passes the pending factorId). */
export async function verifyAdminMfaEnrollment(
  _prev: AdminMfaFormState,
  formData: FormData
): Promise<AdminMfaFormState> {
  await requireAdminRead()
  return challengeAndVerify(
    String(formData.get("factorId") ?? ""),
    readCode(formData)
  )
}

/** Step up an existing enrolled admin from aal1 to aal2 using their TOTP code. */
export async function stepUpAdminMfa(
  _prev: AdminMfaFormState,
  formData: FormData
): Promise<AdminMfaFormState> {
  await requireAdminRead()
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) {
    return { ok: false, error: "Could not load your authenticator factors." }
  }
  const factor = data?.totp?.[0]
  if (!factor) {
    return { ok: false, error: "No authenticator is enrolled." }
  }

  return challengeAndVerify(factor.id, readCode(formData))
}

/** Remove an enrolled authenticator (returns the admin to no-factor). */
export async function unenrollAdminMfa(
  _prev: AdminMfaFormState,
  formData: FormData
): Promise<AdminMfaFormState> {
  await requireAdminRead()
  const factorId = String(formData.get("factorId") ?? "")
  if (!factorId) return { ok: false, error: "Missing authenticator factor." }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/admin")
  return { ok: true, error: null }
}
