import "server-only"

import { parsePhoneNumberFromString } from "libphonenumber-js"

export type NormalizedPhone = {
  readonly e164: string
  readonly country: string
  readonly last4: string
}

export type NormalizePhoneResult =
  | { ok: true; phone: NormalizedPhone }
  | { ok: false; error: typeof UK_MOBILE_NUMBER_ERROR }

/**
 * The one answer for a number we cannot use, invalid or from outside the UK:
 * what to type, with an example (designer brief J2).
 */
export const UK_MOBILE_NUMBER_ERROR =
  "Enter a UK mobile number, like 07700 900123."

export function normalizePhone(raw: string): NormalizePhoneResult {
  const parsed = parsePhoneNumberFromString(raw, {
    defaultCountry: "GB",
    extract: false,
  })

  if (!parsed?.isValid() || parsed.country !== "GB") {
    return { ok: false, error: UK_MOBILE_NUMBER_ERROR }
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
