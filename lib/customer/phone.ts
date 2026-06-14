import "server-only"

import {
  getCountries,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js"

export type NormalizedPhone = {
  e164: string
  country: string
  last4: string
}

export type NormalizePhoneResult =
  | { ok: true; phone: NormalizedPhone }
  | { ok: false; error: "Enter a valid phone number." }

const fallbackCountry: CountryCode = "GB"
const ipCountryHeaders = ["x-vercel-ip-country", "cf-ipcountry"] as const
const supportedCountries = getCountries()

export function defaultCountryFromHeaders(
  headersList: Pick<Headers, "get">
): CountryCode {
  for (const header of ipCountryHeaders) {
    const country = toCountryCode(headersList.get(header))
    if (country) return country
  }

  return fallbackCountry
}

export function normalizePhone(
  raw: string,
  defaultCountry: CountryCode = fallbackCountry
): NormalizePhoneResult {
  const parsed = parsePhoneNumberFromString(raw, {
    defaultCountry,
    extract: false,
  })

  if (!parsed?.isValid()) {
    return { ok: false, error: "Enter a valid phone number." }
  }

  return {
    ok: true,
    phone: {
      e164: parsed.number,
      country: parsed.country ?? defaultCountry,
      last4: phoneLast4(parsed.number),
    },
  }
}

export function phoneLast4(e164: string): string {
  return e164.replace(/\D/g, "").slice(-4)
}

export function normalizeUkPhone(raw: string): string {
  const normalized = normalizePhone(raw, "GB")

  if (normalized.ok) return normalized.phone.e164

  return raw.replace(/[\s()-]/g, "")
}

function toCountryCode(value: string | null): CountryCode | null {
  if (!value) return null

  const normalized = value.trim().toUpperCase()
  for (const country of supportedCountries) {
    if (country === normalized) return country
  }

  return null
}
