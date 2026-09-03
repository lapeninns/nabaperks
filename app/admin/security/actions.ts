"use server"

import { revalidatePath } from "next/cache"

import { requireAdminRead } from "@/lib/admin/auth"
import {
  adminMfaEnrollmentAllowed,
  adminMfaUnenrollmentAllowed,
} from "@/lib/admin/mfa-gate"
import { createSupabaseServerClient } from "@/lib/supabase/server"

/**
 * Admin authenticator (TOTP) enrol / step-up server actions.
 *
 * These gate on requireAdminRead rather than requireAdminStepUp, because the
 * whole point of step-up is to reach aal2 from aal1 and a step-up gate here
 * would be unsatisfiable. Stepping up is safe on that gate alone: the server
 * picks the existing factor itself, so the caller cannot substitute one.
 *
 * ADDING a factor is different. It is a security-state transition that mints a
 * new credential, so it carries its own adminMfaEnrollmentAllowed check —
 * otherwise a compromised aal1 session on an already-enrolled admin could enrol
 * an attacker-controlled authenticator and use it to reach aal2.
 */

export type AdminMfaEnrollment =
  | { ok: true; factorId: string; qrCodeSvg: string; secret: string }
  | { ok: false; error: string }

export type AdminMfaFormState = { ok: boolean; error: string | null }

const OTP_CODE = /^\d{6}$/

function readCode(formData: FormData): string {
  return String(formData.get("code") ?? "").replace(/\s+/g, "")
}

const ENROLLMENT_BLOCKED =
  "Verify with your existing authenticator before adding another one."

/** Start enrolment: mint a new unverified TOTP factor and return its QR + secret. */
export async function beginAdminMfaEnrollment(): Promise<AdminMfaEnrollment> {
  const access = await requireAdminRead()
  if (!adminMfaEnrollmentAllowed(access.mfaState)) {
    return { ok: false, error: ENROLLMENT_BLOCKED }
  }

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
  const access = await requireAdminRead()
  if (!adminMfaEnrollmentAllowed(access.mfaState)) {
    return { ok: false, error: ENROLLMENT_BLOCKED }
  }

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
  const access = await requireAdminRead()
  if (!adminMfaUnenrollmentAllowed(access.mfaState)) {
    return {
      ok: false,
      error:
        "Verify with your authenticator before turning off two-factor authentication.",
    }
  }

  const factorId = String(formData.get("factorId") ?? "")
  if (!factorId) return { ok: false, error: "Missing authenticator factor." }

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
