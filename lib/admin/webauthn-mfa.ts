"use client"

import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveAdminWebAuthnContext } from "@/lib/admin/webauthn-policy"

type WebAuthnResult = { ok: true } | { ok: false; error: string }

const WEB_AUTHN_UNAVAILABLE =
  "This browser cannot use a passkey or security key. Try a current browser on a device with a screen lock, or connect a security key."

export function getAdminWebAuthnContext(
  currentOrigin: string = window.location.origin
) {
  return resolveAdminWebAuthnContext(currentOrigin)
}

function browserSupportsWebAuthn() {
  return (
    typeof window !== "undefined" &&
    "PublicKeyCredential" in window &&
    typeof navigator.credentials?.create === "function" &&
    typeof navigator.credentials?.get === "function"
  )
}

function failure(error: unknown, fallback: string): WebAuthnResult {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return {
      ok: false,
      error: "The passkey or security-key request was cancelled.",
    }
  }
  return { ok: false, error: fallback }
}

async function removeUnverifiedFactor(
  supabase: SupabaseClient,
  factorId: string
) {
  await supabase.auth.mfa.unenroll({ factorId })
}

export async function registerAdminWebAuthnFactor(
  supabase: SupabaseClient
): Promise<WebAuthnResult> {
  if (!browserSupportsWebAuthn()) {
    return { ok: false, error: WEB_AUTHN_UNAVAILABLE }
  }

  const context = getAdminWebAuthnContext()
  const enrollment = await supabase.auth.mfa.enroll({
    factorType: "webauthn",
    friendlyName: `admin-security-key-${Date.now()}`,
  })
  if (enrollment.error || !enrollment.data) {
    return {
      ok: false,
      error: "Could not start passkey or security-key setup.",
    }
  }

  const factorId = enrollment.data.id
  try {
    const challenge = await supabase.auth.mfa.challenge({
      factorId,
      webauthn: context,
    })
    if (challenge.error || challenge.data?.webauthn?.type !== "create") {
      await removeUnverifiedFactor(supabase, factorId)
      return { ok: false, error: "Could not create a security-key challenge." }
    }

    const publicKey = challenge.data.webauthn.credential_options.publicKey
    publicKey.authenticatorSelection = {
      ...publicKey.authenticatorSelection,
      userVerification: "required",
    }
    // TypeScript's DOM library has not yet adopted WebAuthn's newer transport
    // names, while auth-js deliberately returns the forward-compatible shape.
    const credential = await navigator.credentials.create({
      publicKey: publicKey as unknown as PublicKeyCredentialCreationOptions,
    })
    if (!(credential instanceof PublicKeyCredential)) {
      await removeUnverifiedFactor(supabase, factorId)
      return { ok: false, error: "The browser returned an invalid credential." }
    }

    const verification = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      webauthn: {
        ...context,
        type: "create",
        credential_response: credential as never,
      },
    })
    if (verification.error) {
      await removeUnverifiedFactor(supabase, factorId)
      return {
        ok: false,
        error: "The passkey or security key was not verified.",
      }
    }

    return { ok: true }
  } catch (error) {
    await removeUnverifiedFactor(supabase, factorId)
    return failure(error, "Could not finish passkey or security-key setup.")
  }
}

export async function stepUpAdminWebAuthn(
  supabase: SupabaseClient
): Promise<WebAuthnResult> {
  if (!browserSupportsWebAuthn()) {
    return { ok: false, error: WEB_AUTHN_UNAVAILABLE }
  }

  const factors = await supabase.auth.mfa.listFactors()
  if (factors.error || factors.data?.webauthn.length !== 1) {
    return {
      ok: false,
      error: "Exactly one verified security key is required.",
    }
  }

  const context = getAdminWebAuthnContext()
  const factorId = factors.data.webauthn[0].id
  try {
    const challenge = await supabase.auth.mfa.challenge({
      factorId,
      webauthn: context,
    })
    if (challenge.error || challenge.data?.webauthn?.type !== "request") {
      return { ok: false, error: "Could not create a security-key challenge." }
    }

    const publicKey = challenge.data.webauthn.credential_options.publicKey
    publicKey.userVerification = "required"
    const credential = await navigator.credentials.get({
      publicKey: publicKey as unknown as PublicKeyCredentialRequestOptions,
    })
    if (!(credential instanceof PublicKeyCredential)) {
      return { ok: false, error: "The browser returned an invalid credential." }
    }

    const verification = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      webauthn: {
        ...context,
        type: "request",
        credential_response: credential as never,
      },
    })
    if (verification.error) {
      return {
        ok: false,
        error: "The passkey or security key was not verified.",
      }
    }

    return { ok: true }
  } catch (error) {
    return failure(error, "Could not verify the passkey or security key.")
  }
}
