"use client"

import { startAuthentication, startRegistration } from "@simplewebauthn/browser"
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser"
import type { SupabaseClient } from "@supabase/supabase-js"

import { resolveAdminWebAuthnContext } from "@/lib/admin/webauthn-policy"

type WebAuthnResult = { ok: true } | { ok: false; error: string }

type CeremonyOptions<T> = {
  ok: true
  challengeId: string
  options: T
}

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

function validOptions<T>(value: unknown): value is CeremonyOptions<T> {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<CeremonyOptions<T>>
  return (
    candidate.ok === true &&
    typeof candidate.challengeId === "string" &&
    candidate.options !== null &&
    typeof candidate.options === "object"
  )
}

export async function registerAdminWebAuthnFactor(
  supabase: SupabaseClient
): Promise<WebAuthnResult> {
  if (!browserSupportsWebAuthn()) {
    return { ok: false, error: WEB_AUTHN_UNAVAILABLE }
  }
  getAdminWebAuthnContext()

  try {
    const { data, error } = await supabase.functions.invoke("admin-webauthn", {
      body: { action: "registration-options" },
    })
    if (error || !validOptions<PublicKeyCredentialCreationOptionsJSON>(data)) {
      return { ok: false, error: "Could not create a security-key challenge." }
    }
    const credential = await startRegistration({ optionsJSON: data.options })
    const verification = await supabase.functions.invoke("admin-webauthn", {
      body: {
        action: "registration-verify",
        challengeId: data.challengeId,
        response: credential,
      },
    })
    if (verification.error || verification.data?.ok !== true) {
      return {
        ok: false,
        error: "The passkey or security key was not verified.",
      }
    }
    return { ok: true }
  } catch (error) {
    return failure(error, "Could not finish passkey or security-key setup.")
  }
}

export async function stepUpAdminWebAuthn(
  supabase: SupabaseClient
): Promise<WebAuthnResult> {
  if (!browserSupportsWebAuthn()) {
    return { ok: false, error: WEB_AUTHN_UNAVAILABLE }
  }
  getAdminWebAuthnContext()

  try {
    const { data, error } = await supabase.functions.invoke("admin-webauthn", {
      body: { action: "authentication-options" },
    })
    if (error || !validOptions<PublicKeyCredentialRequestOptionsJSON>(data)) {
      return { ok: false, error: "Could not create a security-key challenge." }
    }
    const credential = await startAuthentication({ optionsJSON: data.options })
    const verification = await supabase.functions.invoke("admin-webauthn", {
      body: {
        action: "authentication-verify",
        challengeId: data.challengeId,
        response: credential,
      },
    })
    if (verification.error || verification.data?.ok !== true) {
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
