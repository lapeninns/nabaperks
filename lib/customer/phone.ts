import "server-only"

import { parsePhoneNumberFromString } from "libphonenumber-js"

export type NormalizedPhone = {
  readonly e164: string
  readonly country: string
  readonly last4: string
}

export type NormalizePhoneResult =
  | { ok: true; phone: NormalizedPhone }
  | {
      ok: false
      error: "Enter a UK phone number." | "Enter a valid phone number."
    }

export function normalizePhone(raw: string): NormalizePhoneResult {
  const parsed = parsePhoneNumberFromString(raw, {
    defaultCountry: "GB",
    extract: false,
  })

  if (!parsed?.isValid()) {
    return { ok: false, error: "Enter a valid phone number." }
  }

  if (parsed.country !== "GB") {
    return { ok: false, error: "Enter a UK phone number." }
  }

  return {
    ok: true,
    phone: {
      e164: parsed.number,
      country: parsed.country,
      last4: phoneLast4(parsed.number),
    },
  }
}

export function phoneLast4(e164: string): string {
  return e164.replace(/\D/g, "").slice(-4)
}

export function normalizeUkPhone(raw: string): string {
  const normalized = normalizePhone(raw)

  if (normalized.ok) return normalized.phone.e164

  return raw.replace(/[\s()-]/g, "")
}
